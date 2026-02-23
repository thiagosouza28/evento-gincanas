import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calcularIdade } from '@/types';
import { isPagamentoBloqueadoParaSorteioEquipe } from '@/lib/pagamentoStatus';
import type { Inscrito, Equipe, Gincana, Pontuacao, Sorteio, EquipeComParticipantes } from '@/types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUEST_TIMEOUT_MS = 6000;
const FAILURE_COOLDOWN_MS = 20000;
const CACHE_PREFIX = 'sb-cache:';
const failedRequestAt = new Map<string, number>();
const inscritosCache = new Map<string, Map<number, Inscrito>>();
const equipesCache = new Map<string, Equipe[]>();
const equipesComParticipantesCache = new Map<string, EquipeComParticipantes[]>();
const gincanasCache = new Map<string, { gincanas: Gincana[]; gincanaAtiva: Gincana | null }>();
const sorteiosCache = new Map<string, Sorteio[]>();
const pontuacoesCache = new Map<string, Pontuacao[]>();

function isInFailureCooldown(key: string) {
  const lastFailure = failedRequestAt.get(key);
  if (!lastFailure) return false;
  return Date.now() - lastFailure < FAILURE_COOLDOWN_MS;
}

function markFailure(key: string) {
  failedRequestAt.set(key, Date.now());
}

function clearFailure(key: string) {
  failedRequestAt.delete(key);
}

function readPersistedCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writePersistedCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

