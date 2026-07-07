import { supabase } from '@/lib/supabase';

export type CashbookEntryType =
    | 'sale'
    | 'manual_income'
    | 'manual_expense'
    | 'refund'
    | 'adjustment'
    | 'transfer'
    | 'other';

export type CashbookDirection = 'in' | 'out';

export interface CashbookEntry {
    id: string;
    store_id: string;
    entry_code?: string | null;
    entry_date: string;
    occurred_at: string;
    type: CashbookEntryType;
    direction: CashbookDirection;
    amount: number;
    description: string;
    notes?: string | null;
    payment_method?: string | null;
    payment_method_code?: string | null;
    source: string;
    source_id?: string | null;
    order_id?: string | null;
    customer_id?: string | null;
    status: string;
    affects_balance: boolean;
    account_plan_code?: string | null;
    source_financial_account_id?: string | null;
    destination_financial_account_id?: string | null;
    is_transfer?: boolean | null;
    affects_cash_drawer?: boolean | null;
    affects_financial_result?: boolean | null;
    transfer_group_id?: string | null;
    metadata: Record<string, unknown>;
    order?: { customer_name: string | null } | null;
    created_at: string;
    updated_at: string;
}

export interface CashbookEntryClassificationInput {
    account_plan_code?: string | null;
    source_financial_account_code?: string | null;
    destination_financial_account_code?: string | null;
    is_transfer?: boolean | null;
    affects_cash_drawer?: boolean | null;
    affects_financial_result?: boolean | null;
}

export interface CreateCashbookEntryInput extends CashbookEntryClassificationInput {
    store_id: string;
    type: CashbookEntryType;
    direction: CashbookDirection;
    amount: number;
    description: string;
    payment_method_code?: string | null;
    notes?: string | null;
    occurred_at?: string;
    metadata?: Record<string, unknown>;
}

export interface UpdateCashbookEntryInput {
    entry_id: string;
    store_id: string;
    description: string;
    amount?: number;
    payment_method_code?: string | null;
    notes?: string | null;
    occurred_at?: string;
}

export interface ConfirmPendingPaymentInput {
    store_id: string;
    order_id: string;
    payment_method_code: string;
    received_at?: string;
    notes?: string | null;
    metadata?: Record<string, unknown>;
}

export interface CashbookSummary {
    start_date: string;
    end_date: string;
    total_in: number;
    total_out: number;
    balance: number;
    by_payment_method: Array<{
        payment_method_code: string;
        payment_method: string;
        total_in: number;
        total_out: number;
        balance: number;
    }>;
}

export interface CashbookDayClosingExpected {
    cash: number;
    pix: number;
    debit_card: number;
    credit_card: number;
    other: number;
    total: number;
    by_method?: Array<{
        payment_method_code: string;
        balance: number;
    }>;
}

export interface CashbookDayClosingPreview {
    ok: boolean;
    store_id: string;
    closing_date: string;
    expected: CashbookDayClosingExpected;
    pending: {
        total: number;
        count: number;
    };
    cancelled: {
        total: number;
        count: number;
    };
    existing_closing?: CashbookDayClosing | null;
}

export interface CashbookDayClosing {
    id: string;
    store_id: string;
    closing_date: string;
    status: 'draft' | 'closed' | 'reopened' | 'adjusted';
    expected_cash: number;
    expected_pix: number;
    expected_debit_card: number;
    expected_credit_card: number;
    expected_other: number;
    expected_total: number;
    counted_cash_total: number;
    counted_denominations: Record<string, number>;
    confirmed_pix_total: number;
    confirmed_debit_card_total: number;
    confirmed_credit_card_total: number;
    confirmed_other_total: number;
    confirmed_total: number;
    difference_cash: number;
    difference_pix: number;
    difference_debit_card: number;
    difference_credit_card: number;
    difference_other: number;
    difference_total: number;
    pending_total: number;
    pending_count: number;
    cancelled_total: number;
    cancelled_count: number;
    notes?: string | null;
    metadata: Record<string, unknown>;
    closed_by?: string | null;
    closed_at?: string | null;
    created_by?: string | null;
    created_at: string;
    updated_at: string;
}

