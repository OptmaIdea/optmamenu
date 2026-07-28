import type {
  ProductItemPricingSnapshot,
  ProductPurchaseHistoryItem,
  SalesPricingSummary,
  PricingSourceSalesSummary,
  PurchaseCostSummary,
  EstimatedMarginSummary,
} from '../../types/productPricingHistory.types';

/**
 * Converte um item de pedido em ProductItemPricingSnapshot normalizado.
 * Preserva compatibilidade com vendas legadas e efetua verificação de consistência.
 */
export function normalizeOrderItemSnapshot(item: {
  id: string;
  order_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  commercial_metadata?: Record<string, unknown> | null;
  orders?: {
    id: string;
    order_code?: string | null;
    sales_channel?: string | null;
    created_at: string;
    completed_at?: string | null;
  } | null;
}): ProductItemPricingSnapshot {
  const meta = item.commercial_metadata ?? {};
  const order = item.orders;

  const quantity = Math.max(1, Number(meta.quantity ?? item.quantity ?? 1));
  const basePrice = Number(meta.base_price ?? meta.original_unit_price ?? item.unit_price ?? 0);
  const effectiveUnitPrice = Number(meta.effective_unit_price ?? meta.unit_price ?? item.unit_price ?? 0);
  const grossSubtotal = Number(meta.gross_subtotal ?? quantity * basePrice);
  const netSubtotal = Number(meta.net_subtotal ?? quantity * effectiveUnitPrice);
  const discountTotal = Number(meta.discount_total ?? meta.discount ?? Math.max(0, grossSubtotal - netSubtotal));
  const unitDiscount = Number(meta.unit_discount ?? (quantity > 0 ? discountTotal / quantity : 0));

  // Verificação leve de consistência contábil (tolerância de 2 centavos para arredondamentos)
  const expectedNet = quantity * effectiveUnitPrice;
  if (Math.abs(netSubtotal - expectedNet) > 0.05) {
    if (import.meta.env.DEV) {
      console.warn(
        `Inconsistência leve detectada no item de pedido ${item.id}: net_subtotal = ${netSubtotal}, esperado = ${expectedNet}`
      );
    }
  }

  const rawSource = meta.pricing_source ? String(meta.pricing_source) : null;
  const pricingSource = (rawSource || 'unregistered_legacy') as ProductItemPricingSnapshot['pricing_source'];

  const categoryNameSnapshot = (meta.category_name_snapshot ?? meta.category_name ?? null) as string | null;
  const pricingGroupNameSnapshot = (meta.pricing_group_name_snapshot ?? meta.pricing_group_name ?? null) as string | null;
  const ruleNameSnapshot = (meta.rule_name_snapshot ?? meta.rule_name ?? null) as string | null;

  return {
    order_id: item.order_id,
    order_code: order?.order_code ?? null,
    order_item_id: item.id,
    product_id: (meta.product_id as string) || '',
    product_name_snapshot: (meta.product_name_snapshot as string) || (meta.name as string) || '',
    sales_channel: order?.sales_channel || (meta.sales_channel as string) || 'outros',
    sold_at: order?.completed_at || order?.created_at || new Date().toISOString(),
    base_price: basePrice,
    effective_unit_price: effectiveUnitPrice,
    unit_price: effectiveUnitPrice,
    quantity,
    gross_subtotal: grossSubtotal,
    unit_discount: unitDiscount,
    discount_total: discountTotal,
    discount: discountTotal,
    net_subtotal: netSubtotal,
    pricing_source: pricingSource,
    pricing_origin_label: (meta.pricing_origin_label as string) || getPricingOriginLabel(pricingSource),
    category_id: (meta.category_id as string) || null,
    category_name_snapshot: categoryNameSnapshot,
    pricing_group_id: (meta.pricing_group_id as string) || null,
    pricing_group_name_snapshot: pricingGroupNameSnapshot,
    rule_id: (meta.rule_id as string) || null,
    rule_name_snapshot: ruleNameSnapshot,
    applied_tier_min_quantity: meta.applied_tier_min_quantity ? Number(meta.applied_tier_min_quantity) : null,
    applied_tier_price: meta.applied_tier_price ? Number(meta.applied_tier_price) : null,
    snapshot_version: (meta.snapshot_version as string) || '1.0',
  };
}

