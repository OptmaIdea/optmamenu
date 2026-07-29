/**
 * Snapshot histórico de precificação de um item de pedido/venda.
 * Preservado autoritativamente no momento da conclusão de cada venda.
 */
export interface ProductItemPricingSnapshot {
  order_id: string;
  order_code: string | null;
  order_item_id: string;
  product_id: string;
  product_name_snapshot: string;
  sales_channel: string;
  sold_at: string;
  base_price: number;
  effective_unit_price: number;
  unit_price: number;
  quantity: number;
  gross_subtotal: number;
  unit_discount: number;
  discount_total: number;
  discount: number; // Mantido por compatibilidade como o desconto total da linha
  net_subtotal: number;
  pricing_source:
    | 'product_base_price'
    | 'product_standard'
    | 'product_volume'
    | 'category_standard'
    | 'category_combined_volume'
    | 'category_per_product_volume'
    | 'pricing_group_combined_volume'
    | 'custom_manual'
    | 'unregistered_legacy';
  pricing_origin_label: string;
  category_id?: string | null;
  category_name_snapshot?: string | null;
  pricing_group_id?: string | null;
  pricing_group_name_snapshot?: string | null;
  rule_id?: string | null;
  rule_name_snapshot?: string | null;
  applied_tier_min_quantity?: number | null;
  applied_tier_price?: number | null;
  snapshot_version?: string;
}

/**
 * Item de entrada de compra recebido e confirmado.
 */
export interface ProductPurchaseHistoryItem {
  id: string;
  purchase_document_id: string;
  document_number: string | null;
  invoice_number: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  entry_date: string;
  received_quantity: number;
  unit_cost: number;
  total_cost: number;
  location_id?: string | null;
  location_name?: string | null;
  status: 'confirmed';
}

/**
 * Resumo de vendas por origem/regra de precificação.
 */
export interface PricingSourceSalesSummary {
  pricing_source: string;
  origin_label: string;
  group_key: string;
  category_name_snapshot?: string | null;
  pricing_group_name_snapshot?: string | null;
  rule_name_snapshot?: string | null;
  applied_tier_min_quantity?: number | null;
  applied_tier_price?: number | null;
  total_quantity_sold: number;
  sales_count: number;
  average_base_price: number;
  weighted_average_price: number;
  gross_revenue: number;
  total_discount: number;
  net_revenue: number;
  revenue_share_percentage: number;
}

/**
 * Resumo de vendas de um determinado período.
 */
export interface SalesPricingSummary {
  total_quantity_sold: number;
  sales_count: number;
  total_gross_revenue: number;
  total_discount: number;
  total_net_revenue: number;
  overall_weighted_average_base_price: number;
  overall_weighted_average_effective_price: number;
}

/**
 * Resumo de compras de um determinado período.
 */
export interface PurchaseCostSummary {
  total_quantity_purchased: number;
  purchases_count: number;
  total_purchased_value: number;
  weighted_average_purchase_cost: number;
  min_unit_cost: number | null;
  max_unit_cost: number | null;
}

/**
 * Análise de margem estimada entre venda e compra.
 */
export interface EstimatedMarginSummary {
  overall_weighted_sale_price: number;
  weighted_average_purchase_cost: number;
  unit_margin: number;
  margin_percentage_on_sale: number;
  markup_percentage_on_cost: number;
  has_sale_data: boolean;
  has_purchase_data: boolean;
}

/**
 * Tipo de período rápido para filtros.
 */
export type PricingHistoryPeriodPreset =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'last_week'
  | 'fortnight'
  | 'last_fortnight'
  | 'this_month'
  | 'current_month'
  | 'last_month'
  | 'last_7_days'
  | 'last_30_days'
  | 'all'
  | 'custom';

/**
 * Filtros locais para a aba de preços e margens.
 */
export interface PricingHistoryFiltersState {
  periodPreset: PricingHistoryPeriodPreset;
  startDate: string;
  endDate: string;
  salesChannel: string; // 'all' ou canal específico
  pricingSource: string; // 'all' ou origem específica
}
