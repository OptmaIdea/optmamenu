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
