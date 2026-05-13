import { supabase } from '@/lib/supabase';

export type SalesChannelCode =
    | 'whatsapp'
    | 'public_store'
    | 'qr_table'
    | 'direct'
    | 'phone'
    | 'in_person'
    | 'other';

export interface StoreSalesChannel {
    id: string;
    store_id: string;
    code: SalesChannelCode;
    name: string;
    description?: string | null;
    active: boolean;
    public_enabled: boolean;
    sort_order: number;
    icon?: string | null;
    color?: string | null;
    requires_customer: boolean;
    requires_address: boolean;
    requires_table: boolean;
    metadata: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
}

export interface UpdateSalesChannelInput {
    id: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    public_enabled?: boolean;
    sort_order?: number;
    requires_customer?: boolean;
    requires_address?: boolean;
    requires_table?: boolean;
    metadata?: Record<string, unknown>;
}

export const SalesChannelsService = {
    async listByStore(storeId: string): Promise<StoreSalesChannel[]> {
        const { data, error } = await supabase
            .from('store_sales_channels')
            .select('*')
            .eq('store_id', storeId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []) as StoreSalesChannel[];
    },

    async update(input: UpdateSalesChannelInput): Promise<StoreSalesChannel> {
        const { id, ...patch } = input;

        const { data, error } = await supabase
            .from('store_sales_channels')
            .update(patch)
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw error;

        return data as StoreSalesChannel;
    },
};