export type StockTransferSuggestion = {
  store_id: string;
  product_id: string;
  product_name: string;
  category_id: string | null;

  source_location_id: string;
  source_location_code: string;
  source_location_name: string;
  source_available: number;
  source_min_stock: number;
  source_safe_excess: number;

  destination_location_id: string;
  destination_location_code: string;
  destination_location_name: string;
  destination_available: number;
  destination_min_stock: number;
  destination_need: number;

  global_available: number;
  global_min_stock: number;
  global_max_stock: number;
  global_status: string;

  suggested_qty: number;
  recommended_action: 'transfer' | string;
  risk_level: 'low' | 'medium' | 'high' | string;
  warning_message: string | null;
};
