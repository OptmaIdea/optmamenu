import { supabase } from '@/lib/supabase';

export type PaymentMethodCode =
    | 'pending'
    | 'cash'
    | 'pix'
    | 'debit_card'
    | 'credit_card'
    | 'bank_transfer'
    | 'voucher'
    | 'other';

export interface StorePaymentMethod {
    id: string;
    store_id: string;
    code: PaymentMethodCode;
    name: string;
    description?: string | null;
    active: boolean;
    public_enabled: boolean;
    sort_order: number;
    icon?: string | null;
    color?: string | null;
    requires_proof: boolean;
    requires_change_for: boolean;
    affects_cashbook: boolean;
    metadata: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export interface UpdatePaymentMethodInput {
    id: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    public_enabled?: boolean;
    sort_order?: number;
    requires_proof?: boolean;
    requires_change_for?: boolean;
    affects_cashbook?: boolean;
    metadata?: Record<string, unknown>;
}

export const PaymentMethodsService = {
    async listByStore(storeId: string): Promise<StorePaymentMethod[]> {
        const { data, error } = await supabase
            .from('store_payment_methods')
            .select('*')
            .eq('store_id', storeId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []) as StorePaymentMethod[];
    },

    async update(input: UpdatePaymentMethodInput): Promise<StorePaymentMethod> {
        const { id, ...patch } = input;

        const { data, error } = await supabase
            .from('store_payment_methods')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        return data as StorePaymentMethod;
    },
};