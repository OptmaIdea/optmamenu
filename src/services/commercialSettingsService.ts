import { supabase } from '@/lib/supabase';

export interface StockLocationOption {
    id: string;
    name: string;
    code?: string | null;
    active: boolean;
    allow_sales?: boolean | null;
    is_default?: boolean | null;
}

export interface CommercialSettingsStore {
    id: string;
    name: string;
    slug: string;
    public_store_enabled: boolean;
    public_catalog_enabled: boolean;
    minimum_order_value: number;
    reservation_time_minutes: number;
    public_sales_location_id?: string | null;
    contacts?: {
        whatsapp_business?: string;
        main_email?: string;
        website?: string;
        social_media?: string;
        [key: string]: unknown;
    } | null;
}

export interface UpdateCommercialSettingsInput {
    store_id: string;
    public_store_enabled: boolean;
    public_catalog_enabled: boolean;
    slug: string;
    minimum_order_value: number;
    reservation_time_minutes: number;
    public_sales_location_id?: string | null;
    whatsapp_business?: string | null;
    main_email?: string | null;
    website?: string | null;
    social_media?: string | null;
}

export const CommercialSettingsService = {
    async getStore(storeId: string): Promise<CommercialSettingsStore> {
        const { data, error } = await supabase
            .from('stores')
            .select(`
        id,
        name,
        slug,
        public_store_enabled,
        public_catalog_enabled,
        minimum_order_value,
        reservation_time_minutes,
        public_sales_location_id,
        contacts
      `)
            .eq('id', storeId)
            .single();

        if (error) throw error;

        return data as CommercialSettingsStore;
    },

    async listStockLocations(storeId: string): Promise<StockLocationOption[]> {
        const { data, error } = await supabase
            .from('stock_locations')
            .select('id, name, code, active, allow_sales, is_default')
            .eq('store_id', storeId)
            .eq('active', true)
            .order('is_default', { ascending: false })
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []) as StockLocationOption[];
    },

    async validateSlug(storeId: string, slug: string) {
        const { data, error } = await supabase.rpc('validate_store_slug', {
            p_store_id: storeId,
            p_slug: slug,
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            slug?: string;
            error?: string;
            message?: string;
        };
    },

    async update(input: UpdateCommercialSettingsInput) {
        const { data, error } = await supabase.rpc('update_store_commercial_settings', {
            p_store_id: input.store_id,
            p_public_store_enabled: input.public_store_enabled,
            p_public_catalog_enabled: input.public_catalog_enabled,
            p_slug: input.slug,
            p_minimum_order_value: input.minimum_order_value,
            p_reservation_time_minutes: input.reservation_time_minutes,
            p_public_sales_location_id: input.public_sales_location_id || null,
            p_whatsapp_business: input.whatsapp_business || '',
            p_main_email: input.main_email || '',
            p_website: input.website || '',
            p_social_media: input.social_media || '',
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            store?: unknown;
        };
    },
};