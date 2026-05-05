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
    metadata: Record<string, unknown>;
    order?: { customer_name: string | null } | null;
    created_at: string;
    updated_at: string;
}

export interface CreateCashbookEntryInput {
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
        const { data, error } = await supabase.rpc('create_cashbook_entry', {
            p_store_id: input.store_id,
            p_type: input.type,
            p_direction: input.direction,
            p_amount: input.amount,
            p_description: input.description,
            p_payment_method_code: input.payment_method_code || null,
            p_notes: input.notes || null,
            p_occurred_at: input.occurred_at || new Date().toISOString(),
            p_metadata: input.metadata || {},
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
