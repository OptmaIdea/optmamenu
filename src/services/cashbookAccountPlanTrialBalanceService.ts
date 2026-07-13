import { supabase } from '@/lib/supabase';

export interface CashbookAccountPlanTrialBalanceTotals {
  total_in: number;
  total_out: number;
  balance: number;
  entries_count: number;
}

export interface CashbookAccountPlanTrialBalanceItem {
  code: string;
  display_code?: string | null;
  parent_code?: string | null;
  name: string;
  kind: 'income' | 'expense' | 'transfer' | 'adjustment';
  level: number;
  path?: string | null;
  is_group: boolean;
  is_postable: boolean;
  nature: 'debit' | 'credit' | 'neutral';
  analysis_enabled: boolean;
  active: boolean;
  sort_order: number;
  direct_in: number;
  direct_out: number;
  direct_balance: number;
  direct_entries_count: number;
  total_in: number;
  total_out: number;
  total_balance: number;
  total_entries_count: number;
}

export interface CashbookAccountPlanTrialBalanceResult {
  store_id: string;
  start_date: string;
  end_date: string;
  totals: CashbookAccountPlanTrialBalanceTotals;
  items: CashbookAccountPlanTrialBalanceItem[];
}

export const CashbookAccountPlanTrialBalanceService = {
  async getTrialBalance(input: {
    storeId: string;
    startDate: string;
    endDate: string;
    includeInactive?: boolean;
  }): Promise<CashbookAccountPlanTrialBalanceResult> {
    const { data, error } = await supabase.rpc('get_cashbook_account_plan_trial_balance_safe', {
      p_store_id: input.storeId,
      p_start_date: input.startDate,
      p_end_date: input.endDate,
      p_include_inactive: input.includeInactive || false,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao carregar balancete do plano de contas.');
    }

    return {
      store_id: data.store_id,
      start_date: data.start_date,
      end_date: data.end_date,
      totals: data.totals || { total_in: 0, total_out: 0, balance: 0, entries_count: 0 },
      items: data.items || [],
    } as CashbookAccountPlanTrialBalanceResult;
  },
};
