import { supabase } from '@/lib/supabase';

export type ProductTransferDivergence = {
  id: string;
  transfer_id: string;
  transfer_code: string | null;
  created_at: string | null;
  received_at: string | null;
  source_location_id: string | null;
  source_location_name: string | null;
  destination_location_id: string | null;
  destination_location_name: string | null;
  product_id: string;
  requested_qty: number;
  shipped_qty: number;
  received_qty: number;
  divergence_qty: number;
  divergence_resolution: string | null;
  divergence_reason: string | null;
  divergence_notes: string | null;
  loss_qty: number;
  returned_to_origin_qty: number;
  accepted_shortage_qty: number;
};

export async function getProductTransferDivergences(productId: string) {
  const { data, error } = await supabase.rpc('get_product_transfer_divergences', {
    p_product_id: productId,
  });

  if (error) throw error;

  return (data ?? []) as ProductTransferDivergence[];
}
