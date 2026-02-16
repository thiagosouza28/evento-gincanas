import type {
  CheckStatusInput,
  CreatePaymentInput,
  ProviderPaymentResult,
  ProviderRefundResult,
  ProviderStatusResult,
  RefundInput,
} from "./types.ts";

const MERCADO_PAGO_API_BASE = "https://api.mercadopago.com";

function resolveAccessToken(inputToken?: string | null) {
  const token = inputToken || Deno.env.get("MERCADOPAGO_ACCESS_TOKEN") || "";
  if (!token) {
    throw new Error("Mercado Pago access token not configured");
  }
  return token;
}

function resolveWebhookUrl(baseWebhookUrl: string, webhookSecret?: string | null) {
  const url = new URL(baseWebhookUrl);
  if (webhookSecret) {
    url.searchParams.set("webhook_secret", webhookSecret);
  }
  return url.toString();
}

function mapPaymentPayload(responsePayload: any): ProviderPaymentResult {
  const transactionData = responsePayload?.point_of_interaction?.transaction_data || {};
  return {
    providerPaymentId: String(responsePayload?.id),
    status: String(responsePayload?.status || "pending"),
    copyAndPaste: transactionData?.qr_code || null,
    qrCodeBase64: transactionData?.qr_code_base64 || null,
    expiresAt: transactionData?.expiration_date || null,
    raw: responsePayload,
  };
}

export async function createPayment(input: CreatePaymentInput): Promise<ProviderPaymentResult> {
  const accessToken = resolveAccessToken(input.credentials.access_token);
  const idempotencyKey =
    (input.metadata?.inscricao_id ? `inscricao-${input.metadata.inscricao_id}` : null) ||
    crypto.randomUUID();

  const response = await fetch(`${MERCADO_PAGO_API_BASE}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: input.amount,
      description: input.description || "Inscricao",
      payment_method_id: "pix",
      notification_url: resolveWebhookUrl(
        input.webhookUrl,
        input.credentials.webhook_secret,
      ),
      date_of_expiration: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      payer: {
        email: `${input.cpf}@exemplo.com`,
        first_name: input.name?.split(" ")[0] || "Participante",
        last_name: input.name?.split(" ").slice(1).join(" ") || "",
        identification: {
          type: "CPF",
          number: input.cpf,
        },
      },
      metadata: input.metadata || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mercado Pago error: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return mapPaymentPayload(payload);
}

export async function checkStatus(input: CheckStatusInput): Promise<ProviderStatusResult> {
  const accessToken = resolveAccessToken(input.credentials.access_token);
  const response = await fetch(
    `${MERCADO_PAGO_API_BASE}/v1/payments/${input.providerPaymentId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mercado Pago status error: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return {
    status: String(payload?.status || "pending"),
    raw: payload,
  };
}

export async function refund(input: RefundInput): Promise<ProviderRefundResult> {
  const accessToken = resolveAccessToken(input.credentials.access_token);
  const response = await fetch(
    `${MERCADO_PAGO_API_BASE}/v1/payments/${input.providerPaymentId}/refunds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mercado Pago refund error: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  return {
    status: String(payload?.status || "processed"),
    raw: payload,
  };
}
