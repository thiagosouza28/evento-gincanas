import * as asaas from "./providers/asaas.ts";
import * as mercadopago from "./providers/mercadopago.ts";
import * as stripe from "./providers/stripe.ts";
import type {
  CheckStatusInput,
  CreatePaymentInput,
  PaymentProviderDriver,
  ProviderPaymentResult,
  ProviderRefundResult,
  ProviderStatusResult,
  RefundInput,
} from "./providers/types.ts";

const providers: Record<string, PaymentProviderDriver> = {
  mercadopago,
  stripe,
  asaas,
};

export function normalizeProviderName(provider: string | null | undefined) {
  return String(provider || "mercadopago").trim().toLowerCase();
}

export function resolveProviderDriver(provider: string) {
  const normalizedProvider = normalizeProviderName(provider);
  const driver = providers[normalizedProvider];
  if (!driver) {
    throw new Error(`Payment provider not supported: ${normalizedProvider}`);
  }
  return { driver, normalizedProvider };
}

export async function createPaymentByProvider(
  provider: string,
  input: CreatePaymentInput,
): Promise<ProviderPaymentResult> {
  const { driver } = resolveProviderDriver(provider);
  return driver.createPayment(input);
}

export async function checkStatusByProvider(
  provider: string,
  input: CheckStatusInput,
): Promise<ProviderStatusResult> {
  const { driver } = resolveProviderDriver(provider);
  return driver.checkStatus(input);
}

export async function refundByProvider(
  provider: string,
  input: RefundInput,
): Promise<ProviderRefundResult> {
  const { driver } = resolveProviderDriver(provider);
  return driver.refund(input);
}