async function runWithTimeout<T>(
  executor: (signal: AbortSignal) => Promise<T>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await executor(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

// ============== INSCRITOS ==============

export function useSupabaseInscritos() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [inscritos, setInscritos] = useState<Map<number, Inscrito>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadInscritos = useCallback(async () => {
    const requestKey = `inscritos:${userId || 'anon'}`;
    if (!userId) {
      setInscritos(new Map());
      setLoading(false);
      return;
    }

    if (isInFailureCooldown(requestKey)) {
      const cached = inscritosCache.get(requestKey);
      if (cached) {
        setInscritos(new Map(cached));
      } else {
        const persisted = readPersistedCache<Array<[number, Inscrito]>>(requestKey);
        if (persisted) {
          setInscritos(new Map(persisted));
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await runWithTimeout((signal) =>
        supabase
          .from('inscritos')
          .select('numero, nome, data_nascimento, idade, igreja, distrito, foto_url, status_pagamento, is_manual, numero_original, lote_id, lote_externo_id, lote_externo_nome')
          .eq('user_id', userId)
          .order('numero', { ascending: true })
          .abortSignal(signal),
      );

      if (error) throw error;

      const map = new Map<number, Inscrito>();
      for (const row of data || []) {
        const dataNascimento = row.data_nascimento || '';
        const idadeCalculada = dataNascimento
          ? calcularIdade(dataNascimento)
          : (row.idade || 0);
        map.set(row.numero, {
          numero: row.numero,
          nome: row.nome,
          dataNascimento,
          idade: idadeCalculada,
          igreja: row.igreja || 'Não informado',
          distrito: row.distrito || 'Não informado',
          fotoUrl: row.foto_url || undefined,
          statusPagamento: (row.status_pagamento as Inscrito['statusPagamento']) || 'PENDING',
          isManual: row.is_manual || false,
          numeroOriginal: row.numero_original || undefined,
          loteId: row.lote_id || undefined,
          loteExternoId: row.lote_externo_id || undefined,
          loteExternoNome: row.lote_externo_nome || undefined,
          numeroPulseira: String(row.numero),
        });
      }
      setInscritos(map);
      inscritosCache.set(requestKey, new Map(map));
      writePersistedCache(requestKey, Array.from(map.entries()));
      clearFailure(requestKey);
    } catch (error) {
      markFailure(requestKey);
      const cached = inscritosCache.get(requestKey);
      if (cached) {
        setInscritos(new Map(cached));
      } else {
        const persisted = readPersistedCache<Array<[number, Inscrito]>>(requestKey);
        if (persisted) {
          setInscritos(new Map(persisted));
        }
      }
      console.error('Erro ao carregar inscritos:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadInscritos();
  }, [loadInscritos]);

  const getInscrito = useCallback((numero: number): Inscrito | undefined => {
    return inscritos.get(numero);
  }, [inscritos]);

  const saveInscrito = async (inscrito: Inscrito) => {
    if (!userId) return;
    const numeroOriginal = inscrito.numeroOriginal?.trim();

    // For records created from public registration, also update source participant.
    if (numeroOriginal && UUID_REGEX.test(numeroOriginal)) {
      try {
        let distritoId: string | null = null;
        let igrejaId: string | null = null;

        if (inscrito.distrito?.trim()) {
          const { data: distritoRows, error: distritoError } = await supabase
            .from('distritos')
            .select('id')
            .ilike('nome', inscrito.distrito.trim())
            .limit(1);
          if (distritoError) {
            throw distritoError;
          }
          distritoId = distritoRows?.[0]?.id || null;
        }

        if (inscrito.igreja?.trim()) {
          const { data: igrejaRows, error: igrejaError } = await supabase
            .from('igrejas')
            .select('id, distrito_id')
            .ilike('nome', inscrito.igreja.trim())
            .limit(1);
          if (igrejaError) {
            throw igrejaError;
          }
          igrejaId = igrejaRows?.[0]?.id || null;
          if (!distritoId) {
            distritoId = igrejaRows?.[0]?.distrito_id || null;
          }
        }

        const participantePayload: Record<string, unknown> = {
          nome: inscrito.nome,
          nascimento: inscrito.dataNascimento || null,
        };
        if (igrejaId) {
          participantePayload.igreja_id = igrejaId;
        }
        if (distritoId) {
          participantePayload.distrito_id = distritoId;
        }

        const { error: participanteError } = await supabase
          .from('participantes')
          .update(participantePayload)
          .eq('id', numeroOriginal);

        if (participanteError) {
          console.warn('Falha ao atualizar participante fonte:', participanteError.message);
        }
      } catch (error) {
        console.warn('Falha ao sincronizar edicao com participantes:', error);
      }
    }

    const { error } = await supabase
      .from('inscritos')
      .upsert({
        user_id: userId,
        numero: inscrito.numero,
        nome: inscrito.nome,
        data_nascimento: inscrito.dataNascimento || null,
        idade: inscrito.idade,
        igreja: inscrito.igreja,
        distrito: inscrito.distrito,
        foto_url: inscrito.fotoUrl || null,
        status_pagamento: inscrito.statusPagamento,
        is_manual: inscrito.isManual || false,
        numero_original: numeroOriginal || null,
        lote_id: inscrito.loteId || null,
        lote_externo_id: inscrito.loteExternoId || null,
        lote_externo_nome: inscrito.loteExternoNome || null,
        numero_pulseira: String(inscrito.numero),
      }, { onConflict: 'user_id,numero' });

    if (error) throw error;
    await loadInscritos();
  };

  const deleteInscrito = async (inscritoOrNumero: Inscrito | number) => {
    if (!userId) return;
    const inscrito =
      typeof inscritoOrNumero === 'number'
        ? inscritos.get(inscritoOrNumero)
        : inscritoOrNumero;
    const numero =
      typeof inscritoOrNumero === 'number'
        ? inscritoOrNumero
        : inscritoOrNumero.numero;
    const numeroOriginal = inscrito?.numeroOriginal?.trim();

    // If this row originated from participantes, remove source row too.
    if (numeroOriginal && UUID_REGEX.test(numeroOriginal)) {
      const { error: participanteError } = await supabase
        .from('participantes')
        .delete()
        .eq('id', numeroOriginal);

      if (participanteError) {
        throw participanteError;
      }
    }

    // Remove related draws to avoid orphan number references.
    const { error: sorteioError } = await supabase
      .from('sorteios')
      .delete()
      .eq('user_id', userId)
      .eq('numero_inscrito', numero);

    if (sorteioError) throw sorteioError;

    const { error } = await supabase
      .from('inscritos')
      .delete()
      .eq('user_id', userId)
      .eq('numero', numero);

    if (error) throw error;
    await loadInscritos();
  };

  return { inscritos, loading, getInscrito, saveInscrito, deleteInscrito, reload: loadInscritos };
}

// ============== EQUIPES ==============

export function useSupabaseEquipes() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEquipes = useCallback(async () => {
    const requestKey = `equipes:${userId || 'anon'}`;
    if (!userId) {
      setEquipes([]);
      setLoading(false);
      return;
    }

    if (isInFailureCooldown(requestKey)) {
      const cached = equipesCache.get(requestKey);
      if (cached) {
        setEquipes([...cached]);
      } else {
        const persisted = readPersistedCache<Equipe[]>(requestKey);
        if (persisted) {
          setEquipes([...persisted]);
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await runWithTimeout((signal) =>
        supabase
          .from('equipes')
          .select('id, nome, numero, lider, vice, cor, cor_pulseira, imagem_url, created_at, updated_at')
          .eq('user_id', userId)
          .order('nome')
          .abortSignal(signal),
      );

      if (error) throw error;

      const mapped = (data || []).map(row => ({
        id: row.id,
        nome: row.nome,
        numero: row.numero,
        lider: row.lider,
        vice: row.vice,
        cor: row.cor,
        corPulseira: row.cor_pulseira || undefined,
        imagemUrl: row.imagem_url || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      setEquipes(mapped);
      equipesCache.set(requestKey, [...mapped]);
      writePersistedCache(requestKey, mapped);
      clearFailure(requestKey);
    } catch (error) {
      markFailure(requestKey);
      const cached = equipesCache.get(requestKey);
      if (cached) {
        setEquipes([...cached]);
      } else {
        const persisted = readPersistedCache<Equipe[]>(requestKey);
        if (persisted) {
          setEquipes([...persisted]);
        }
      }
      console.error('Erro ao carregar equipes:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadEquipes();
  }, [loadEquipes]);

  const saveEquipe = async (equipe: Equipe) => {
    if (!userId) return;

    const { error } = await supabase
      .from('equipes')
      .upsert({
        id: equipe.id,
        user_id: userId,
        nome: equipe.nome,
        numero: equipe.numero,
        lider: equipe.lider,
        vice: equipe.vice,
        cor: equipe.cor,
        cor_pulseira: equipe.corPulseira || null,
        imagem_url: equipe.imagemUrl || null,
      });

    if (error) throw error;
    await loadEquipes();
  };

  const deleteEquipe = async (id: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('equipes')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    await loadEquipes();
  };

  return { equipes, loading, saveEquipe, deleteEquipe, reload: loadEquipes };
}

// ============== EQUIPES COM PARTICIPANTES ==============

export function useSupabaseEquipesComParticipantes(gincanaId?: string) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [equipes, setEquipes] = useState<EquipeComParticipantes[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEquipes = useCallback(async () => {
    const requestKey = `equipesComParticipantes:${userId || 'anon'}:${gincanaId || 'all'}`;
    if (!userId) {
      setEquipes([]);
      setLoading(false);
      return;
    }

    if (isInFailureCooldown(requestKey)) {
      const cached = equipesComParticipantesCache.get(requestKey);
      if (cached) {
        setEquipes([...cached]);
      } else {
        const persisted = readPersistedCache<EquipeComParticipantes[]>(requestKey);
        if (persisted) {
          setEquipes([...persisted]);
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      let pontuacoesQuery = supabase
        .from('pontuacoes')
        .select('equipe_id, pontos')
        .eq('user_id', userId);

      if (gincanaId) {
        pontuacoesQuery = pontuacoesQuery.eq('gincana_id', gincanaId);
      }

      const [
        { data: equipesData, error: equipesError },
        { data: sorteiosData, error: sorteiosError },
        { data: pontuacoesData, error: pontuacoesError },
      ] = await Promise.all([
        runWithTimeout((signal) =>
          supabase
            .from('equipes')
            .select('id, nome, numero, lider, vice, cor, cor_pulseira, imagem_url, created_at, updated_at')
            .eq('user_id', userId)
            .abortSignal(signal),
        ),
        runWithTimeout((signal) =>
          supabase
            .from('sorteios')
            .select('equipe_id')
            .eq('user_id', userId)
            .abortSignal(signal),
        ),
        runWithTimeout((signal) => pontuacoesQuery.abortSignal(signal)),
      ]);

      if (equipesError) throw equipesError;
      if (sorteiosError) throw sorteiosError;
      if (pontuacoesError) throw pontuacoesError;

      // Count participants and points per team
      const participantesCount = new Map<string, number>();
      const pontosTotal = new Map<string, number>();

      for (const s of sorteiosData || []) {
        participantesCount.set(s.equipe_id, (participantesCount.get(s.equipe_id) || 0) + 1);
      }

      for (const p of pontuacoesData || []) {
        pontosTotal.set(p.equipe_id, (pontosTotal.get(p.equipe_id) || 0) + p.pontos);
      }

      const mapped = (equipesData || []).map(row => ({
        id: row.id,
        nome: row.nome,
        numero: row.numero,
        lider: row.lider,
        vice: row.vice,
        cor: row.cor,
        corPulseira: row.cor_pulseira || undefined,
        imagemUrl: row.imagem_url || undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        participantes: participantesCount.get(row.id) || 0,
        pontuacaoTotal: pontosTotal.get(row.id) || 0,
      }));

      setEquipes(mapped);
      equipesComParticipantesCache.set(requestKey, [...mapped]);
      writePersistedCache(requestKey, mapped);
      clearFailure(requestKey);
    } catch (error) {
      markFailure(requestKey);
      const cached = equipesComParticipantesCache.get(requestKey);
      if (cached) {
        setEquipes([...cached]);
      } else {
        const persisted = readPersistedCache<EquipeComParticipantes[]>(requestKey);
        if (persisted) {
          setEquipes([...persisted]);
        }
      }
      console.error('Erro ao carregar equipes:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, gincanaId]);

  useEffect(() => {
    loadEquipes();
  }, [loadEquipes]);

  return { equipes, loading, reload: loadEquipes };
}

// ============== GINCANAS ==============

export function useSupabaseGincanas() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [gincanas, setGincanas] = useState<Gincana[]>([]);
  const [gincanaAtiva, setGincanaAtiva] = useState<Gincana | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGincanas = useCallback(async () => {
    const requestKey = `gincanas:${userId || 'anon'}`;
    if (!userId) {
      setGincanas([]);
      setGincanaAtiva(null);
      setLoading(false);
      return;
    }

    if (isInFailureCooldown(requestKey)) {
      const cached = gincanasCache.get(requestKey);
      if (cached) {
        setGincanas(cached.gincanas);
        setGincanaAtiva(cached.gincanaAtiva);
      } else {
        const persisted = readPersistedCache<{ gincanas: Gincana[]; gincanaAtiva: Gincana | null }>(requestKey);
        if (persisted) {
          setGincanas(persisted.gincanas);
          setGincanaAtiva(persisted.gincanaAtiva);
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await runWithTimeout((signal) =>
        supabase
          .from('gincanas')
          .select('id, nome, categoria, ativa, created_at, updated_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .abortSignal(signal),
      );

      if (error) throw error;

      const mapped = (data || []).map(row => ({
        id: row.id,
        nome: row.nome,
        categoria: row.categoria as Gincana['categoria'],
        ativa: row.ativa || false,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      setGincanas(mapped);
      const active = mapped.find(g => g.ativa) || null;
      setGincanaAtiva(active);
      gincanasCache.set(requestKey, { gincanas: mapped, gincanaAtiva: active });
      writePersistedCache(requestKey, { gincanas: mapped, gincanaAtiva: active });
      clearFailure(requestKey);
    } catch (error) {
      markFailure(requestKey);
      const cached = gincanasCache.get(requestKey);
      if (cached) {
        setGincanas(cached.gincanas);
        setGincanaAtiva(cached.gincanaAtiva);
      } else {
        const persisted = readPersistedCache<{ gincanas: Gincana[]; gincanaAtiva: Gincana | null }>(requestKey);
        if (persisted) {
          setGincanas(persisted.gincanas);
          setGincanaAtiva(persisted.gincanaAtiva);
        }
      }
      console.error('Erro ao carregar gincanas:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadGincanas();
  }, [loadGincanas]);

  const saveGincana = async (gincana: Gincana) => {
    if (!userId) return;

    const { error } = await supabase
      .from('gincanas')
      .upsert({
        id: gincana.id,
        user_id: userId,
        nome: gincana.nome,
        categoria: gincana.categoria,
        ativa: gincana.ativa,
      });

    if (error) throw error;
    await loadGincanas();
  };

  const deleteGincana = async (id: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('gincanas')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    await loadGincanas();
  };

  const setAtiva = async (id: string) => {
    if (!userId) return;

    // First, deactivate all
    await supabase
      .from('gincanas')
      .update({ ativa: false })
      .eq('user_id', userId);

    // Then activate the selected one
    const { error } = await supabase
      .from('gincanas')
      .update({ ativa: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    await loadGincanas();
  };

  return { gincanas, gincanaAtiva, loading, saveGincana, deleteGincana, setAtiva, reload: loadGincanas };
}

// ============== SORTEIOS ==============

export function useSupabaseSorteios() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSorteios = useCallback(async () => {
    const requestKey = `sorteios:${userId || 'anon'}`;
    if (!userId) {
      setSorteios([]);
      setLoading(false);
      return;
    }

    if (isInFailureCooldown(requestKey)) {
      const cached = sorteiosCache.get(requestKey);
      if (cached) {
        setSorteios([...cached]);
      } else {
        const persisted = readPersistedCache<Sorteio[]>(requestKey);
        if (persisted) {
          setSorteios([...persisted]);
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await runWithTimeout((signal) =>
        supabase
          .from('sorteios')
          .select('id, numero_inscrito, equipe_id, gincana_id, data_hora')
          .eq('user_id', userId)
          .order('data_hora', { ascending: false })
          .abortSignal(signal),
      );

      if (error) throw error;

      const mapped = (data || []).map(row => ({
        id: row.id,
        numeroInscrito: row.numero_inscrito,
        equipeId: row.equipe_id,
        gincanaId: row.gincana_id,
        dataHora: row.data_hora,
      }));

      setSorteios(mapped);
      sorteiosCache.set(requestKey, [...mapped]);
      writePersistedCache(requestKey, mapped);
      clearFailure(requestKey);
    } catch (error) {
      markFailure(requestKey);
      const cached = sorteiosCache.get(requestKey);
      if (cached) {
        setSorteios([...cached]);
      } else {
        const persisted = readPersistedCache<Sorteio[]>(requestKey);
        if (persisted) {
          setSorteios([...persisted]);
        }
      }
      console.error('Erro ao carregar sorteios:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadSorteios();
  }, [loadSorteios]);

  const verificarSorteado = async (numeroInscrito: number): Promise<Sorteio | undefined> => {
    if (!userId) return undefined;

    const { data, error } = await supabase
      .from('sorteios')
      .select('id, numero_inscrito, equipe_id, gincana_id, data_hora')
      .eq('user_id', userId)
      .eq('numero_inscrito', numeroInscrito)
      .maybeSingle();

    if (error || !data) return undefined;

    return {
      id: data.id,
      numeroInscrito: data.numero_inscrito,
      equipeId: data.equipe_id,
      gincanaId: data.gincana_id,
      dataHora: data.data_hora,
    };
  };

  const ensureGincanaIdForSorteio = async (preferredGincanaId?: string): Promise<string | null> => {
    if (!userId) return null;
    if (preferredGincanaId) return preferredGincanaId;

    const { data: existingGincana, error: existingError } = await supabase
      .from('gincanas')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingGincana?.id) return existingGincana.id;

    const { data: createdGincana, error: createError } = await supabase
      .from('gincanas')
      .insert({
        user_id: userId,
        nome: 'Gincana automatica (Sorteio de equipes)',
        categoria: 'adulto',
        ativa: false,
      })
      .select('id')
      .single();

    if (createError) throw createError;
    return createdGincana.id;
  };

  const realizarSorteio = async (numeroInscrito: number, gincanaId?: string): Promise<Equipe | null> => {
    if (!userId) return null;

    try {
      const { data: inscritoData, error: inscritoError } = await supabase
        .from('inscritos')
        .select('status_pagamento')
        .eq('user_id', userId)
        .eq('numero', numeroInscrito)
        .maybeSingle();

      if (inscritoError) throw inscritoError;
      if (!inscritoData) return null;
      if (isPagamentoBloqueadoParaSorteioEquipe(inscritoData.status_pagamento)) {
        return null;
      }

      // Verify not already drawn
      const jaSorteado = await verificarSorteado(numeroInscrito);
      if (jaSorteado) return null;

      // Get all teams with participant counts
      const { data: equipesData } = await supabase
        .from('equipes')
        .select('*')
        .eq('user_id', userId);

      if (!equipesData || equipesData.length === 0) return null;

      const { data: sorteiosData } = await supabase
        .from('sorteios')
        .select('equipe_id')
        .eq('user_id', userId);

      // Count participants per team
      const countMap = new Map<string, number>();
      for (const s of sorteiosData || []) {
        countMap.set(s.equipe_id, (countMap.get(s.equipe_id) || 0) + 1);
      }

      // Find minimum count
      const equipesComContagem = equipesData.map(e => ({
        equipe: e,
        count: countMap.get(e.id) || 0,
      }));

      const minCount = Math.min(...equipesComContagem.map(e => e.count));
      let equipesDisponiveis = equipesComContagem.filter(e => e.count === minCount);

      // If all equal (new round), avoid last team drawn
      if (equipesDisponiveis.length > 1 && sorteiosData && sorteiosData.length > 0) {
        const { data: ultimoSorteio } = await supabase
          .from('sorteios')
          .select('equipe_id')
          .eq('user_id', userId)
          .order('data_hora', { ascending: false })
          .limit(1)
          .single();

        if (ultimoSorteio) {
          equipesDisponiveis = equipesDisponiveis.filter(
            e => e.equipe.id !== ultimoSorteio.equipe_id
          );
        }
      }

      // Random selection
      const selected = equipesDisponiveis[Math.floor(Math.random() * equipesDisponiveis.length)].equipe;
      const gincanaIdToUse = await ensureGincanaIdForSorteio(gincanaId);
      if (!gincanaIdToUse) return null;

      // Save draw
      const { error } = await supabase
        .from('sorteios')
        .insert({
          user_id: userId,
          numero_inscrito: numeroInscrito,
          equipe_id: selected.id,
          gincana_id: gincanaIdToUse,
        });

      if (error) throw error;
      await loadSorteios();

      return {
        id: selected.id,
        nome: selected.nome,
        numero: selected.numero,
        lider: selected.lider,
        vice: selected.vice,
        cor: selected.cor,
        corPulseira: selected.cor_pulseira || undefined,
        imagemUrl: selected.imagem_url || undefined,
        createdAt: selected.created_at,
        updatedAt: selected.updated_at,
      };
    } catch (error) {
      console.error('Erro ao realizar sorteio:', error);
      return null;
    }
  };

  const deleteSorteio = async (id: string) => {
    if (!userId) return;

    const { error } = await supabase
      .from('sorteios')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;
    await loadSorteios();
  };

  const removerParticipantesDaEquipe = async (equipeId: string, numerosInscritos: number[]) => {
    if (!userId) return 0;

    const numeros = Array.from(
      new Set(
        (numerosInscritos || [])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n)),
      ),
    );

    if (!equipeId || numeros.length === 0) return 0;

    const { data, error } = await supabase
      .from('sorteios')
      .delete()
      .eq('user_id', userId)
      .eq('equipe_id', equipeId)
      .in('numero_inscrito', numeros)
      .select('id');

    if (error) throw error;
    await loadSorteios();
    return data?.length || 0;
  };

  const transferirParticipantesDeEquipe = async (
    equipeOrigemId: string,
    equipeDestinoId: string,
    numerosInscritos: number[],
  ) => {
    if (!userId) return 0;

    const numeros = Array.from(
      new Set(
        (numerosInscritos || [])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n)),
      ),
    );

    if (!equipeOrigemId || !equipeDestinoId || equipeOrigemId === equipeDestinoId || numeros.length === 0) {
      return 0;
    }

    const { data, error } = await supabase
      .from('sorteios')
      .update({ equipe_id: equipeDestinoId })
      .eq('user_id', userId)
      .eq('equipe_id', equipeOrigemId)
      .in('numero_inscrito', numeros)
      .select('id');

    if (error) throw error;
    await loadSorteios();
    return data?.length || 0;
  };

  const adicionarParticipantesNaEquipe = async (
    equipeId: string,
    numerosInscritos: number[],
    gincanaId?: string,
  ) => {
    if (!userId) return { adicionados: 0, ignorados: 0 };

    const numeros = Array.from(
      new Set(
        (numerosInscritos || [])
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n)),
      ),
    );

    if (!equipeId || numeros.length === 0) {
      return { adicionados: 0, ignorados: 0 };
    }

    const gincanaIdToUse = await ensureGincanaIdForSorteio(gincanaId);
    if (!gincanaIdToUse) {
      return { adicionados: 0, ignorados: numeros.length };
    }

    const { data: existentes, error: existentesError } = await supabase
      .from('sorteios')
      .select('numero_inscrito')
      .eq('user_id', userId)
      .in('numero_inscrito', numeros);

    if (existentesError) throw existentesError;

    const existentesSet = new Set((existentes || []).map((row) => row.numero_inscrito));
    const novosNumeros = numeros.filter((numero) => !existentesSet.has(numero));

    if (novosNumeros.length === 0) {
      await loadSorteios();
      return { adicionados: 0, ignorados: numeros.length };
    }

    const payload = novosNumeros.map((numero) => ({
      user_id: userId,
      numero_inscrito: numero,
      equipe_id: equipeId,
      gincana_id: gincanaIdToUse,
    }));

    const { error: insertError } = await supabase
      .from('sorteios')
      .insert(payload);

    if (insertError) throw insertError;

    await loadSorteios();
    return { adicionados: novosNumeros.length, ignorados: numeros.length - novosNumeros.length };
  };

  return {
    sorteios,
    loading,
    verificarSorteado,
    realizarSorteio,
    deleteSorteio,
    removerParticipantesDaEquipe,
    transferirParticipantesDeEquipe,
    adicionarParticipantesNaEquipe,
    reload: loadSorteios,
  };
}

// ============== PONTUAÇÕES ==============

export function useSupabasePontuacoes() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const [pontuacoes, setPontuacoes] = useState<Pontuacao[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPontuacoes = useCallback(async () => {
    const requestKey = `pontuacoes:${userId || 'anon'}`;
    if (!userId) {
      setPontuacoes([]);
      setLoading(false);
      return;
    }

    if (isInFailureCooldown(requestKey)) {
      const cached = pontuacoesCache.get(requestKey);
      if (cached) {
        setPontuacoes([...cached]);
      } else {
        const persisted = readPersistedCache<Pontuacao[]>(requestKey);
        if (persisted) {
          setPontuacoes([...persisted]);
        }
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await runWithTimeout((signal) =>
        supabase
          .from('pontuacoes')
          .select('id, gincana_id, equipe_id, pontos, observacao, data_hora, numero_inscrito')
          .eq('user_id', userId)
          .order('data_hora', { ascending: false })
          .abortSignal(signal),
      );

      if (error) throw error;

      const mapped = (data || []).map(row => ({
        id: row.id,
        gincanaId: row.gincana_id,
        equipeId: row.equipe_id,
        pontos: row.pontos,
        observacao: row.observacao || undefined,
        dataHora: row.data_hora,
        numeroInscrito: row.numero_inscrito ?? undefined,
      }));

      setPontuacoes(mapped);
      pontuacoesCache.set(requestKey, [...mapped]);
      writePersistedCache(requestKey, mapped);
      clearFailure(requestKey);
    } catch (error) {
      markFailure(requestKey);
      const cached = pontuacoesCache.get(requestKey);
      if (cached) {
        setPontuacoes([...cached]);
      } else {
        const persisted = readPersistedCache<Pontuacao[]>(requestKey);
        if (persisted) {
          setPontuacoes([...persisted]);
        }
      }
      console.error('Erro ao carregar pontuacoes:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPontuacoes();
  }, [loadPontuacoes]);

  const adicionarPontuacao = async (equipeId: string, pontos: number, gincanaId: string, observacao?: string, numeroInscrito?: number) => {
    if (!userId) return;

    const { error } = await supabase
      .from('pontuacoes')
      .insert({
        user_id: userId,
        equipe_id: equipeId,
        gincana_id: gincanaId,
        pontos,
        observacao: observacao || null,
        numero_inscrito: numeroInscrito ?? null,
      });

    if (error) throw error;
    await loadPontuacoes();
  };

  return { pontuacoes, loading, adicionarPontuacao, reload: loadPontuacoes };
}
