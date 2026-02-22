export type PriceRule = {
  min: number;
  price: number;
};

/**
 * Returns the applicable price for a given quantity based on ordered tiers.
 * If no rules exist, returns undefined.
 */
export function getPriceForQuantity(rules: PriceRule[] | undefined, quantity: number): number | undefined {
  if (!rules || rules.length === 0) return undefined;

  const q = Math.max(1, Number.isFinite(quantity) ? quantity : 1);
  // Choose the highest min that is <= quantity
  const sorted = [...rules].sort((a, b) => a.min - b.min);
  let applicable = sorted[0];
  for (const rule of sorted) {
    if (q >= rule.min) applicable = rule;
    else break;
  }
  return applicable?.price;
}

export function formatBRL(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toFixed(2).replace('.', ',');
}
