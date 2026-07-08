import { supabase } from '@/lib/supabase';

export type CashbookAccountPlanKind = 'income' | 'expense' | 'transfer' | 'adjustment';

export interface CashbookAccountPlanItem {
  code: string;
  display_code?: string | null;
  parent_code?: string | null;
  name: string;
  kind: CashbookAccountPlanKind;
  description?: string | null;
  affects_cash_drawer: boolean;
  affects_financial_result: boolean;
  is_transfer: boolean;
  active: boolean;
  sort_order: number;
  level?: number | null;
  path?: string | null;
  is_group?: boolean | null;
  is_postable?: boolean | null;
  analysis_enabled?: boolean | null;
  metadata: Record<string, unknown>;
}

export const CashbookAccountPlanService = {
  async list(activeOnly = true): Promise<CashbookAccountPlanItem[]> {
    let query = supabase
      .from('cashbook_account_plan')
      .select('code, display_code, parent_code, name, kind, description, affects_cash_drawer, affects_financial_result, is_transfer, active, sort_order, level, path, is_group, is_postable, analysis_enabled, metadata')
      .order('sort_order', { ascending: true })
      .order('display_code', { ascending: true })
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
    const postableItems = items.filter((item) => item.is_group !== true && item.is_postable !== false && item.metadata?.system_group !== true);

    if (direction === 'transfer') {
      return postableItems.filter((item) => item.kind === 'transfer' || item.is_transfer);
    }

    if (direction === 'in') {
      return postableItems.filter((item) => item.kind === 'income' || item.kind === 'adjustment');
    }

    return postableItems.filter((item) => item.kind === 'expense' || item.kind === 'adjustment');
  },
};