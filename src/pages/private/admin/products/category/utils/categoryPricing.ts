export type PriceRule = { min: number; price: number };

/**
 * For STANDARD categories we store a single base price rule as min=0.
 * This helper returns that base price (or null if missing/invalid).
 */
export function getStandardPrice(rules?: PriceRule[] | null): number | null {
  if (!rules || rules.length === 0) return null;
  const base = rules.find((r) => Number(r.min) === 0);
  const price = base?.price;
  return typeof price === 'number' && Number.isFinite(price) ? price : null;
}

/**
 * For VOLUME categories (or any rules list), returns the maximum rule price.
 * Useful for display summaries.
 */
export function getMaxRulePrice(rules?: PriceRule[] | null): number | null {
  if (!rules || rules.length === 0) return null;
  let max: number | null = null;
  for (const r of rules) {
    const p = r?.price;
    if (typeof p === 'number' && Number.isFinite(p)) {
      max = max === null ? p : Math.max(max, p);
    }
  }
  return max;
}
