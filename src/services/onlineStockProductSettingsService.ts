import { supabase } from '@/lib/supabase';

export interface OnlineStockProductPolicy {
    id?: string;
    store_id: string;
    product_id: string;
    published: boolean;
    local_reserve: number | null;
    online_limit: number | null;
    low_stock_threshold: number | null;
    show_exact_stock: boolean | null;
}

export interface OnlineStockProductRow {
    product_id: string;
    name: string;
    category_id?: string | null;
    category_name?: string | null;
    active: boolean;
    image_url?: string | null;
    on_hand: number;
    reserved: number;
    available: number;
    policy: OnlineStockProductPolicy | null;
}

export interface SaveOnlineStockProductPolicyInput {
    store_id: string;
    product_id: string;
    published: boolean;
    local_reserve: number | null;
    online_limit: number | null;
    low_stock_threshold: number | null;
    show_exact_stock: boolean | null;
}

function asNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function firstImage(value: unknown): string | null {
    if (Array.isArray(value)) {
        const image = value.find((item) => typeof item === 'string' && item.trim());
        return typeof image === 'string' ? image : null;
    }
    return null;
}

export const OnlineStockProductSettingsService = {
    async list(storeId: string, locationId?: string | null): Promise<OnlineStockProductRow[]> {
        const [productsResult, categoriesResult, policiesResult, balancesResult] = await Promise.all([
            supabase
                .from('products')
                .select('id, name, category_id, active, images')
                .eq('store_id', storeId)
                .eq('discontinued', false)
                .eq('is_discontinued', false)
                .order('name', { ascending: true }),
            supabase
                .from('categories')
                .select('id, name')
                .eq('store_id', storeId),
            supabase
                .from('storefront_product_settings')
                .select('id, store_id, product_id, published, local_reserve, online_limit, low_stock_threshold, show_exact_stock')
                .eq('store_id', storeId),
            locationId
                ? supabase
                    .from('inventory_location_balances')
                    .select('product_id, on_hand, reserved')
                    .eq('store_id', storeId)
                    .eq('location_id', locationId)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (productsResult.error) throw productsResult.error;
        if (categoriesResult.error) throw categoriesResult.error;
        if (policiesResult.error) throw policiesResult.error;
        if (balancesResult.error) throw balancesResult.error;

        const categoryNames = new Map((categoriesResult.data || []).map((category) => [category.id, category.name]));
        const policies = new Map((policiesResult.data || []).map((policy) => [policy.product_id, policy as OnlineStockProductPolicy]));
        const balances = new Map<string, { on_hand: number; reserved: number }>();

        for (const balance of balancesResult.data || []) {
            const current = balances.get(balance.product_id) || { on_hand: 0, reserved: 0 };
            current.on_hand += asNumber(balance.on_hand);
            current.reserved += asNumber(balance.reserved);
            balances.set(balance.product_id, current);
        }

        return (productsResult.data || []).map((product) => {
            const balance = balances.get(product.id) || { on_hand: 0, reserved: 0 };
            return {
                product_id: product.id,
                name: product.name,
                category_id: product.category_id,
                category_name: product.category_id ? categoryNames.get(product.category_id) || null : null,
                active: Boolean(product.active),
                image_url: firstImage(product.images),
                on_hand: balance.on_hand,
                reserved: balance.reserved,
                available: Math.max(0, balance.on_hand - balance.reserved),
                policy: policies.get(product.id) || null,
            };
        });
    },

    async save(input: SaveOnlineStockProductPolicyInput): Promise<OnlineStockProductPolicy> {
        const payload = {
            store_id: input.store_id,
            product_id: input.product_id,
            published: input.published,
            local_reserve: input.local_reserve,
            online_limit: input.online_limit,
            low_stock_threshold: input.low_stock_threshold,
            show_exact_stock: input.show_exact_stock,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('storefront_product_settings')
            .upsert(payload, { onConflict: 'store_id,product_id' })
            .select('id, store_id, product_id, published, local_reserve, online_limit, low_stock_threshold, show_exact_stock')
            .single();

        if (error) throw error;
        return data as OnlineStockProductPolicy;
    },

    async reset(storeId: string, productId: string): Promise<void> {
        const { error } = await supabase
            .from('storefront_product_settings')
            .delete()
            .eq('store_id', storeId)
            .eq('product_id', productId);

        if (error) throw error;
    },
};
