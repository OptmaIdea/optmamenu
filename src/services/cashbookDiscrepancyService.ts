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
};
