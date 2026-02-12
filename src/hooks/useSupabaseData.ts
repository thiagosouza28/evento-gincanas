import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { calcularIdade } from '@/types';
import type { Inscrito, Equipe, Gincana, Pontuacao, Sorteio, EquipeComParticipantes } from '@/types';

// ============== INSCRITOS ==============

export function useSupabaseInscritos() {
  const { user } = useAuth();
  const [inscritos, setInscritos] = useState<Map<number, Inscrito>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadInscritos = useCallback(async () => {
    if (!user) {
      setInscritos(new Map());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inscritos')
        .select('*')
        .eq('user_id', user.id)
        .order('numero', { ascending: true });

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
    } catch (error) {
      console.error('Erro ao carregar inscritos:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadInscritos();
  }, [loadInscritos]);

  const getInscrito = useCallback((numero: number): Inscrito | undefined => {
    return inscritos.get(numero);
  }, [inscritos]);

  const saveInscrito = async (inscrito: Inscrito) => {
    if (!user) return;

    const { error } = await supabase
      .from('inscritos')
      .upsert({
        user_id: user.id,
        numero: inscrito.numero,
        nome: inscrito.nome,
        data_nascimento: inscrito.dataNascimento || null,
        idade: inscrito.idade,
        igreja: inscrito.igreja,
        distrito: inscrito.distrito,
        foto_url: inscrito.fotoUrl || null,
        status_pagamento: inscrito.statusPagamento,
        is_manual: inscrito.isManual || false,
        numero_original: inscrito.numeroOriginal || null,
        lote_id: inscrito.loteId || null,
        lote_externo_id: inscrito.loteExternoId || null,
        lote_externo_nome: inscrito.loteExternoNome || null,
        numero_pulseira: String(inscrito.numero),
      }, { onConflict: 'user_id,numero' });

    if (error) throw error;
    await loadInscritos();
  };

  const deleteInscrito = async (numero: number) => {
    if (!user) return;

    const { error } = await supabase
      .from('inscritos')
      .delete()
      .eq('user_id', user.id)
      .eq('numero', numero);

    if (error) throw error;
    await loadInscritos();
  };

  return { inscritos, loading, getInscrito, saveInscrito, deleteInscrito, reload: loadInscritos };
}

// ============== EQUIPES ==============

export function useSupabaseEquipes() {
  const { user } = useAuth();
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEquipes = useCallback(async () => {
    if (!user) {
      setEquipes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipes')
        .select('*')
        .eq('user_id', user.id)
        .order('nome');

      if (error) throw error;

      setEquipes((data || []).map(row => ({
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
      })));
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadEquipes();
  }, [loadEquipes]);

  const saveEquipe = async (equipe: Equipe) => {
    if (!user) return;

    const { error } = await supabase
      .from('equipes')
      .upsert({
        id: equipe.id,
        user_id: user.id,
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
    if (!user) return;

    const { error } = await supabase
      .from('equipes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    await loadEquipes();
  };

  return { equipes, loading, saveEquipe, deleteEquipe, reload: loadEquipes };
}

// ============== EQUIPES COM PARTICIPANTES ==============

export function useSupabaseEquipesComParticipantes(gincanaId?: string) {
  const { user } = useAuth();
  const [equipes, setEquipes] = useState<EquipeComParticipantes[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEquipes = useCallback(async () => {
    if (!user) {
      setEquipes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Load equipes
      const { data: equipesData, error: equipesError } = await supabase
        .from('equipes')
        .select('*')
        .eq('user_id', user.id);

      if (equipesError) throw equipesError;

      // Load sorteios for participant count
      const { data: sorteiosData, error: sorteiosError } = await supabase
        .from('sorteios')
        .select('equipe_id')
        .eq('user_id', user.id);

      if (sorteiosError) throw sorteiosError;

      // Load pontuacoes for total points
      let pontuacoesQuery = supabase
        .from('pontuacoes')
        .select('equipe_id, pontos')
        .eq('user_id', user.id);

      if (gincanaId) {
        pontuacoesQuery = pontuacoesQuery.eq('gincana_id', gincanaId);
      }

      const { data: pontuacoesData, error: pontuacoesError } = await pontuacoesQuery;

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

      setEquipes((equipesData || []).map(row => ({
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
      })));
    } catch (error) {
      console.error('Erro ao carregar equipes:', error);
    } finally {
      setLoading(false);
    }
  }, [user, gincanaId]);

  useEffect(() => {
    loadEquipes();
  }, [loadEquipes]);

  return { equipes, loading, reload: loadEquipes };
}

// ============== GINCANAS ==============

export function useSupabaseGincanas() {
  const { user } = useAuth();
  const [gincanas, setGincanas] = useState<Gincana[]>([]);
  const [gincanaAtiva, setGincanaAtiva] = useState<Gincana | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGincanas = useCallback(async () => {
    if (!user) {
      setGincanas([]);
      setGincanaAtiva(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gincanas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

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
      setGincanaAtiva(mapped.find(g => g.ativa) || null);
    } catch (error) {
      console.error('Erro ao carregar gincanas:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadGincanas();
  }, [loadGincanas]);

  const saveGincana = async (gincana: Gincana) => {
    if (!user) return;

    const { error } = await supabase
      .from('gincanas')
      .upsert({
        id: gincana.id,
        user_id: user.id,
        nome: gincana.nome,
        categoria: gincana.categoria,
        ativa: gincana.ativa,
      });

    if (error) throw error;
    await loadGincanas();
  };

  const deleteGincana = async (id: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('gincanas')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    await loadGincanas();
  };

  const setAtiva = async (id: string) => {
    if (!user) return;

    // First, deactivate all
    await supabase
      .from('gincanas')
      .update({ ativa: false })
      .eq('user_id', user.id);

    // Then activate the selected one
    const { error } = await supabase
      .from('gincanas')
      .update({ ativa: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    await loadGincanas();
  };

  return { gincanas, gincanaAtiva, loading, saveGincana, deleteGincana, setAtiva, reload: loadGincanas };
}

// ============== SORTEIOS ==============

export function useSupabaseSorteios() {
  const { user } = useAuth();
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSorteios = useCallback(async () => {
    if (!user) {
      setSorteios([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sorteios')
        .select('*')
        .eq('user_id', user.id)
        .order('data_hora', { ascending: false });

      if (error) throw error;

      setSorteios((data || []).map(row => ({
        id: row.id,
        numeroInscrito: row.numero_inscrito,
        equipeId: row.equipe_id,
        gincanaId: row.gincana_id,
        dataHora: row.data_hora,
      })));
    } catch (error) {
      console.error('Erro ao carregar sorteios:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadSorteios();
  }, [loadSorteios]);

  const verificarSorteado = async (numeroInscrito: number): Promise<Sorteio | undefined> => {
    if (!user) return undefined;

    const { data, error } = await supabase
      .from('sorteios')
      .select('*')
      .eq('user_id', user.id)
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

  const realizarSorteio = async (numeroInscrito: number, gincanaId: string): Promise<Equipe | null> => {
    if (!user) return null;

    try {
      // Verify not already drawn
      const jaSorteado = await verificarSorteado(numeroInscrito);
      if (jaSorteado) return null;

      // Get all teams with participant counts
      const { data: equipesData } = await supabase
        .from('equipes')
        .select('*')
        .eq('user_id', user.id);

      if (!equipesData || equipesData.length === 0) return null;

      const { data: sorteiosData } = await supabase
        .from('sorteios')
        .select('equipe_id')
        .eq('user_id', user.id);

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
          .eq('user_id', user.id)
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

      // Save draw
      const { error } = await supabase
        .from('sorteios')
        .insert({
          user_id: user.id,
          numero_inscrito: numeroInscrito,
          equipe_id: selected.id,
          gincana_id: gincanaId,
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
    if (!user) return;

    const { error } = await supabase
      .from('sorteios')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    await loadSorteios();
  };

  return { sorteios, loading, verificarSorteado, realizarSorteio, deleteSorteio, reload: loadSorteios };
}

// ============== PONTUAÇÕES ==============

export function useSupabasePontuacoes() {
  const { user } = useAuth();
  const [pontuacoes, setPontuacoes] = useState<Pontuacao[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPontuacoes = useCallback(async () => {
    if (!user) {
      setPontuacoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pontuacoes')
        .select('*')
        .eq('user_id', user.id)
        .order('data_hora', { ascending: false });

      if (error) throw error;

      setPontuacoes((data || []).map(row => ({
        id: row.id,
        gincanaId: row.gincana_id,
        equipeId: row.equipe_id,
        pontos: row.pontos,
        observacao: row.observacao || undefined,
        dataHora: row.data_hora,
        numeroInscrito: row.numero_inscrito ?? undefined,
      })));
    } catch (error) {
      console.error('Erro ao carregar pontuações:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadPontuacoes();
  }, [loadPontuacoes]);

  const adicionarPontuacao = async (equipeId: string, pontos: number, gincanaId: string, observacao?: string, numeroInscrito?: number) => {
    if (!user) return;

    const { error } = await supabase
      .from('pontuacoes')
      .insert({
        user_id: user.id,
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
