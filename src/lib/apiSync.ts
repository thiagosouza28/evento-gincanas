import type { Inscrito } from '@/types';
import { calcularIdade } from '@/types';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function getFunctionHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || SUPABASE_PUBLISHABLE_KEY;

  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

interface ApiInscrito {
  numero: string;
  nome: string;
  dataNascimento: string | null;
  idade: number;
  igreja: string;
  distrito: string;
  fotoUrl: string | null;
  status: string;
  createdAt: string;
}

interface ApiResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  inscritos: ApiInscrito[];
}

export async function syncInscritos(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    console.log('Iniciando sincronização com banco MySQL...');
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('Usuário não autenticado');
    }
    
    // Usar Edge Function como proxy para conectar ao MySQL
    const { data, error } = await supabase.functions.invoke('api-proxy', {
      headers: await getFunctionHeaders(),
    });

    if (error) {
      throw new Error(`Erro na API: ${error.message}`);
    }

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
    const apiInscritos: { user_id: string; numero: number; nome: string; data_nascimento: string | null; idade: number; igreja: string; distrito: string; foto_url: string | null; status_pagamento: string; is_manual: boolean; numero_original: string; numero_pulseira: string }[] = registrations.map((reg, index) => {
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
    const { data, error } = await supabase.functions.invoke('api-proxy', {
      headers: await getFunctionHeaders(),
    });

    if (error) {
      throw new Error(`Erro: ${error.message}`);
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro de conexão' 
    };
  }
}
