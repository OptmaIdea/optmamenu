import { supabase } from '@/lib/supabase';

export interface ProductPurchaseReceiptIssue {
  issue_id: string;
  issue_code: string;
  purchase_document_id: string;
  document_code: string | null;
  invoice_number: string | null;
  supplier_name: string | null;
  issue_type: string;
  issue_status: string;
  disposition: string | null;
  quantity: number;
  replacement_pending_quantity: number | null;
  physical_closed_quantity: number | null;
  estimated_amount: number | null;
  notes: string | null;
  resolution_notes: string | null;
  resolution_reference: string | null;
  opened_at: string;
  resolved_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
}

export interface ProductPhysicalDiscrepancyItem {
  product_id: string;
  product_name?: string;
  shortage?: number;
  shortage_quantity?: number;
  available?: number;
  available_quantity?: number;
  requested?: number;
  requested_quantity?: number;
}

export interface ProductPhysicalDiscrepancy {
  id: string;
  order_code: string | null;
  location_name: string | null;
  occurrence_type: string;
  status: string;
  items: ProductPhysicalDiscrepancyItem[];
  opening_notes: string | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
}

export function getPhysicalDiscrepancyQuantity(item: ProductPhysicalDiscrepancy): number {
  return (item.items || []).reduce(
    (sum, entry) => sum + Math.max(0, Number(entry.shortage_quantity ?? entry.shortage ?? 0) || 0),
    0,
  );
}

export async function getProductOperationalOccurrences(storeId: string, productId: string) {
  const { data, error } = await supabase.rpc('get_product_operational_occurrences_safe', {
    p_store_id: storeId,
    p_product_id: productId,
  });
  if (error) throw error;
  if (!data?.ok) throw new Error('A consulta das ocorrências não retornou um resultado válido.');
  return {
    purchaseIssues: (data.purchase_issues ?? []) as ProductPurchaseReceiptIssue[],
    physicalDiscrepancies: (data.physical_occurrences ?? []) as ProductPhysicalDiscrepancy[],
  };
}
