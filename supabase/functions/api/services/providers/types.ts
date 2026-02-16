export interface ProviderCredentials {
  access_token?: string | null;
  public_key?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  webhook_secret?: string | null;
}

export interface CreatePaymentInput {
  amount: number;
  description: string;
  cpf: string;
  name: string;
  metadata?: Record<string, unknown>;
  webhookUrl: string;
  credentials: ProviderCredentials;
}

export interface CheckStatusInput {
  providerPaymentId: string;
  credentials: ProviderCredentials;
}

export interface RefundInput {
  providerPaymentId: string;
  amount?: number;
  credentials: ProviderCredentials;
}

export interface ProviderPaymentResult {
  providerPaymentId: string;
  status: string;
  copyAndPaste?: string | null;
  qrCodeBase64?: string | null;
  expiresAt?: string | null;
  raw?: any;
}

export interface ProviderStatusResult {
  status: string;
  raw?: any;
}

export interface ProviderRefundResult {
  status: string;
  raw?: any;
}

export interface PaymentProviderDriver {
  createPayment(input: CreatePaymentInput): Promise<ProviderPaymentResult>;
  checkStatus(input: CheckStatusInput): Promise<ProviderStatusResult>;
  refund(input: RefundInput): Promise<ProviderRefundResult>;
}
