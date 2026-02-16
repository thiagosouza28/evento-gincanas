import { supabase } from '@/integrations/supabase/client';
import type { PaymentIntegration } from '@/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const API_BASE_URL = `${SUPABASE_URL}/functions/v1/api`;

export interface PaymentIntegrationPayload {
  provider: string;
  access_token?: string | null;
  public_key?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  webhook_secret?: string | null;
  is_active?: boolean;
}

interface IntegrationApiRow {
  id: string;
  user_id: string;
  provider: string;
  access_token: string | null;
  public_key: string | null;
  client_id: string | null;
  client_secret: string | null;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function mapIntegration(row: IntegrationApiRow): PaymentIntegration {
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    accessToken: row.access_token,
    publicKey: row.public_key,
    clientId: row.client_id,
    clientSecret: row.client_secret,
    webhookSecret: row.webhook_secret,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Usuário não autenticado');
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

export async function listPaymentIntegrations() {
  const data = await apiRequest<{ integrations: IntegrationApiRow[] }>('/integrations', {
    method: 'GET',
  });
  return (data.integrations || []).map(mapIntegration);
}

export async function createPaymentIntegration(payload: PaymentIntegrationPayload) {
  const data = await apiRequest<{ integration: IntegrationApiRow }>('/integrations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapIntegration(data.integration);
}

export async function updatePaymentIntegration(
  integrationId: string,
  payload: Partial<PaymentIntegrationPayload>
) {
  const data = await apiRequest<{ integration: IntegrationApiRow }>(`/integrations/${integrationId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return mapIntegration(data.integration);
}

export async function deletePaymentIntegration(integrationId: string) {
  await apiRequest<{ ok: boolean }>(`/integrations/${integrationId}`, {
    method: 'DELETE',
  });
}

export async function activatePaymentIntegration(integrationId: string) {
  const data = await apiRequest<{ integration: IntegrationApiRow }>(
    `/integrations/${integrationId}/activate`,
    {
      method: 'PUT',
    }
  );
  return mapIntegration(data.integration);
}
