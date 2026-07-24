import { supabaseCustomer } from '@/lib/supabase';
import type { Category, Product, StoreConfig } from '@/types';

export interface PublicStorefrontStore {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    logo_url?: string | null;
    phone_number?: string | null;
    theme_config?: Record<string, unknown>;
    visual_config?: StoreConfig;
    minimum_order_value?: number;
    reservation_time_minutes?: number;
    public_catalog_enabled?: boolean;
    privacy_policy_text?: string | null;
    terms_of_use_text?: string | null;
    cookie_policy_text?: string | null;
    whatsapp?: PublicStoreWhatsapp;
    hours?: PublicStoreHour[];
    messages?: PublicStoreMessage[];
}

export interface PublicStoreWhatsapp {
    raw?: string;
    digits?: string;
    enabled?: boolean;
}

export interface PublicSalesChannel {
    code: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    requires_customer?: boolean;
    requires_address?: boolean;
    requires_table?: boolean;
}

export interface PublicSalesChannelsResponse {
    ok: boolean;
    error?: string;
    channels: PublicSalesChannel[];
}

export interface PublicPaymentMethod {
    code: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    requires_proof?: boolean;
    requires_change_for?: boolean;
}

export interface PublicPaymentMethodsResponse {
    ok: boolean;
    error?: string;
    payment_methods: PublicPaymentMethod[];
}

export interface PublicDeliveryMethod {
    code: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    color?: string | null;
    fulfillment_type: 'pickup' | 'delivery' | 'qr_table' | 'dine_in' | 'other';
    requires_address: boolean;
    requires_table: boolean;
    minimum_order_value: number;
    delivery_fee: number;
    estimated_minutes_min?: number | null;
    estimated_minutes_max?: number | null;
}

export interface PublicDeliveryMethodsResponse {
    ok: boolean;
    error?: string;
    delivery_methods: PublicDeliveryMethod[];
}

export interface PublicStoreHour {
    day_of_week: number;
    open_time: string | null;
    close_time: string | null;
    is_closed: boolean;
}

export interface PublicStoreMessage {
    title: string;
    message: string;
    expires_at?: string | null;
}

export interface PublicStorefrontResponse {
    ok: boolean;
    error?: string;
    store?: PublicStorefrontStore;
}

export interface PublicCatalogCategory extends Category {
    loyalty_eligible?: boolean;
    loyalty_multiplier?: number;
    products: Product[];
}

export interface PublicCatalogResponse {
    ok: boolean;
    error?: string;
    catalog_enabled?: boolean;
    categories: PublicCatalogCategory[];
}

function normalizePriceRules(value: unknown) {
    if (Array.isArray(value)) {
        return value
            .map((rule) => ({
                min: Number((rule as { min?: unknown }).min ?? 0),
                price: Number((rule as { price?: unknown }).price ?? 0),
            }))
            .filter((rule) => Number.isFinite(rule.min) && Number.isFinite(rule.price));
    }

    if (typeof value === 'string') {
        try {
            return normalizePriceRules(JSON.parse(value));
        } catch {
            return [];
        }
    }

    return [];
}

function normalizeImages(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter(Boolean) as string[];

    if (typeof value === 'string') {
        try {
            if (value.startsWith('{')) {
                return value
                    .replace(/^{|}$/g, '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean);
            }

            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
        } catch {
            return [];
        }
    }

    return [];
}

export const PublicStorefrontService = {
    async getStorefrontBySlug(slug: string): Promise<PublicStorefrontResponse> {
        const { data, error } = await supabaseCustomer.rpc(
            'get_public_storefront_by_slug',
            { p_slug: slug }
        );

        if (error) {
            console.error('get_public_storefront_by_slug error:', error);
            throw error;
        }

        return data as PublicStorefrontResponse;
    },

    async getCatalogBySlug(slug: string): Promise<PublicCatalogResponse> {
        const { data, error } = await supabaseCustomer.rpc(
            'get_public_catalog_by_slug',
            { p_slug: slug }
        );

        if (error) {
            console.error('get_public_catalog_by_slug error:', error);
            throw error;
        }

        const payload = data as PublicCatalogResponse;

        return {
            ...payload,
            categories: (payload.categories || []).map((category) => ({
                ...category,
                price_rules: normalizePriceRules(category.price_rules),
                pricing_strategy: {
                    volume_scope:
                        category.pricing_strategy?.volume_scope === 'per_product'
                            ? 'per_product'
                            : 'combined',
                },
                products: (category.products || []).map((product) => {
                    const images = normalizeImages(product.images);
                    return {
                        ...product,
                        category_id: product.category_id || category.id,
                        price: Number(product.price || 0),
                        use_category_pricing: Boolean(product.use_category_pricing),
                        price_logic_type:
                            product.price_logic_type === 'category_volume'
                                ? 'category_volume'
                                : 'standard',
                        price_rules: normalizePriceRules(product.price_rules),
                        images,
                        image_url: product.image_url || images[0],
                        featured: product.featured ?? false,
                        sales_count: product.sales_count ?? 0,
                        stock_quantity: product.stock_quantity ?? 0,
                        rating_avg: product.rating_avg ?? 5,
                        review_count: product.review_count ?? 0,
                        active: product.active ?? true,
                    };
                }),
            })),
        };
    },

    async getPublicSalesChannelsBySlug(slug: string): Promise<PublicSalesChannelsResponse> {
        const { data, error } = await supabaseCustomer.rpc(
            'get_public_sales_channels_by_slug',
            { p_slug: slug }
        );

        if (error) {
            console.error('get_public_sales_channels_by_slug error:', error);
            throw error;
        }

        return data as PublicSalesChannelsResponse;
    },

    async getPublicPaymentMethodsBySlug(slug: string): Promise<PublicPaymentMethodsResponse> {
        const { data, error } = await supabaseCustomer.rpc(
            'get_public_payment_methods_by_slug',
            { p_slug: slug }
        );

        if (error) {
            console.error('get_public_payment_methods_by_slug error:', error);
            throw error;
        }

        return data as PublicPaymentMethodsResponse;
    },

    async getPublicDeliveryMethodsBySlug(slug: string): Promise<PublicDeliveryMethodsResponse> {
        const { data, error } = await supabaseCustomer.rpc(
            'get_public_delivery_methods_by_slug',
            { p_slug: slug }
        );

        if (error) {
            console.error('get_public_delivery_methods_by_slug error:', error);
            throw error;
        }

        return data as PublicDeliveryMethodsResponse;
    },

    toCatalogStore(store: PublicStorefrontStore) {
        return {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description || '',
            logo_url: store.logo_url || '',
            phone_number: store.phone_number || store.whatsapp?.digits || '',
            whatsapp: store.whatsapp,
            minimum_order_value: Number(store.minimum_order_value || 0),
            reservation_time_minutes: store.reservation_time_minutes || 10,
            public_catalog_enabled: Boolean(store.public_catalog_enabled),
            privacy_policy_text: store.privacy_policy_text || '',
            terms_of_use_text: store.terms_of_use_text || '',
            cookie_policy_text: store.cookie_policy_text || '',
            contacts: {
                whatsapp_business: store.whatsapp?.digits || store.phone_number || '',
            },
            config: {
                ...(store.visual_config || {}),
                timer_duration_minutes: store.reservation_time_minutes || 10,
            } as StoreConfig,
        };
    },
};