export function getPricingOriginLabel(source?: string | null): string {
  if (!source) return 'Origem não registrada';
  switch (source) {
    case 'pricing_group_combined_volume':
      return 'Grupo de precificação por quantidade';
    case 'category_combined_volume':
      return 'Categoria por quantidade combinada';
    case 'category_per_product_volume':
      return 'Categoria por quantidade do produto';
    case 'category_standard':
      return 'Preço herdado da categoria';
    case 'product_volume':
      return 'Faixa de atacado do produto';
    case 'product_standard':
    case 'product_base_price':
      return 'Preço próprio do produto';
    case 'custom_manual':
      return 'Preço ajustado manualmente';
    case 'unregistered_legacy':
      return 'Origem não registrada';
    default:
      return 'Origem não registrada';
  }
}

/**
 * Calcula o resumo geral e estatísticas de vendas de um conjunto de snapshots.
 * Todos os cálculos são rigorosamente ponderados pela quantidade.
 */
export function calculateSalesPricingSummary(
  snapshots: ProductItemPricingSnapshot[]
): {
  summary: SalesPricingSummary;
  bySource: PricingSourceSalesSummary[];
} {
  if (snapshots.length === 0) {
    return {
      summary: {
        total_quantity_sold: 0,
        sales_count: 0,
        total_gross_revenue: 0,
        total_discount: 0,
        total_net_revenue: 0,
        overall_weighted_average_base_price: 0,
        overall_weighted_average_effective_price: 0,
      },
      bySource: [],
    };
  }

  let totalQty = 0;
  let totalGross = 0;
  let totalDiscount = 0;
  let totalNet = 0;

  // Agrupamento por chave estável
  const groupMap = new Map<
    string,
    {
      source: string;
      label: string;
      category_name_snapshot?: string | null;
      pricing_group_name_snapshot?: string | null;
      rule_name_snapshot?: string | null;
      applied_tier_min_quantity?: number | null;
      applied_tier_price?: number | null;
      qty: number;
      gross: number;
      discount: number;
      net: number;
      salesCount: number;
    }
  >();

  for (const s of snapshots) {
    totalQty += s.quantity;
    totalGross += s.gross_subtotal;
    totalDiscount += s.discount_total;
    totalNet += s.net_subtotal;

    // Chave estável para o agrupamento
    const groupKey = [
      s.pricing_source,
      s.pricing_group_id || '',
      s.category_id || '',
      s.rule_id || '',
      s.applied_tier_min_quantity ?? '',
    ].join('::');

    const existing = groupMap.get(groupKey);
    if (existing) {
      existing.qty += s.quantity;
      existing.gross += s.gross_subtotal;
      existing.discount += s.discount_total;
      existing.net += s.net_subtotal;
      existing.salesCount += 1;
    } else {
      groupMap.set(groupKey, {
        source: s.pricing_source,
        label: s.pricing_origin_label,
        category_name_snapshot: s.category_name_snapshot,
        pricing_group_name_snapshot: s.pricing_group_name_snapshot,
        rule_name_snapshot: s.rule_name_snapshot,
        applied_tier_min_quantity: s.applied_tier_min_quantity,
        applied_tier_price: s.applied_tier_price,
        qty: s.quantity,
        gross: s.gross_subtotal,
        discount: s.discount_total,
        net: s.net_subtotal,
        salesCount: 1,
      });
    }
  }

  const bySource: PricingSourceSalesSummary[] = Array.from(groupMap.entries()).map(
    ([groupKey, val]) => {
      const weightedAvgPrice = val.qty > 0 ? val.net / val.qty : 0;
      const avgBasePrice = val.qty > 0 ? val.gross / val.qty : 0;
      const revenueShare = totalNet > 0 ? (val.net / totalNet) * 100 : 0;

      return {
        pricing_source: val.source,
        origin_label: val.label,
        group_key: groupKey,
        category_name_snapshot: val.category_name_snapshot,
        pricing_group_name_snapshot: val.pricing_group_name_snapshot,
        rule_name_snapshot: val.rule_name_snapshot,
        applied_tier_min_quantity: val.applied_tier_min_quantity,
        applied_tier_price: val.applied_tier_price,
        total_quantity_sold: val.qty,
        sales_count: val.salesCount,
        average_base_price: avgBasePrice,
        weighted_average_price: weightedAvgPrice,
        gross_revenue: val.gross,
        total_discount: val.discount,
        net_revenue: val.net,
        revenue_share_percentage: revenueShare,
      };
    }
  );

  // Ordenar grupos por maior receita líquida
  bySource.sort((a, b) => b.net_revenue - a.net_revenue);

  return {
    summary: {
      total_quantity_sold: totalQty,
      sales_count: snapshots.length,
      total_gross_revenue: totalGross,
      total_discount: totalDiscount,
      total_net_revenue: totalNet,
      overall_weighted_average_base_price: totalQty > 0 ? totalGross / totalQty : 0,
      overall_weighted_average_effective_price: totalQty > 0 ? totalNet / totalQty : 0,
    },
    bySource,
  };
}

