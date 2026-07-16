import { supabase } from '@/lib/supabase';

export type CashbookAccountPlanKind = 'income' | 'expense' | 'transfer' | 'adjustment';
export type CashbookAccountPlanNature = 'debit' | 'credit' | 'neutral';
export type ManualCashbookDirection = 'in' | 'out' | 'transfer';

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
  nature?: CashbookAccountPlanNature | null;
  analysis_enabled?: boolean | null;
  metadata: Record<string, unknown>;
}

function isHiddenFromManualCashbook(item: CashbookAccountPlanItem): boolean {
  if (item.metadata?.system_group === true) return true;
  if (item.metadata?.manual_cashbook_hidden === true) return true;

  // Vendas são classificadas automaticamente pelos pedidos. No lançamento manual,
  // elas confundem o usuário e podem distorcer a origem operacional da receita.
  return item.code.startsWith('sale_');
}

function getManualCashbookDirection(item: CashbookAccountPlanItem): ManualCashbookDirection | null {
  const value = item.metadata?.manual_cashbook_direction;
  return value === 'in' || value === 'out' || value === 'transfer' ? value : null;
}

function matchesManualDirection(item: CashbookAccountPlanItem, direction: ManualCashbookDirection): boolean {
  const explicitDirection = getManualCashbookDirection(item);
  if (explicitDirection) return explicitDirection === direction;

  if (direction === 'transfer') return item.kind === 'transfer' || item.is_transfer;

  if (item.is_transfer || item.kind === 'transfer') return false;

  if (direction === 'in') {
    if (item.kind === 'income') return true;
    return item.kind === 'adjustment' && item.nature === 'credit';
  }

  if (item.kind === 'expense') return true;
  return item.kind === 'adjustment' && item.nature === 'debit';
}

export const CashbookAccountPlanService = {
  async list(activeOnly = true): Promise<CashbookAccountPlanItem[]> {
    let query = supabase
      .from('cashbook_account_plan')
      .select('code, display_code, parent_code, name, kind, description, affects_cash_drawer, affects_financial_result, is_transfer, active, sort_order, level, path, is_group, is_postable, nature, analysis_enabled, metadata')
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

  async listForDirection(direction: ManualCashbookDirection): Promise<CashbookAccountPlanItem[]> {
    const items = await this.list(true);
    const postableItems = items.filter((item) => (
      item.is_group !== true
      && item.is_postable !== false
      && !isHiddenFromManualCashbook(item)
    ));

    return postableItems.filter((item) => matchesManualDirection(item, direction));
  },
};
