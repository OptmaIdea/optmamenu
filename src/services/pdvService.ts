import { supabase } from '@/lib/supabase';
import type {
  PosBootstrap,
  PosPaymentMethod,
  PosPricingItem,
  PosPricingQuote,
} from '@/types/pdv';

function toFiniteNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getPosBootstrap(
  storeId: string,
  locationId?: string | null
): Promise<PosBootstrap> {
  const { data, error } = await supabase.rpc('get_pos_bootstrap', {
    p_store_id: storeId,
    p_location_id: locationId ?? null,
  });

  if (error) {
    console.error('Erro ao carregar o PDV:', error);
    throw error;
  }

  const payload = data as PosBootstrap;

  return {
    ...payload,
    categories: payload.categories ?? [],
    locations: payload.locations ?? [],
    products: (payload.products ?? []).map((product) => ({
      ...product,
      price: toFiniteNumber(product.price),
      available_stock: toFiniteNumber(product.available_stock),
      images: product.images ?? [],
      codes: product.codes ?? [],
    })),
  };
}

export async function getPosPaymentMethods(
  storeId: string
): Promise<PosPaymentMethod[]> {
  const { data, error } = await supabase
    .from('store_payment_methods')
    .select('code, name, sort_order')
    .eq('store_id', storeId)
    .eq('active', true)
    .order('sort_order')
    .order('name');

  if (error) {
    console.error('Erro ao carregar formas de pagamento do PDV:', error);
    throw error;
  }

  return (data ?? []).map((method) => ({
    code: method.code,
    name: method.name,
    sort_order: Number(method.sort_order ?? 0),
  }));
}

export async function getPosPricingQuote(
  storeId: string,
  items: Array<{ productId: string; quantity: number }>
): Promise<PosPricingQuote> {
  const { data, error } = await supabase.rpc('quote_pos_cart_safe', {
    p_store_id: storeId,
    p_items: items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
    })),
  });

  if (error) {
    console.error('Erro ao calcular preços do PDV:', error);
    throw error;
  }

  const payload = data as
    | (Partial<PosPricingQuote> & { ok?: boolean; error?: string })
    | null;

  if (!payload?.ok) {
    throw new Error(payload?.error || 'Não foi possível calcular os preços do carrinho.');
  }

  return {
    ok: true,
    items: ((payload.items ?? []) as PosPricingItem[]).map((item) => ({
      ...item,
      quantity: toFiniteNumber(item.quantity),
      pricing_quantity: toFiniteNumber(item.pricing_quantity),
      base_price: toFiniteNumber(item.base_price),
      unit_price: toFiniteNumber(item.unit_price),
      discount_total: toFiniteNumber(item.discount_total),
      line_total: toFiniteNumber(item.line_total),
      applied_tier: item.applied_tier
        ? {
            min: toFiniteNumber(item.applied_tier.min),
            price: toFiniteNumber(item.applied_tier.price),
          }
        : null,
    })),
    subtotal: toFiniteNumber(payload.subtotal),
    base_subtotal: toFiniteNumber(payload.base_subtotal),
    total_discount: toFiniteNumber(payload.total_discount),
  };
}
