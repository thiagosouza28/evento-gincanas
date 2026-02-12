export function stripNonDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function maskCpf(value: string) {
  const digits = stripNonDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let masked = part1;
  if (part2) masked += `.${part2}`;
  if (part3) masked += `.${part3}`;
  if (part4) masked += `-${part4}`;
  return masked;
}

export function maskPhone(value: string) {
  const digits = stripNonDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) {
    return `(${ddd}) ${rest}`;
  }
  if (rest.length <= 8) {
    const part1 = rest.slice(0, 4);
    const part2 = rest.slice(4);
    return `(${ddd}) ${part1}-${part2}`;
  }
  const part1 = rest.slice(0, 5);
  const part2 = rest.slice(5);
  return `(${ddd}) ${part1}-${part2}`;
}

export function maskCnpj(value: string) {
  const digits = stripNonDigits(value).slice(0, 14);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);
  let masked = part1;
  if (part2) masked += `.${part2}`;
  if (part3) masked += `.${part3}`;
  if (part4) masked += `/${part4}`;
  if (part5) masked += `-${part5}`;
  return masked;
}

export function parseCurrencyBR(value: string): number {
  if (!value) return 0;
  const cleaned = value
    .replace(/\s/g, '')
    .replace(/[R$]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatCurrencyBR(value: number, withSymbol: boolean = true): string {
  if (!Number.isFinite(value)) {
    return withSymbol ? 'R$ 0,00' : '0,00';
  }
  return new Intl.NumberFormat('pt-BR', {
    style: withSymbol ? 'currency' : 'decimal',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrencyInput(value: string): string {
  if (!value || !value.trim()) return '';
  const parsed = parseCurrencyBR(value);
  return formatCurrencyBR(parsed, false);
}
