import { supabase } from '@/lib/supabase';
import type { PosBootstrap } from '@/types/pdv';

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