export interface CashbookOpenDayStatus {
    entry_date: string;
    entries_count: number;
    realized_total: number;
    pending_count: number;
    pending_total: number;
    status: string;
    closing_id?: string | null;
    age_days: number;
    is_overdue: boolean;
}

export interface CashbookClosingStatusResult {
    ok: boolean;
    store_id: string;
    allowed_open_days: number;
    lookback_days: number;
    open_days: CashbookOpenDayStatus[];
    recent_closings: CashbookDayClosing[];
}

export interface SaveCashbookDayClosingInput {
    store_id: string;
    closing_date: string;
    counted_denominations?: Record<string, number>;
    counted_cash_total: number;
    confirmed_pix_total: number;
    confirmed_debit_card_total: number;
    confirmed_credit_card_total: number;
    confirmed_other_total?: number;
    notes?: string | null;
    status?: 'draft' | 'closed';
    metadata?: Record<string, unknown>;
}

function normalizePaymentMethod(value?: string | null): string {
    return String(value || '').trim().toLowerCase();
}

function getDefaultFinancialAccountCode(paymentMethodCode?: string | null): string | null {
    const method = normalizePaymentMethod(paymentMethodCode);

    if (method === 'cash' || method === 'dinheiro') return 'cash_drawer';
    if (method === 'pix') return 'pix_wallet';
    if (method === 'card' || method === 'debit_card' || method === 'credit_card') return 'card_receivable';

    return null;
}

function buildCashbookDefaultClassificationMetadata(input: CreateCashbookEntryInput): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if (input.type !== 'manual_income' && input.type !== 'manual_expense') {
        return metadata;
    }

    const accountCode = getDefaultFinancialAccountCode(input.payment_method_code);
    const affectsCashDrawer = accountCode === 'cash_drawer';

    if (accountCode && input.direction === 'in') {
        metadata.destination_financial_account_code = accountCode;
    }

    if (accountCode && input.direction === 'out') {
        metadata.source_financial_account_code = accountCode;
    }

    if (accountCode) {
        metadata.affects_cash_drawer = affectsCashDrawer;
        metadata.affects_financial_result = true;
        metadata.is_transfer = false;
        metadata.default_classification_source = 'cashbook_service_payment_method_defaults';
    }

    return metadata;
}

function buildCashbookClassificationMetadata(input: CashbookEntryClassificationInput): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};

    if (input.account_plan_code) {
        metadata.account_plan_code = input.account_plan_code;
    }

    if (input.source_financial_account_code) {
        metadata.source_financial_account_code = input.source_financial_account_code;
    }

    if (input.destination_financial_account_code) {
        metadata.destination_financial_account_code = input.destination_financial_account_code;
    }

    if (typeof input.is_transfer === 'boolean') {
        metadata.is_transfer = input.is_transfer;
    }

    if (typeof input.affects_cash_drawer === 'boolean') {
        metadata.affects_cash_drawer = input.affects_cash_drawer;
    }

    if (typeof input.affects_financial_result === 'boolean') {
        metadata.affects_financial_result = input.affects_financial_result;
    }

    return metadata;
}

