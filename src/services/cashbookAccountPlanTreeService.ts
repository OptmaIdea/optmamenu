import { supabase } from '@/lib/supabase';
import type { CashbookAccountPlanKind } from './cashbookAccountPlanService';

export type CashbookAccountPlanNature = 'debit' | 'credit' | 'neutral';

export interface CashbookAccountPlanTreeItem {
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
  level: number;
  path?: string | null;
  is_group: boolean;
  is_postable: boolean;
  nature: CashbookAccountPlanNature;
  analysis_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
  has_entries?: boolean;
  children_count?: number;
  is_system_protected?: boolean;
  identity_locked?: boolean;
  can_delete_safe?: boolean;
}

export interface SaveCashbookAccountPlanInput {
  code: string;
  displayCode?: string | null;
  parentCode?: string | null;
  name: string;
  kind: CashbookAccountPlanKind;
  description?: string | null;
  isGroup?: boolean;
  isPostable?: boolean;
  nature?: CashbookAccountPlanNature;
  analysisEnabled?: boolean;
  affectsCashDrawer?: boolean;
  affectsFinancialResult?: boolean;
  isTransfer?: boolean;
  active?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export interface CashbookAccountPlanNextChildCodeResult {
  parent_code: string;
  parent_display_code: string;
  parent_name: string;
  next_number: number;
  suggested_display_code: string;
}

export interface CashbookAccountPlanGovernanceSummary {
  total_accounts: number;
  active_accounts: number;
  inactive_accounts: number;
  group_accounts: number;
  postable_accounts: number;
  accounts_with_entries: number;
  accounts_with_children: number;
  protected_accounts: number;
  identity_locked_accounts: number;
  safe_delete_candidates: number;
  flag_consistency_errors: number;
}

export interface CashbookAccountPlanGovernanceHighlights {
  safe_delete_candidates: CashbookAccountPlanTreeItem[];
  identity_locked_accounts: CashbookAccountPlanTreeItem[];
  protected_accounts: CashbookAccountPlanTreeItem[];
}

export interface CashbookAccountPlanGovernanceSummaryResult {
  summary: CashbookAccountPlanGovernanceSummary;
  highlights: CashbookAccountPlanGovernanceHighlights;
}

export const CashbookAccountPlanTreeService = {
  async list(includeInactive = false): Promise<CashbookAccountPlanTreeItem[]> {
    const { data, error } = await supabase.rpc('list_cashbook_account_plan_tree_safe', {
      p_include_inactive: includeInactive,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao carregar plano de contas.');
    }

    return (data.items || []) as CashbookAccountPlanTreeItem[];
  },

  async getGovernanceSummary(): Promise<CashbookAccountPlanGovernanceSummaryResult> {
    const { data, error } = await supabase.rpc('get_cashbook_account_plan_governance_summary_safe');

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao carregar resumo de governança do plano de contas.');
    }

    return {
      summary: data.summary as CashbookAccountPlanGovernanceSummary,
      highlights: {
        safe_delete_candidates: (data.highlights?.safe_delete_candidates || []) as CashbookAccountPlanTreeItem[],
        identity_locked_accounts: (data.highlights?.identity_locked_accounts || []) as CashbookAccountPlanTreeItem[],
        protected_accounts: (data.highlights?.protected_accounts || []) as CashbookAccountPlanTreeItem[],
      },
    };
  },

  async getNextChildCode(parentCode: string): Promise<CashbookAccountPlanNextChildCodeResult> {
    const { data, error } = await supabase.rpc('get_cashbook_account_plan_next_child_code_safe', {
      p_parent_code: parentCode,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao sugerir próximo código do plano de contas.');
    }

    return data as CashbookAccountPlanNextChildCodeResult;
  },

  async save(input: SaveCashbookAccountPlanInput): Promise<CashbookAccountPlanTreeItem> {
    const { data, error } = await supabase.rpc('upsert_cashbook_account_plan_safe', {
      p_code: input.code,
      p_display_code: input.displayCode || null,
      p_parent_code: input.parentCode || null,
      p_name: input.name,
      p_kind: input.kind,
      p_description: input.description || null,
      p_is_group: input.isGroup || false,
      p_is_postable: input.isPostable ?? true,
      p_nature: input.nature || 'neutral',
      p_analysis_enabled: input.analysisEnabled || false,
      p_affects_cash_drawer: input.affectsCashDrawer || false,
      p_affects_financial_result: input.affectsFinancialResult ?? true,
      p_is_transfer: input.isTransfer || false,
      p_active: input.active ?? true,
      p_sort_order: input.sortOrder || 0,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao salvar conta do plano de contas.');
    }

    return data.item as CashbookAccountPlanTreeItem;
  },

  async setActive(code: string, active: boolean): Promise<CashbookAccountPlanTreeItem> {
    const { data, error } = await supabase.rpc('set_cashbook_account_plan_active_safe', {
      p_code: code,
      p_active: active,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao atualizar status da conta do plano de contas.');
    }

    return data.item as CashbookAccountPlanTreeItem;
  },

  async deleteSafe(code: string): Promise<void> {
    const { data, error } = await supabase.rpc('delete_cashbook_account_plan_safe', {
      p_code: code,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao apagar conta do plano de contas.');
    }
  },
};
