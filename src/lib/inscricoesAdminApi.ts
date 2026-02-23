import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API_BASE_URL = `${SUPABASE_URL}/functions/v1/api`;

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Usuario nao autenticado');
  }

  const headers = new Headers(init?.headers || {});
  headers.set('Content-Type', 'application/json');
  headers.set('apikey', SUPABASE_KEY);
  headers.set('Authorization', `Bearer ${session.access_token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error || `Erro na API (${response.status})`);
  }

  return payload as T;
}

export interface AdminInscricaoStatusPayload {
  inscricao: {
    id: string;
    status: string;
    total: number;
    confirmed_at: string | null;
    cancelled_at: string | null;
  };
  pagamento: {
    id: string;
    status: string;
    payment_method: string;
    transaction_id: string | null;
    paid_at: string | null;
    confirmed_at: string | null;
    refunded_at: string | null;
    refund_reason: string | null;
    comprovante_url: string | null;
  } | null;
}

export async function getAdminInscricaoStatus(inscricaoId: string) {
  return apiRequest<AdminInscricaoStatusPayload>(
    `/admin/inscricoes/${inscricaoId}/status`,
    { method: 'GET' },
  );
}

export async function gerarComprovanteInscricao(inscricaoId: string, forceRegenerate = false) {
  return apiRequest<{
    ok: boolean;
    generated: boolean;
    comprovante_url: string | null;
    comprovante_path: string | null;
    pagamento_id: string;
    inscricao_id: string;
  }>(`/admin/inscricoes/${inscricaoId}/comprovante`, {
    method: 'POST',
    body: JSON.stringify({ forceRegenerate }),
  });
}

export async function estornarPagamento(pagamentoId: string, reason: string) {
  return apiRequest<{
    ok: boolean;
    pagamento_id: string;
    inscricao_id: string;
    status: 'REFUNDED';
    refunded_at: string;
    refund_reason: string;
  }>(`/admin/pagamentos/${pagamentoId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
