import { supabase } from '@/lib/supabase';

export interface OnlineOrderSettingsStore {
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
    order_settings?: OnlineOrderSettingsPayload | null;
}

export interface OnlineDeliveryMethodOption {
    id: string;
    code: string;
    name: string;
    description?: string | null;
    fulfillment_type: string;
    active: boolean;
    public_enabled: boolean;
    minimum_order_value?: number | null;
    delivery_fee?: number | null;
    estimated_minutes_min?: number | null;
    estimated_minutes_max?: number | null;
    requires_address?: boolean | null;
    requires_table?: boolean | null;
    sort_order?: number | null;
}

export interface StockLocationOption {
    id: string;
    name: string;
    code?: string | null;
    active: boolean;
    allow_sales?: boolean | null;
    is_default?: boolean | null;
}

export interface OnlineOrderSettingsPayload {
    allow_delivery?: boolean;
    allow_pickup?: boolean;
    allow_qr_table?: boolean;
    delivery_minimum_enabled?: boolean;
    pickup_minimum_enabled?: boolean;
    allow_whatsapp_checkout?: boolean;
    require_customer_phone?: boolean;
    require_customer_name?: boolean;
    show_product_images?: boolean;
    show_unavailable_products?: boolean;
    default_sales_channel?: string;
    default_delivery_method_code?: string;
    default_pickup_method_code?: string;
    whatsapp_order_message?: string;
    pickup_instructions?: string;
    delivery_instructions?: string;
    customer_notes_placeholder?: string;
    internal_notes?: string;
    online_stock_local_reserve_default?: number;
    online_stock_limit_default?: number | null;
    online_stock_low_threshold?: number;
    online_stock_show_exact?: boolean;
    online_stock_publish_products_by_default?: boolean;
    [key: string]: unknown;
}

export interface UpdateOnlineOrderSettingsInput {
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
    order_settings: OnlineOrderSettingsPayload;
}

export interface OnlineOrderSettingsUpdateResult {
    ok: boolean;
    error?: string;
    message?: string;
    commercial?: unknown;
    orders?: unknown;
}

export const DEFAULT_ONLINE_ORDER_SETTINGS: Required<Pick<OnlineOrderSettingsPayload,
    'allow_delivery' |
    'allow_pickup' |
    'allow_qr_table' |
    'delivery_minimum_enabled' |
    'pickup_minimum_enabled' |
    'allow_whatsapp_checkout' |
    'require_customer_phone' |
    'require_customer_name' |
    'show_product_images' |
    'show_unavailable_products' |
    'default_sales_channel' |
    'whatsapp_order_message' |
    'pickup_instructions' |
    'delivery_instructions' |
    'customer_notes_placeholder' |
    'internal_notes' |
    'online_stock_local_reserve_default' |
    'online_stock_limit_default' |
    'online_stock_low_threshold' |
    'online_stock_show_exact' |
    'online_stock_publish_products_by_default'
>> = {
    allow_delivery: true,
    allow_pickup: true,
    allow_qr_table: false,
    delivery_minimum_enabled: true,
    pickup_minimum_enabled: false,
    allow_whatsapp_checkout: true,
    require_customer_phone: true,
    require_customer_name: true,
    show_product_images: true,
    show_unavailable_products: false,
    default_sales_channel: 'whatsapp',
    whatsapp_order_message: 'Olá! Quero finalizar meu pedido pelo cardápio online.',
    pickup_instructions: 'Retirada disponível no balcão da loja. Aguarde a confirmação antes de buscar o pedido.',
    delivery_instructions: 'Informe o endereço completo para entrega. A loja confirmará prazo e taxa antes da finalização.',
    customer_notes_placeholder: 'Alguma observação para o pedido?',
    internal_notes: '',
    online_stock_local_reserve_default: 0,
    online_stock_limit_default: null,
    online_stock_low_threshold: 5,
    online_stock_show_exact: false,
    online_stock_publish_products_by_default: true,
};

export function normalizeOnlineOrderSettings(settings?: OnlineOrderSettingsPayload | null): OnlineOrderSettingsPayload {
    const normalized = {
        ...DEFAULT_ONLINE_ORDER_SETTINGS,
        ...(settings || {}),
    };

    return {
        ...normalized,
        online_stock_local_reserve_default: Math.max(0, Number(normalized.online_stock_local_reserve_default || 0)),
        online_stock_limit_default: normalized.online_stock_limit_default === null || normalized.online_stock_limit_default === undefined || normalized.online_stock_limit_default === ''
            ? null
            : Math.max(0, Number(normalized.online_stock_limit_default)),
        online_stock_low_threshold: Math.max(0, Number(normalized.online_stock_low_threshold || 0)),
        online_stock_show_exact: Boolean(normalized.online_stock_show_exact),
        online_stock_publish_products_by_default: Boolean(normalized.online_stock_publish_products_by_default),
    };
}

export const OnlineOrderSettingsService = {
    async getSettings(storeId: string): Promise<OnlineOrderSettingsStore> {
        const { data, error } = await supabase
            .rpc('get_store_settings_center', {
                p_store_id: storeId,
            })
            .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Configurações da loja não encontradas.');

        const store = Array.isArray(data) ? data[0] : data;

        return {
            ...(store as OnlineOrderSettingsStore),
            order_settings: normalizeOnlineOrderSettings((store as OnlineOrderSettingsStore).order_settings),
        };
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

    async listDeliveryMethods(storeId: string): Promise<OnlineDeliveryMethodOption[]> {
        const { data, error } = await supabase
            .from('store_delivery_methods')
            .select('id, code, name, description, fulfillment_type, active, public_enabled, minimum_order_value, delivery_fee, estimated_minutes_min, estimated_minutes_max, requires_address, requires_table, sort_order')
            .eq('store_id', storeId)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) throw error;

        return (data || []) as OnlineDeliveryMethodOption[];
    },

    async update(input: UpdateOnlineOrderSettingsInput): Promise<OnlineOrderSettingsUpdateResult> {
        const { data: commercialData, error: commercialError } = await supabase.rpc('update_store_commercial_settings', {
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

        if (commercialError) throw commercialError;

        const commercialResult = commercialData as OnlineOrderSettingsUpdateResult | null;

        if (commercialResult && commercialResult.ok === false) {
            return commercialResult;
        }

        const { data: orderData, error: orderError } = await supabase.rpc('update_store_settings_section', {
            p_store_id: input.store_id,
            p_section: 'orders',
            p_settings: normalizeOnlineOrderSettings(input.order_settings),
        });

        if (orderError) throw orderError;

        return {
            ok: true,
            commercial: commercialData,
            orders: orderData,
        };
    },
};
