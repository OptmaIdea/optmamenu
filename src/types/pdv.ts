export type PosProductCode = {
  id: string;
  type: string;
  value: string;
  normalized: string;
  is_primary: boolean;
};

export type PosLocation = {
  id: string;
  code: string;
  name: string;
  is_default: boolean;
};

export type PosCategory = {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  price_logic_type: string | null;
  price_rules: unknown[];
  pricing_strategy: Record<string, unknown>;
};

export type PosProduct = {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  images: string[];
  on_hand_stock: number;
  reserved_stock: number;
  available_stock: number;
  use_category_pricing: boolean;
  price_logic_type: string | null;
  price_rules: unknown[];
  codes: PosProductCode[];
};

export type PosPaymentMethod = {
  code: string;
  name: string;
  sort_order: number;
};

export type PosPricingTier = {
  min: number;
  price: number;
};

export type PosPricingItem = {
  product_id: string;
  product_name: string;
  category_id: string | null;
  category_name: string | null;
  quantity: number;
  pricing_quantity: number;
  base_price: number;
  unit_price: number;
  discount_total: number;
  line_total: number;
  pricing_source:
    | 'pricing_group_combined_volume'
    | 'category_combined_volume'
    | 'category_per_product_volume'
    | 'category_standard'
    | 'product_volume'
    | 'product_base_price';
  pricing_group_id?: string | null;
  pricing_group_name?: string | null;
  applied_tier: PosPricingTier | null;
};

export type PosPricingQuote = {
  ok: true;
  items: PosPricingItem[];
  subtotal: number;
  base_subtotal: number;
  total_discount: number;
};

export type PosBootstrap = {
  store: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
  };
  operator: {
    member_id: string;
    user_id: string;
    name: string;
    role: string;
    avatar_url: string | null;
  };
  locations: PosLocation[];
  selected_location_id: string | null;
  categories: PosCategory[];
  products: PosProduct[];
};
