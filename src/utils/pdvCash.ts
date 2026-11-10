/**
 * Interpreta o valor entregue ao caixa sem arredondar entradas malformadas.
 * Aceita formato brasileiro (1.234,56) ou decimal simples (1234.56).
 */
export function parsePdvCashAmount(input: string): number | null {
  const text = input.trim().replace(/^R\$\s*/i, '').replace(/\s+/g, '');
  if (!text) return null;

  const isBrazilian = /^(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(text);
  const isSimpleDotDecimal = /^\d+\.\d{1,2}$/.test(text);
  if (!isBrazilian && !isSimpleDotDecimal) return null;

  const normalized = isBrazilian ? text.replace(/\./g, '').replace(',', '.') : text;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000_000
    ? Math.round(value * 100) / 100
    : null;
}
