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
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

export interface FinancialAccountBalance extends StoreFinancialAccount {
  balance: number;
  inflows: number;
  outflows: number;
  movement_count: number;
  last_movement_at: string | null;
}

export interface FinancialAccountBalancesResult {
  accounts: FinancialAccountBalance[];
  canManage: boolean;
  summary: {
    bookBalance: number;
    allocatedBalance: number;
    unallocatedBalance: number;
  };
  unallocated: {
    count: number;
    inflows: number;
    outflows: number;
    balance: number;
  };
}

export interface UnallocatedCashbookEntry {
  id: string;
  entry_code: string | null;
  entry_date: string;
  occurred_at: string;
  direction: 'in' | 'out';
  amount: number;
  signed_amount: number;
  description: string;
  notes?: string | null;
  payment_method?: string | null;
  payment_method_code?: string | null;
  source: string;
  source_id?: string | null;
  order_id?: string | null;
  customer_id?: string | null;
  is_transfer: boolean;
  expected_side: 'source' | 'destination';
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

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const FinancialAccountsService = {
  async list(storeId: string, includeInactive = true): Promise<StoreFinancialAccount[]> {
    const { data, error } = await supabase.rpc('list_store_financial_accounts_safe', {
      p_store_id: storeId,
      p_include_inactive: includeInactive,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || data?.error || 'Erro ao carregar contas financeiras.');

    return (data.items || []) as StoreFinancialAccount[];
  },

  async getBalances(storeId: string): Promise<FinancialAccountBalancesResult> {
    const { data, error } = await supabase.rpc('get_financial_account_balances_safe', {
      p_store_id: storeId,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || data?.error || 'Erro ao carregar saldos por conta.');

    const accounts = ((data.accounts || []) as Array<Record<string, unknown>>).map((account) => ({
      ...account,
      balance: numberValue(account.balance),
      inflows: numberValue(account.inflows),
      outflows: numberValue(account.outflows),
      movement_count: numberValue(account.movement_count),
      last_movement_at: typeof account.last_movement_at === 'string' ? account.last_movement_at : null,
    })) as FinancialAccountBalance[];

    return {
      accounts,
      canManage: Boolean(data.can_manage),
      summary: {
        bookBalance: numberValue(data.summary?.book_balance),
        allocatedBalance: numberValue(data.summary?.allocated_balance),
        unallocatedBalance: numberValue(data.summary?.unallocated_balance),
      },
      unallocated: {
        count: numberValue(data.unallocated?.count),
        inflows: numberValue(data.unallocated?.inflows),
        outflows: numberValue(data.unallocated?.outflows),
        balance: numberValue(data.unallocated?.balance),
      },
    };
  },

  async listUnallocated(storeId: string, limit = 100, offset = 0): Promise<{ items: UnallocatedCashbookEntry[]; total: number }> {
    const { data, error } = await supabase.rpc('list_unallocated_cashbook_entries_safe', {
      p_store_id: storeId,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || data?.error || 'Erro ao carregar lançamentos não distribuídos.');

    const items = ((data.items || []) as Array<Record<string, unknown>>).map((item) => ({
      ...item,
      amount: numberValue(item.amount),
      signed_amount: numberValue(item.signed_amount),
    })) as UnallocatedCashbookEntry[];

    return { items, total: numberValue(data.total) };
  },

  async classifyEntry(storeId: string, entryId: string, accountId: string, reason?: string | null): Promise<void> {
    const { data, error } = await supabase.rpc('classify_cashbook_entry_financial_account_safe', {
      p_store_id: storeId,
      p_entry_id: entryId,
      p_account_id: accountId,
      p_reason: reason?.trim() || null,
    });

    if (error) throw error;
    if (!data?.ok) {
      const messages: Record<string, string> = {
        access_denied: 'Você não tem permissão para classificar lançamentos financeiros.',
        invalid_financial_account: 'A conta selecionada é inválida ou está inativa.',
        entry_not_found: 'O lançamento não foi encontrado.',
        entry_not_classifiable: 'Este lançamento não pode ser classificado.',
        entry_already_allocated: 'Este lançamento já está distribuído em uma conta.',
        transfer_requires_dedicated_flow: 'Transferências internas exigem o fluxo próprio de transferência.',
      };
      throw new Error(messages[data?.error] || data?.message || data?.error || 'Erro ao classificar lançamento.');
    }
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
    if (!data?.ok) throw new Error(data?.message || data?.error || 'Erro ao salvar conta financeira.');

    return data.account as StoreFinancialAccount;
  },

  async setActive(storeId: string, accountId: string, active: boolean): Promise<StoreFinancialAccount> {
    const { data, error } = await supabase.rpc('set_store_financial_account_active_safe', {
      p_store_id: storeId,
      p_account_id: accountId,
      p_active: active,
    });

    if (error) throw error;
    if (!data?.ok) throw new Error(data?.message || data?.error || 'Erro ao atualizar status da conta financeira.');

    return data.account as StoreFinancialAccount;
  },
};
