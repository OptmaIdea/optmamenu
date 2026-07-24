import { supabase } from '@/lib/supabase';
import type { PriceRule } from '@/types';

export type PricingGroup = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  price_logic_type: 'category_volume';
  price_rules: PriceRule[];
  active: boolean;
  category_ids: string[];
  created_at: string;
  updated_at: string;
};

export type SavePricingGroupInput = {
  id?: string | null;
  storeId: string;
  name: string;
  description?: string | null;
  priceRules: PriceRule[];
  active: boolean;
  categoryIds: string[];
};

type SavePricingGroupResponse = {
  ok: boolean;
  group?: PricingGroup;
  error?: string;
  message?: string;
};

function normalizeRules(value: unknown): PriceRule[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((rule) => ({
      min: Number((rule as { min?: unknown }).min ?? 0),
      price: Number((rule as { price?: unknown }).price ?? 0),
    }))
    .filter((rule) => Number.isInteger(rule.min) && rule.min >= 0 && Number.isFinite(rule.price))
    .sort((a, b) => a.min - b.min);
}

function normalizeGroup(value: unknown): PricingGroup {
  const group = value as PricingGroup;
  return {
    ...group,
    description: group.description || null,
    price_logic_type: 'category_volume',
    price_rules: normalizeRules(group.price_rules),
    category_ids: Array.isArray(group.category_ids) ? group.category_ids : [],
    active: Boolean(group.active),
  };
}

export const PricingGroupService = {
  async list(storeId: string): Promise<PricingGroup[]> {
    const { data: groups, error: groupsError } = await supabase
      .from('pricing_groups')
      .select(
        'id, store_id, name, description, price_logic_type, price_rules, active, created_at, updated_at'
      )
      .eq('store_id', storeId)
      .order('active', { ascending: false })
      .order('name');

    if (groupsError) throw groupsError;

    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select('id, pricing_group_id, use_pricing_group_rules')
      .eq('store_id', storeId)
      .not('pricing_group_id', 'is', null);

    if (categoriesError) throw categoriesError;

    const categoryIdsByGroup = new Map<string, string[]>();
    for (const category of categories || []) {
      if (!category.pricing_group_id || !category.use_pricing_group_rules) continue;
      const current = categoryIdsByGroup.get(category.pricing_group_id) || [];
      current.push(category.id);
      categoryIdsByGroup.set(category.pricing_group_id, current);
    }

    return (groups || []).map((group: Omit<PricingGroup, 'category_ids'>) =>
      normalizeGroup({
        ...group,
        category_ids: categoryIdsByGroup.get(group.id) || [],
      })
    );
  },

  async save(input: SavePricingGroupInput): Promise<PricingGroup> {
    const rules = normalizeRules(input.priceRules);
    const categoryIds = [...new Set(input.categoryIds)];

    if (!input.storeId) throw new Error('Loja não informada.');
    if (!input.name.trim()) throw new Error('Informe o nome do grupo.');
    if (!rules.length) throw new Error('Informe ao menos uma faixa de preço.');
    if (rules.some((rule) => rule.price <= 0)) {
      throw new Error('O preço de cada faixa deve ser maior que zero.');
    }
    if (new Set(rules.map((rule) => rule.min)).size !== rules.length) {
      throw new Error('Não repita a mesma quantidade mínima.');
    }
    if (input.active && categoryIds.length < 2) {
      throw new Error('Um grupo ativo precisa reunir pelo menos duas categorias.');
    }

    const { data, error } = await supabase.rpc('save_pricing_group', {
      p_store_id: input.storeId,
      p_group_id: input.id || null,
      p_name: input.name.trim(),
      p_description: input.description?.trim() || null,
      p_price_rules: rules,
      p_active: input.active,
      p_category_ids: categoryIds,
    });

    if (error) throw error;

    const result = data as SavePricingGroupResponse;
    if (!result?.ok || !result.group) {
      throw new Error(result?.message || result?.error || 'Não foi possível salvar o grupo.');
    }

    return normalizeGroup(result.group);
  },
};
