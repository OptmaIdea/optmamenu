import { supabase } from '@/lib/supabase';

export interface ProductStockSettingsListItem {
  id: string;
  name: string;
  category_name?: string | null;
  active: boolean;
  min_stock: number;
  max_stock: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  rules_count: number;
}

export interface ProductStockRule {
  id: string;
  location_id: string;
  location_name: string;
  location_code?: string | null;
  location_type?: string | null;
  is_default: boolean;
  allow_sales: boolean;
  allow_reservations: boolean;
  min_stock: number | null;
  max_stock: number | null;
  min_percent: number | null;
  max_percent: number | null;
  use_percentage: boolean;
  active: boolean;
  on_hand: number;
  reserved: number;
  available: number;
}

export interface ProductStockRulesResponse {
  ok: boolean;
  error?: string;
  message?: string;
  product?: {
    id: string;
    name: string;
    min_stock: number;
    max_stock: number;
  };
  rules?: ProductStockRule[];
}

export interface UpdateProductStockRulePayload {
  location_id: string;
  min_stock: number | null;
  max_stock: number | null;
  min_percent: number | null;
  max_percent: number | null;
  use_percentage: boolean;
  active: boolean;
}

export const StockSettingsService = {
  async listProducts(
    storeId: string,
    search = '',
    limit = 100
  ): Promise<ProductStockSettingsListItem[]> {
    const { data, error } = await supabase.rpc('list_product_stock_settings_safe', {
      p_store_id: storeId,
      p_search: search,
      p_limit: limit,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.error || 'Erro ao listar produtos.');
    }

    return (data.items || []) as ProductStockSettingsListItem[];
  },

  async getProductRules(
    storeId: string,
    productId: string
  ): Promise<ProductStockRulesResponse> {
    const { data, error } = await supabase.rpc('get_product_stock_rules_safe', {
      p_store_id: storeId,
      p_product_id: productId,
    });

    if (error) throw error;

    return data as ProductStockRulesResponse;
  },

  async updateProductRules(input: {
    storeId: string;
    productId: string;
    minStock: number;
    maxStock: number;
    rules: UpdateProductStockRulePayload[];
  }) {
    const { data, error } = await supabase.rpc('update_product_stock_rules', {
      p_store_id: input.storeId,
      p_product_id: input.productId,
      p_min_stock: input.minStock,
      p_max_stock: input.maxStock,
      p_rules: input.rules,
    });

    if (error) throw error;

    return data as {
      ok: boolean;
      error?: string;
      message?: string;
      product_id?: string;
      min_stock?: number;
      max_stock?: number;
    };
  },
};