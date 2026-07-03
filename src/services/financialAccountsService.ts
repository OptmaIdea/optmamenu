import { supabase } from '@/lib/supabase';

export type FinancialAccountType =
  | 'cash_drawer'
  | 'safe'
  | 'bank'
  | 'pix_wallet'
  | 'card_acquirer'
  | 'card_receivable'
  | 'owner'
  | 'other';

export interface StoreFinancialAccount {
  id: string;
  store_id: string;
  code: string;
  name: string;
  account_type: FinancialAccountType;
  description?: string | null;
  active: boolean;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown>;
}

export interface SaveFinancialAccountInput {
  storeId: string;
  accountId?: string | null;
  code?: string | null;
  name: string;
  accountType: FinancialAccountType;
  description?: string | null;
  isDefault?: boolean;
  active?: boolean;
  sortOrder?: number;
  metadata?: Record<string, unknown>;
}

export const FinancialAccountsService = {
  async list(storeId: string, includeInactive = true): Promise<StoreFinancialAccount[]> {
    const { data, error } = await supabase.rpc('list_store_financial_accounts_safe', {
      p_store_id: storeId,
      p_include_inactive: includeInactive,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao carregar contas financeiras.');
    }

    return (data.items || []) as StoreFinancialAccount[];
  },

  async save(input: SaveFinancialAccountInput): Promise<StoreFinancialAccount> {
    const { data, error } = await supabase.rpc('upsert_store_financial_account_safe', {
      p_store_id: input.storeId,
      p_account_id: input.accountId || null,
      p_code: input.code || null,
      p_name: input.name,
      p_account_type: input.accountType,
      p_description: input.description || null,
      p_is_default: input.isDefault || false,
      p_active: input.active ?? true,
      p_sort_order: input.sortOrder || 0,
      p_metadata: input.metadata || {},
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao salvar conta financeira.');
    }

    return data.account as StoreFinancialAccount;
  },

  async setActive(storeId: string, accountId: string, active: boolean): Promise<StoreFinancialAccount> {
    const { data, error } = await supabase.rpc('set_store_financial_account_active_safe', {
      p_store_id: storeId,
      p_account_id: accountId,
      p_active: active,
    });

    if (error) throw error;

    if (!data?.ok) {
      throw new Error(data?.message || data?.error || 'Erro ao atualizar status da conta financeira.');
    }

    return data.account as StoreFinancialAccount;
  },
};
