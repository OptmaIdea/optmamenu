// @ts-nocheck -- diagnóstico temporário; remover antes do merge
import { supabase } from '@/lib/supabase';

export type StockDiscrepancyStatus = 'open' | 'under_review' | 'waiting_stock_count' | 'resolved' | 'cancelled';

export interface StockDiscrepancyItem {
  product_id?: string;
  product_name?: string;
  variant_id?: string | null;
  requested_quantity?: number;
  available_quantity?: number;
  shortage_quantity?: number;
  requested?: number;
  available?: number;
  shortage?: number;
  [key: string]: unknown;
}

export interface StockDiscrepancyOccurrence {
  id: string;
  store_id: string;
  order_id?: string | null;
  order_code?: string | null;
  location_id?: string | null;
  location_name?: string | null;
  operator_name?: string | null;
  occurrence_type: string;
  status: StockDiscrepancyStatus;
  items: StockDiscrepancyItem[];
  opening_notes?: string | null;
  resolution_type?: string | null;
  resolution_notes?: string | null;
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface ResolveStockDiscrepancyInput {
  storeId: string;
  occurrenceId: string;
  status: Exclude<StockDiscrepancyStatus, 'open'>;
  resolutionType?: string | null;
  resolutionNotes?: string | null;
}

function safeError(data: any, fallback: string) {
  if (data?.error === 'unexpected_error') return fallback;
  return data?.message || data?.error || fallback;
}

export const StockDiscrepancyService = {
  async list(
    storeId: string,
    status: StockDiscrepancyStatus | 'all' = 'all',
    startDate?: string | null,
    endDate?: string | null,
  ): Promise<StockDiscrepancyOccurrence[]> {
    const { data, error } = await supabase.rpc('list_stock_discrepancy_occurrences_safe', {
      p_store_id: storeId,
      p_status: status,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_limit: 300,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(safeError(data, 'Não foi possível carregar as divergências de estoque.'));
    return (data.items || []) as StockDiscrepancyOccurrence[];
  },

  async resolve(input: ResolveStockDiscrepancyInput): Promise<StockDiscrepancyOccurrence> {
    const { data, error } = await supabase.rpc('resolve_stock_discrepancy_occurrence_safe', {
      p_store_id: input.storeId,
      p_occurrence_id: input.occurrenceId,
      p_status: input.status,
      p_resolution_type: input.resolutionType || null,
      p_resolution_notes: input.resolutionNotes || null,
      p_metadata: { source: 'stock_discrepancies_page' },
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(safeError(data, 'Não foi possível atualizar a divergência de estoque.'));
    return data.occurrence as StockDiscrepancyOccurrence;
  },
};
