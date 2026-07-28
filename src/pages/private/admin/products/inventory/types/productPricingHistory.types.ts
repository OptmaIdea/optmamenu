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
  discount: number;
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
 * Resumo de vendas por origem/regra de precificação.
 */
export interface PricingSourceSalesSummary {
  pricing_source: string;
  origin_label: string;
  total_quantity_sold: number;
  gross_revenue: number;
  total_discount: number;
  net_revenue: number;
  weighted_average_price: number;
  sales_count: number;
}

/**
 * Resumo consolidado de preços e margens para a aba da Vida do Produto.
 */
export interface ProductPricingAnalysisSummary {
  product_id: string;
  product_name: string;
  current_base_price: number;
  period_start?: string;
  period_end?: string;
  total_quantity_sold: number;
  total_gross_revenue: number;
  total_discount: number;
  total_net_revenue: number;
  overall_weighted_average_price: number;
  total_cost_of_goods_sold?: number;
  weighted_average_cost?: number;
  overall_margin_percentage?: number;
  by_pricing_source: PricingSourceSalesSummary[];
  recent_sales_snapshots: ProductItemPricingSnapshot[];
}
