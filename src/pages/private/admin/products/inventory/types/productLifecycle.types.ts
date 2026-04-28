// ─── Tipos gerenciais para a Vida do Produto (Fase 6) ────────────────────────

export type ProductLifecycleGlobalStatus =
  | 'product_inactive'
  | 'global_stockout'
  | 'global_critical'
  | 'global_attention'
  | 'global_excess'
  | 'global_ok'
  | string;

export type ProductLifecycleLocationStatus =
  | 'product_inactive'
  | 'location_inactive'
  | 'location_stockout'
  | 'location_critical'
  | 'location_excess'
  | 'location_ok'
  | 'monitor_only'
  | 'not_configured'
  | string;

export type ProductLifecycleRecommendedAction =
  | 'buy'
  | 'transfer'
  | 'monitor'
  | 'review_excess'
  | 'ok'
  | string;

export type ProductLifecycleSourceLocation = {
  location_id: string;
  location_code: string;
  location_name: string;
  available: number;
  on_hand: number;
  reserved: number;
  location_status: string;
};

export type ProductStockManagementRow = {
  store_id: string;
  product_id: string;
  product_name: string;
  category_id: string | null;
  product_active: boolean;
  discontinued: boolean;
  is_discontinued: boolean;

  location_id: string;
  location_code: string;
  location_name: string;
  location_type: string;
  location_active: boolean;
  is_default: boolean;
  allow_sales: boolean;
  allow_reservations: boolean;
  location_sort_order: number;

  on_hand: number;
  reserved: number;
  available: number;
  updated_at: string;

  global_on_hand: number;
  global_reserved: number;
  global_available: number;
  global_min_stock: number;
  global_max_stock: number;
  global_status: ProductLifecycleGlobalStatus;

  provisional_location_min_stock: number;
  provisional_location_max_stock: number;
  location_status: ProductLifecycleLocationStatus;

  possible_source_locations: number;
  source_locations: ProductLifecycleSourceLocation[];
  recommended_action: ProductLifecycleRecommendedAction;
};
