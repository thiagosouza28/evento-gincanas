import type { Inscrito } from '@/types';
import { calcularIdade } from '@/types';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface ApiInscrito {
  numero: string;
  nome: string;
  dataNascimento: string | null;
  idade: number;
  igreja: string;
  distrito: string;
  fotoUrl: string | null;
  status: string;
  loteId?: string | null;
  loteNome?: string | null;
  loteInicio?: string | null;
  loteFim?: string | null;
  createdAt: string;
}

interface ApiResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  inscritos: ApiInscrito[];
}

const DEFAULT_SYNC_STATUSES: Array<'PAID' | 'PENDING' | 'CANCELLED'> = ['PAID', 'PENDING', 'CANCELLED'];

async function callApiProxy(body?: Record<string, unknown>) {
  let lastError: Error | null = null;
  try {
    const { data, error } = await supabase.functions.invoke('api-proxy', {
      body,
    });
    if (!error) {
      return data;
    }
    lastError = new Error(error.message);
  } catch (error) {
    lastError = error instanceof Error ? error : new Error('Erro ao chamar api-proxy');
  }

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  try {
    const response = await fetch(`${baseUrl}/functions/v1/api-proxy`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Erro na API: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (lastError) {
      throw lastError;
    }
    throw error instanceof Error ? error : new Error('Erro ao chamar api-proxy');
  }
}

export async function syncInscritos(
  eventId?: string,
  syncStatuses?: Array<'PAID' | 'PENDING' | 'CANCELLED'>
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log('Iniciando sincronização com banco MySQL...');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }
    
    // Usar Edge Function como proxy para conectar ao MySQL
    const storedConfig = localStorage.getItem('apiConfig');
    const parsedConfig = storedConfig ? JSON.parse(storedConfig) : {};
    const configEventId = parsedConfig.eventId as string | undefined;
    const configStatuses = parsedConfig.syncStatuses as Array<'PAID' | 'PENDING' | 'CANCELLED'> | undefined;
    const effectiveEventId = eventId || configEventId || undefined;
    const effectiveStatuses = (syncStatuses && syncStatuses.length > 0)
      ? syncStatuses
      : (configStatuses && configStatuses.length > 0 ? configStatuses : DEFAULT_SYNC_STATUSES);

    const data = await callApiProxy({
      eventId: effectiveEventId,
      statuses: effectiveStatuses,
    });

    console.log('Resposta recebida:', data);

    // A API retorna no formato { inscritos: [...] }
    const response = data as ApiResponse;
    const registrations: ApiInscrito[] = response.inscritos || [];

    console.log(`${registrations.length} inscritos encontrados no banco externo`);

    // Buscar inscritos manuais existentes para preservá-los
    const { data: existingInscritos } = await supabase
      .from('inscritos')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_manual', true);

    const manualInscritos = existingInscritos || [];

    // Mapear inscritos do banco MySQL
    const apiInscritos: { user_id: string; numero: number; nome: string; data_nascimento: string | null; idade: number; igreja: string; distrito: string; foto_url: string | null; status_pagamento: string; is_manual: boolean; numero_original: string; numero_pulseira: string; lote_externo_id?: string | null; lote_externo_nome?: string | null }[] = registrations.map((reg, index) => {
      // Mapear status do banco para nosso enum
      const mapStatus = (status: string): 'PAID' | 'PENDING' | 'CANCELLED' => {
        const upperStatus = status?.toUpperCase() || '';
        if (upperStatus === 'PAID' || upperStatus === 'APPROVED') return 'PAID';
        if (upperStatus === 'CANCELLED' || upperStatus === 'CANCELED') return 'CANCELLED';
        return 'PENDING';
      };

      return {
        user_id: user.id,
        numero: index + 1, // Numeração sequencial começando em 1
        nome: String(reg.nome || `Participante ${index + 1}`),
        data_nascimento: reg.dataNascimento ? reg.dataNascimento.split('T')[0] : null,
        idade: reg.idade || calcularIdade(reg.dataNascimento || '2000-01-01'),
        igreja: String(reg.igreja || 'Não informado'),
        distrito: String(reg.distrito || 'Não informado'),
        foto_url: reg.fotoUrl || null,
        status_pagamento: mapStatus(reg.status),
        is_manual: false,
        numero_original: reg.numero, // Preservar ID original do banco
        numero_pulseira: String(index + 1), // Numero da pulseira = numero da lista
        lote_externo_id: reg.loteId || null,
        lote_externo_nome: reg.loteNome || null,
      };
    });

    // Renumerar inscritos manuais após os da API
    const startManualNumber = apiInscritos.length + 1;
    const renumberedManual = manualInscritos.map((inscrito, index) => ({
      user_id: user.id,
      numero: startManualNumber + index,
      nome: inscrito.nome,
      data_nascimento: inscrito.data_nascimento,
      idade: inscrito.idade || 0,
      igreja: inscrito.igreja || 'Não informado',
      distrito: inscrito.distrito || 'Não informado',
      foto_url: inscrito.foto_url,
      status_pagamento: inscrito.status_pagamento || 'MANUAL',
      is_manual: true,
      numero_original: inscrito.numero_original || null,
      numero_pulseira: String(startManualNumber + index),
      lote_externo_id: inscrito.lote_externo_id || null,
      lote_externo_nome: inscrito.lote_externo_nome || null,
    }));

    // Deletar todos os inscritos não-manuais do usuário
    await supabase
      .from('inscritos')
      .delete()
      .eq('user_id', user.id)
      .eq('is_manual', false);

    // Deletar e reinserir manuais com novos números
    if (manualInscritos.length > 0) {
      await supabase
        .from('inscritos')
        .delete()
        .eq('user_id', user.id)
        .eq('is_manual', true);
    }

    // Inserir todos os inscritos
    const allInscritos = [...apiInscritos, ...renumberedManual];
    
    if (allInscritos.length > 0) {
      const { error: insertError } = await supabase
        .from('inscritos')
        .insert(allInscritos);

      if (insertError) {
        throw new Error(`Erro ao salvar inscritos: ${insertError.message}`);
      }
    }
    
    // Atualizar timestamp da última sincronização no localStorage
    localStorage.setItem('apiConfig', JSON.stringify({
      baseUrl: 'mysql-database',
      token: '',
      lastSync: new Date().toISOString(),
      eventId: effectiveEventId,
      syncStatuses: effectiveStatuses,
    }));

    console.log(`Sincronização concluída: ${allInscritos.length} inscritos salvos`);

    return { success: true, count: allInscritos.length };
  } catch (error) {
    console.error('Erro ao sincronizar inscritos:', error);
    return { 
      success: false, 
      count: 0, 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    };
  }
}

export async function testApiConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    await callApiProxy({ action: 'list-tables' });

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro de conexão' 
    };
  }
}

export async function fetchEventos(): Promise<Array<{ id: string; name: string }>> {
  const normalizeEvents = (payload: unknown) => {
    const response = payload as { events?: Array<{ id: string | number; name?: string | null }> };
    const events = Array.isArray(response?.events) ? response.events : [];
    return events.map((event) => ({
      id: String(event.id),
      name: event.name ? String(event.name) : String(event.id),
    }));
  };

  try {
    const data = await callApiProxy({ action: 'events' });
    const list = normalizeEvents(data);
    if (list.length > 0) {
      return list;
    }
  } catch (error) {
    console.error('Erro ao buscar eventos:', error);
    return [];
  }

  return [];
}
