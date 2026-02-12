import { supabase } from '@/integrations/supabase/client';
import { calcularIdade } from '@/types';

type SyncResult = { success: boolean; count: number; error?: string };

type ParticipanteRow = {
  id: string;
  nome: string | null;
  cpf: string | null;
  nascimento: string | null;
  evento_id: string | null;
  created_at: string;
  inscricoes?: { status?: string | null; created_at?: string | null; evento_id?: string | null } | null;
  igrejas?: { nome?: string | null } | null;
  distritos?: { nome?: string | null } | null;
};

const mapStatus = (status?: string | null): 'PAID' | 'PENDING' | 'CANCELLED' => {
  const upper = status?.toUpperCase() || '';
  if (upper === 'PAID' || upper === 'APPROVED') return 'PAID';
  if (upper === 'CANCELLED' || upper === 'CANCELED') return 'CANCELLED';
  return 'PENDING';
};

export async function syncInscricoesToInscritos(eventId?: string): Promise<SyncResult> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, count: 0, error: 'Usuário não autenticado' };
    }

    let query = supabase
      .from('participantes')
      .select('id, nome, cpf, nascimento, created_at, evento_id, inscricoes(status, created_at, evento_id), igrejas(nome), distritos(nome)')
      .order('created_at', { ascending: true });

    if (eventId) {
      query = query.eq('evento_id', eventId);
    }

    const { data: participantes, error } = await query;
    if (error) {
      return { success: false, count: 0, error: error.message };
    }

    const lista = (participantes || []) as ParticipanteRow[];

    const getDateKey = (value?: string | null) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toISOString().slice(0, 10);
    };

    const eventIds = new Set<string>();
    if (eventId) {
      eventIds.add(eventId);
    } else {
      lista.forEach((row) => {
        const id = row.evento_id || row.inscricoes?.evento_id;
        if (id) eventIds.add(id);
      });
    }

    const lotesByEvento = new Map<string, Array<{ id: string; inicio: string; fim: string }>>();
    const eventIdList = Array.from(eventIds);
    if (eventIdList.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < eventIdList.length; i += chunkSize) {
        const chunk = eventIdList.slice(i, i + chunkSize);
        const { data: lotesData, error: lotesError } = await supabase
          .from('lotes')
          .select('id, evento_id, inicio, fim')
          .in('evento_id', chunk)
          .order('inicio', { ascending: true });

        if (lotesError) {
          return { success: false, count: 0, error: lotesError.message };
        }

        (lotesData || []).forEach((lote) => {
          const list = lotesByEvento.get(lote.evento_id) || [];
          list.push({ id: lote.id, inicio: lote.inicio, fim: lote.fim });
          lotesByEvento.set(lote.evento_id, list);
        });
      }
    }

    lotesByEvento.forEach((list) => list.sort((a, b) => a.inicio.localeCompare(b.inicio)));

    const resolveLoteId = (row: ParticipanteRow) => {
      const eventKey = row.evento_id || row.inscricoes?.evento_id || eventId;
      if (!eventKey) return null;
      const lotesEvento = lotesByEvento.get(eventKey);
      if (!lotesEvento || lotesEvento.length === 0) return null;
      const dataBase = getDateKey(row.inscricoes?.created_at || row.created_at);
      if (!dataBase) return null;
      const lote = lotesEvento.find((item) => dataBase >= item.inicio && dataBase <= item.fim);
      return lote?.id || null;
    };

    const { data: existingInscritos } = await supabase
      .from('inscritos')
      .select('numero, numero_original')
      .eq('user_id', user.id);

    const existingSet = new Set(
      (existingInscritos || [])
        .map((row) => row.numero_original)
        .filter((value) => !!value),
    );

    const maxNumero = Math.max(
      0,
      ...(existingInscritos || []).map((row) => row.numero || 0),
    );

    const novos = lista.filter((row) => !existingSet.has(row.id));
    if (novos.length === 0) {
      return { success: true, count: 0 };
    }

    const inscritosApi = novos.map((row, index) => ({
      user_id: user.id,
      numero: maxNumero + index + 1,
      nome: String(row.nome || `Participante ${maxNumero + index + 1}`),
      data_nascimento: row.nascimento || null,
      idade: row.nascimento ? calcularIdade(row.nascimento) : 0,
      igreja: row.igrejas?.nome || 'Não informado',
      distrito: row.distritos?.nome || 'Não informado',
      foto_url: null,
      status_pagamento: mapStatus(row.inscricoes?.status),
      is_manual: false,
      numero_original: row.id,
      lote_id: resolveLoteId(row),
      numero_pulseira: String(maxNumero + index + 1),
    }));

    const { error: insertError } = await supabase
      .from('inscritos')
      .insert(inscritosApi);
    if (insertError) {
      return { success: false, count: 0, error: insertError.message };
    }

    return { success: true, count: inscritosApi.length };
  } catch (error) {
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}
