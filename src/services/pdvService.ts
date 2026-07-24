import { supabase } from '@/lib/supabase';
import type { PosBootstrap, PosPaymentMethod } from '@/types/pdv';

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
