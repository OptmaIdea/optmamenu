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

export interface FinancialPaymentMethod {
  code: string;
  name: string;
  affects_cashbook: boolean;
}

export interface FinancialPaymentBreakdown {
  payment_method_code: string;
  balance: number;
  inflows: number;
  outflows: number;
  movement_count: number;
}

export interface StoreFinancialAccount {
  id: string;
  store_id: string;
  code: string;
  name: string;
  account_type: FinancialAccountType;
  description?: string | null;
  active: boolean;
  is_default: boolean;
  is_sales_clearing_default?: boolean;
  accepted_payment_methods?: string[];
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
  payment_breakdown: FinancialPaymentBreakdown[];
}

export interface FinancialAccountBalancesResult {
  accounts: FinancialAccountBalance[];
  paymentMethods: FinancialPaymentMethod[];
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

export interface SaveFinancialRoutingInput {
  storeId: string;
  accountId: string;
  paymentMethodCodes: string[];
  isSalesClearingDefault: boolean;
}

export interface TransferFinancialBalanceInput {
  storeId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  paymentMethodCode: string;
  amount: number;
  reason?: string | null;
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
      accepted_payment_methods: Array.isArray(account.accepted_payment_methods)
        ? account.accepted_payment_methods.map(String)
        : [],
      payment_breakdown: Array.isArray(account.payment_breakdown)
        ? account.payment_breakdown.map((item) => {
            const record = item as Record<string, unknown>;
            return {
              payment_method_code: String(record.payment_method_code || 'other'),
              balance: numberValue(record.balance),
              inflows: numberValue(record.inflows),
              outflows: numberValue(record.outflows),
              movement_count: numberValue(record.movement_count),
            };
          })
        : [],
    })) as FinancialAccountBalance[];

    const paymentMethods = ((data.payment_methods || []) as Array<Record<string, unknown>>).map((method) => ({
      code: String(method.code || ''),
      name: String(method.name || method.code || ''),
      affects_cashbook: Boolean(method.affects_cashbook),
    })).filter((method) => method.code);

    return {
      accounts,
      paymentMethods,
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
        account_does_not_accept_payment_method: 'A conta selecionada não aceita a forma de pagamento deste lançamento.',
      };
      throw new Error(messages[data?.error] || data?.message || data?.error || 'Erro ao classificar lançamento.');
    }
  },

  async classifyEntriesBulk(
    storeId: string,
    entryIds: string[],
    accountId: string,
    reason?: string | null,
  ): Promise<number> {
    const { data, error } = await supabase.rpc('classify_cashbook_entries_bulk_safe', {
      p_store_id: storeId,
      p_entry_ids: entryIds,
      p_account_id: accountId,
      p_reason: reason?.trim() || null,
    });

    if (error) throw error;
    if (!data?.ok) {
      const messages: Record<string, string> = {
        access_denied: 'Você não tem permissão para distribuir lançamentos em lote.',
        empty_selection: 'Selecione ao menos um lançamento.',
        too_many_entries: 'Selecione no máximo 500 lançamentos por vez.',
        invalid_financial_account: 'A conta selecionada é inválida ou está inativa.',
        selection_contains_non_classifiable_entries: 'A seleção contém lançamentos que já foram distribuídos ou não podem ser classificados.',
        account_does_not_accept_all_payment_methods: 'A conta escolhida não aceita todas as formas de pagamento presentes na seleção.',
      };
      throw new Error(messages[data?.error] || data?.message || data?.error || 'Erro ao distribuir lançamentos em lote.');
    }

    return numberValue(data.classified_count);
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

  async saveRouting(input: SaveFinancialRoutingInput): Promise<void> {
    const { data, error } = await supabase.rpc('set_financial_account_routing_safe', {
      p_store_id: input.storeId,
      p_account_id: input.accountId,
      p_payment_method_codes: input.paymentMethodCodes,
      p_is_sales_clearing_default: input.isSalesClearingDefault,
    });

    if (error) throw error;
    if (!data?.ok) {
      const messages: Record<string, string> = {
        access_denied: 'Você não tem permissão para configurar o roteamento financeiro.',
        account_not_found: 'A conta financeira não foi encontrada.',
        unknown_payment_method: 'Uma das formas de pagamento selecionadas não existe nesta loja.',
        clearing_account_must_be_active: 'A conta de entrada das vendas precisa estar ativa.',
      };
      throw new Error(messages[data?.error] || data?.message || data?.error || 'Erro ao configurar a conta financeira.');
    }
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

  async transfer(input: TransferFinancialBalanceInput): Promise<void> {
    const { data, error } = await supabase.rpc('transfer_financial_account_balance_safe', {
      p_store_id: input.storeId,
      p_source_account_id: input.sourceAccountId,
      p_destination_account_id: input.destinationAccountId,
      p_payment_method_code: input.paymentMethodCode,
      p_amount: input.amount,
      p_reason: input.reason?.trim() || null,
    });

    if (error) throw error;
    if (!data?.ok) {
      const messages: Record<string, string> = {
        access_denied: 'Você não tem permissão para transferir valores entre contas.',
        same_account: 'Escolha uma conta de destino diferente.',
        invalid_amount: 'Informe um valor maior que zero.',
        invalid_account: 'Conta de origem ou destino inválida.',
        destination_does_not_accept_payment_method: 'A conta de destino não aceita esta forma de pagamento.',
      };
      if (data?.error === 'insufficient_method_balance') {
        throw new Error(`Saldo insuficiente nesta forma de pagamento. Disponível: R$ ${numberValue(data.available).toFixed(2).replace('.', ',')}.`);
      }
      throw new Error(messages[data?.error] || data?.message || data?.error || 'Erro ao transferir entre contas.');
    }
  },
};
