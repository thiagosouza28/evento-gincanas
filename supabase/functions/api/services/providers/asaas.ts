import type {
  CheckStatusInput,
  CreatePaymentInput,
  ProviderPaymentResult,
  ProviderRefundResult,
  ProviderStatusResult,
  RefundInput,
} from "./types.ts";

function notImplemented() {
  throw new Error(
    "Asaas provider integration is not implemented yet for this flow.",
  );
}

export async function createPayment(
  _input: CreatePaymentInput,
): Promise<ProviderPaymentResult> {
  notImplemented();
}

export async function checkStatus(
  _input: CheckStatusInput,
): Promise<ProviderStatusResult> {
  notImplemented();
}

export async function refund(_input: RefundInput): Promise<ProviderRefundResult> {
  notImplemented();
}