/**
 * Calcula o resumo de custos de compra de um conjunto de registros de compra.
 * Rigorosamente ponderado pela quantidade recebida.
 */
export function calculatePurchaseCostSummary(
  purchases: ProductPurchaseHistoryItem[]
): PurchaseCostSummary {
  if (purchases.length === 0) {
    return {
      total_quantity_purchased: 0,
      purchases_count: 0,
      total_purchased_value: 0,
      weighted_average_purchase_cost: 0,
      min_unit_cost: null,
      max_unit_cost: null,
    };
  }

  let totalQty = 0;
  let totalValue = 0;
  let minCost: number | null = null;
  let maxCost: number | null = null;

  for (const p of purchases) {
    const qty = Math.max(0, p.received_quantity);
    const cost = Math.max(0, p.unit_cost);
    totalQty += qty;
    totalValue += qty * cost;

    if (minCost === null || cost < minCost) minCost = cost;
    if (maxCost === null || cost > maxCost) maxCost = cost;
  }

  return {
    total_quantity_purchased: totalQty,
    purchases_count: purchases.length,
    total_purchased_value: totalValue,
    weighted_average_purchase_cost: totalQty > 0 ? totalValue / totalQty : 0,
    min_unit_cost: minCost,
    max_unit_cost: maxCost,
  };
}

/**
 * Calcula estimativas de margem entre preço médio de venda e custo médio de compra.
 */
export function calculateEstimatedMargin(
  overallWeightedSalePrice: number,
  weightedAveragePurchaseCost: number
): EstimatedMarginSummary {
  const hasSaleData = overallWeightedSalePrice > 0;
  const hasPurchaseData = weightedAveragePurchaseCost > 0;

  if (!hasSaleData || !hasPurchaseData) {
    return {
      overall_weighted_sale_price: overallWeightedSalePrice,
      weighted_average_purchase_cost: weightedAveragePurchaseCost,
      unit_margin: 0,
      margin_percentage_on_sale: 0,
      markup_percentage_on_cost: 0,
      has_sale_data: hasSaleData,
      has_purchase_data: hasPurchaseData,
    };
  }

  const unitMargin = overallWeightedSalePrice - weightedAveragePurchaseCost;
  const marginPercentOnSale = (unitMargin / overallWeightedSalePrice) * 100;
  const markupPercentOnCost = (unitMargin / weightedAveragePurchaseCost) * 100;

  return {
    overall_weighted_sale_price: overallWeightedSalePrice,
    weighted_average_purchase_cost: weightedAveragePurchaseCost,
    unit_margin: unitMargin,
    margin_percentage_on_sale: marginPercentOnSale,
    markup_percentage_on_cost: markupPercentOnCost,
    has_sale_data: hasSaleData,
    has_purchase_data: hasPurchaseData,
  };
}
