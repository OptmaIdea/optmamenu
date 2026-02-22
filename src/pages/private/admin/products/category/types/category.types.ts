export interface PriceRule {
  min: number; // quantidade mínima
  price: number; // preço unitário
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
  // - 'standard': preço único fixo (UI simples). Representado por UMA regra min=0 em price_rules.
  // - 'category_volume': regras progressivas por volume (múltiplas faixas) em price_rules.
  price_logic_type: 'standard' | 'category_volume';
  price_rules: PriceRule[];

  // Campo calculado (pode vir de view/RPC) para exibir contagem de produtos.
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
}
