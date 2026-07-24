export interface PriceRule {
  min: number;
  price: number;
}

export type CategoryVolumeScope = 'combined' | 'per_product';

export interface CategoryPricingStrategy {
  volume_scope?: CategoryVolumeScope;
}

export interface Category {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;

  // Precificação da categoria:
  // - 'standard': preço único fixo.
  // - 'category_volume': regras progressivas por volume.
  price_logic_type: 'standard' | 'category_volume';
  price_rules: PriceRule[];
  pricing_strategy?: CategoryPricingStrategy | null;

  products_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryFormData {
  name: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  active: boolean;
  price_logic_type: 'standard' | 'category_volume';
  price_rules: PriceRule[];
  pricing_strategy: CategoryPricingStrategy;
}
