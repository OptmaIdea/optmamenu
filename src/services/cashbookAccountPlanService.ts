import { supabase } from '@/lib/supabase';

export type CashbookAccountPlanKind = 'income' | 'expense' | 'transfer' | 'adjustment';

export interface CashbookAccountPlanItem {
  code: string;
  name: string;
  kind: CashbookAccountPlanKind;
  description?: string | null;
  affects_cash_drawer: boolean;
  affects_financial_result: boolean;
  is_transfer: boolean;
  active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
}

export const CashbookAccountPlanService = {
  async list(activeOnly = true): Promise<CashbookAccountPlanItem[]> {
    let query = supabase
      .from('cashbook_account_plan')
      .select('code, name, kind, description, affects_cash_drawer, affects_financial_result, is_transfer, active, sort_order, metadata')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (activeOnly) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data || []) as CashbookAccountPlanItem[];
  },

  async listForDirection(direction: 'in' | 'out' | 'transfer'): Promise<CashbookAccountPlanItem[]> {
    const items = await this.list(true);
    const postableItems = items.filter((item) => item.metadata?.system_group !== true);

    if (direction === 'transfer') {
      return postableItems.filter((item) => item.kind === 'transfer' || item.is_transfer);
    }

    if (direction === 'in') {
      return postableItems.filter((item) => item.kind === 'income' || item.kind === 'adjustment');
    }

    return postableItems.filter((item) => item.kind === 'expense' || item.kind === 'adjustment');
  },
};