export const CashbookService = {
    async listByStore(storeId: string): Promise<CashbookEntry[]> {
        const { data: result, error } = await supabase.rpc('get_cashbook_entries_safe', {
            p_store_id: storeId,
            p_limit: 100,
        });

        if (error) throw error;

        if (!result?.ok) {
            throw new Error(result?.error || 'Erro ao buscar lançamentos do livro de caixa.');
        }

        return (result.entries || []) as CashbookEntry[];
    },

    async create(input: CreateCashbookEntryInput) {
        const defaultClassificationMetadata = buildCashbookDefaultClassificationMetadata(input);
        const classificationMetadata = buildCashbookClassificationMetadata(input);
        const metadata = {
            ...defaultClassificationMetadata,
            ...(input.metadata || {}),
            ...classificationMetadata,
        };

        const { data, error } = await supabase.rpc('create_cashbook_entry', {
            p_store_id: input.store_id,
            p_type: input.type,
            p_direction: input.direction,
            p_amount: input.amount,
            p_description: input.description,
            p_payment_method_code: input.payment_method_code || null,
            p_notes: input.notes || null,
            p_occurred_at: input.occurred_at || new Date().toISOString(),
            p_metadata: metadata,
        });

        if (error) throw error;

        return data;
    },

    async update(input: UpdateCashbookEntryInput) {
        const payload: Record<string, unknown> = {
            description: input.description,
            updated_at: new Date().toISOString(),
        };

        if (input.amount !== undefined) payload.amount = input.amount;
        if (input.payment_method_code !== undefined) payload.payment_method_code = input.payment_method_code;
        if (input.notes !== undefined) payload.notes = input.notes;
        if (input.occurred_at !== undefined) {
            payload.occurred_at = input.occurred_at;
            payload.entry_date = input.occurred_at.slice(0, 10);
        }

        const { data, error } = await supabase
            .from('cashbook_entries')
            .update(payload)
            .eq('id', input.entry_id)
            .eq('store_id', input.store_id)
            .select()
            .maybeSingle();

        if (error) throw error;

        return data as CashbookEntry | null;
    },

    async confirmPendingPayment(input: ConfirmPendingPaymentInput) {
        const { data, error } = await supabase.rpc('confirm_pending_order_payment_safe', {
            p_store_id: input.store_id,
            p_order_id: input.order_id,
            p_payment_method_code: input.payment_method_code,
            p_received_at: input.received_at || new Date().toISOString(),
            p_notes: input.notes || null,
            p_metadata: input.metadata || {},
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.message || data?.error || 'Erro ao confirmar recebimento pendente.');
        }

        return data;
    },

    async getDayClosingPreview(storeId: string, closingDate: string): Promise<CashbookDayClosingPreview> {
        const { data, error } = await supabase.rpc('get_cashbook_day_closing_preview_safe', {
            p_store_id: storeId,
            p_closing_date: closingDate,
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.message || data?.error || 'Erro ao carregar prévia do fechamento de caixa.');
        }

        return data as CashbookDayClosingPreview;
    },

    async listDayClosingStatus(storeId: string, lookbackDays = 90, allowedOpenDays = 3): Promise<CashbookClosingStatusResult> {
        const { data, error } = await supabase.rpc('list_cashbook_day_closing_status_safe', {
            p_store_id: storeId,
            p_lookback_days: lookbackDays,
            p_allowed_open_days: allowedOpenDays,
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.message || data?.error || 'Erro ao carregar status dos fechamentos de caixa.');
        }

        return data as CashbookClosingStatusResult;
    },

    async saveDayClosing(input: SaveCashbookDayClosingInput): Promise<CashbookDayClosing> {
        const { data, error } = await supabase.rpc('save_cashbook_day_closing_safe', {
            p_store_id: input.store_id,
            p_closing_date: input.closing_date,
            p_counted_denominations: input.counted_denominations || {},
            p_counted_cash_total: input.counted_cash_total,
            p_confirmed_pix_total: input.confirmed_pix_total,
            p_confirmed_debit_card_total: input.confirmed_debit_card_total,
            p_confirmed_credit_card_total: input.confirmed_credit_card_total,
            p_confirmed_other_total: input.confirmed_other_total || 0,
            p_notes: input.notes || null,
            p_status: input.status || 'closed',
            p_metadata: input.metadata || {},
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.message || data?.error || 'Erro ao salvar fechamento de caixa.');
        }

        return data.closing as CashbookDayClosing;
    },

    async cancel(storeId: string, entryId: string) {
        const { data, error } = await supabase
            .from('cashbook_entries')
            .update({
                status: 'cancelled',
                affects_balance: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', entryId)
            .eq('store_id', storeId)
            .neq('type', 'sale')
            .select()
            .maybeSingle();

        if (error) throw error;

        return data as CashbookEntry | null;
    },

    async getSummary(storeId: string, startDate: string, endDate: string): Promise<CashbookSummary> {
        const { data, error } = await supabase.rpc('get_cashbook_summary', {
            p_store_id: storeId,
            p_start_date: startDate,
            p_end_date: endDate,
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.error || 'Erro ao carregar resumo financeiro.');
        }

        return data.summary as CashbookSummary;
    },
};