import { supabase } from '@/lib/supabase';

export type DeliveryMethodCode =
    | 'pickup'
    | 'local_delivery'
    | 'qr_table'
    | 'dine_in'
    | 'other';

export type FulfillmentType =
    | 'pickup'
    | 'delivery'
    | 'qr_table'
    | 'dine_in'
    | 'other';

export interface StoreDeliveryMethod {
    id: string;
    store_id: string;
    code: DeliveryMethodCode;
    name: string;
    description?: string | null;
    active: boolean;
    public_enabled: boolean;
    sort_order: number;
    icon?: string | null;
    color?: string | null;
    fulfillment_type: FulfillmentType;
    requires_address: boolean;
    requires_table: boolean;
    minimum_order_value: number;
    delivery_fee: number;
    estimated_minutes_min?: number | null;
    estimated_minutes_max?: number | null;
    affects_cashbook: boolean;
    metadata: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export interface UpdateDeliveryMethodInput {
    id: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    public_enabled?: boolean;
    sort_order?: number;
    requires_address?: boolean;
    requires_table?: boolean;
    minimum_order_value?: number;
    delivery_fee?: number;
    estimated_minutes_min?: number | null;
    estimated_minutes_max?: number | null;
    affects_cashbook?: boolean;
    metadata?: Record<string, unknown>;
}

export const DeliveryMethodsService = {
    async listByStore(storeId: string): Promise<StoreDeliveryMethod[]> {
        const { data, error } = await supabase
            .from('store_delivery_methods')
            .select('*')
            .eq('store_id', storeId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []) as StoreDeliveryMethod[];
    },

    async update(input: UpdateDeliveryMethodInput): Promise<StoreDeliveryMethod> {
        const { id, ...patch } = input;

        const { data, error } = await supabase
            .from('store_delivery_methods')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        return data as StoreDeliveryMethod;
    },
};