import { describe, expect, it } from 'vitest';
import {
  calculateSalesPricingSummary,
  normalizeOrderItemSnapshot,
} from '@/pages/private/admin/products/inventory/pricing-history/utils/pricingHistoryCalculations';

describe('pricingHistoryCalculations', () => {
  it('reconciles a divergent metadata discount with gross and net revenue', () => {
    const snapshot = normalizeOrderItemSnapshot({
      id: 'item-abacaxi',
      order_id: 'order-abacaxi',
      quantity: 64,
      unit_price: 3.75,
      discount: 0.05,
      commercial_metadata: {
        quantity: 64,
        base_price: 3.75,
        effective_unit_price: 225 / 64,
        gross_subtotal: 240,
        net_subtotal: 225,
        discount_total: 0.05,
      },
      orders: {
        id: 'order-abacaxi',
        created_at: '2026-07-28T12:00:00Z',
      },
    });

    const { summary } = calculateSalesPricingSummary([snapshot]);

    expect(snapshot.discount_total).toBe(15);
    expect(snapshot.unit_discount).toBeCloseTo(15 / 64, 10);
    expect(summary.total_gross_revenue - summary.total_discount).toBeCloseTo(
      summary.total_net_revenue,
      2
    );
  });
});
