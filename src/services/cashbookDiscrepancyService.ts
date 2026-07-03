import { supabase } from '@/lib/supabase';

export interface CashbookDiscrepancy {
  id: string;
  store_id: string;
  closing_id: string;
  closing_date: string;
  status: string;
  divergence_type: string;
  divergence_level: string;
  expected_total: number;
  confirmed_total: number;
  difference_total: number;
  opening_notes?: string | null;
  resolution_type?: string | null;
  resolution_notes?: string | null;
  resolved_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResolveCashbookDiscrepancyInput {
  storeId: string;
  occurrenceId: string;
  status: string;
  resolutionType: string;
  resolutionNotes?: string | null;
}

export const CashbookDiscrepancyService = {
  async listByStore(storeId: string): Promise<CashbookDiscrepancy[]> {
    const { data, error } = await supabase
      .from('cashbook_closing_occurrences')
      .select('*')
      .eq('store_id', storeId)
      .order('closing_date', { ascending: false });

    if (error) throw error;

    return (data || []) as CashbookDiscrepancy[];
  },

  async resolve(input: ResolveCashbookDiscrepancyInput): Promise<CashbookDiscrepancy> {
    const { data, error } = await supabase.rpc('resolve_cashbook_closing_occurrence_safe', {
      p_store_id: input.storeId,
      p_occurrence_id: input.occurrenceId,
      p_status: input.status,
      p_resolution_type: input.resolutionType,
      p_resolution_notes: input.resolutionNotes || null,
      p_metadata: {
        source: 'cashbook_day_closing_modal',
      },
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao atualizar ocorrência de fechamento.');
    }

    return data.occurrence as CashbookDiscrepancy;
  },
};
