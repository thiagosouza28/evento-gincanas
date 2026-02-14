const KNOWN_PAYMENT_STATUSES = ['PAID', 'PENDING', 'CANCELLED', 'MANUAL'] as const;

type PaymentStatus = (typeof KNOWN_PAYMENT_STATUSES)[number];

export function normalizePagamentoStatus(status: string | null | undefined): PaymentStatus {
  if (!status || typeof status !== 'string') return 'PENDING';

  const cleanStatus = status.replace(/[^\x20-\x7E]/g, '').toUpperCase().trim();

  if (cleanStatus.includes('PAID') || cleanStatus.includes('PAGO')) return 'PAID';
  if (cleanStatus.includes('CANCEL')) return 'CANCELLED';
  if (cleanStatus.includes('MANUAL')) return 'MANUAL';
  if (cleanStatus.includes('PENDING') || cleanStatus.includes('PEND')) return 'PENDING';

  if ((KNOWN_PAYMENT_STATUSES as readonly string[]).includes(cleanStatus)) {
    return cleanStatus as PaymentStatus;
  }

  return 'PENDING';
}

export function isPagamentoBloqueadoParaSorteioEquipe(status: string | null | undefined): boolean {
  const normalized = normalizePagamentoStatus(status);
  return normalized === 'PENDING' || normalized === 'CANCELLED';
}

export function getMensagemBloqueioSorteioEquipe(status: string | null | undefined): string | null {
  const normalized = normalizePagamentoStatus(status);

  if (normalized === 'PENDING') {
    return 'Pagamento pendente. Este participante não pode ser sorteado para uma equipe.';
  }

  if (normalized === 'CANCELLED') {
    return 'Pagamento cancelado. Este participante não pode ser sorteado para uma equipe.';
  }

  return null;
}
