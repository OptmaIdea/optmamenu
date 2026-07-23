import { supabaseCustomer, supabasePublic } from '@/lib/supabase';

export type PublicFulfillmentType = 'pickup' | 'delivery' | 'qr_table' | 'dine_in' | 'other';

export type PublicSalesChannel =
    | 'whatsapp'
    | 'public_store'
    | 'qr_table'
    | 'direct'
    | 'phone'
    | 'in_person'
    | 'other';

export interface PublicOrderItemInput {
    product_id: string;
    quantity: number;
}

export interface PublicDeliveryAddressInput {
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    reference?: string;
}

export interface CreatePublicOrderInput {
    slug: string;
    customer_name: string;
    customer_phone: string;
    fulfillment_type: PublicFulfillmentType;
    sales_channel: PublicSalesChannel;
    payment_method_code?: string;
    delivery_method_code?: string;
    items: PublicOrderItemInput[];
    delivery_address?: PublicDeliveryAddressInput;
    table_code?: string | null;
    notes?: string | null;
}

export interface CreatePublicOrderResponse {
    ok: boolean;
    error?: string;
    message?: string;
    minimum_order_value?: number;
    current_total?: number;
    product_id?: string;
    product_name?: string;
    order?: {
        id: string;
        order_code: string;
        subtotal?: number;
        delivery_fee?: number;
        total: number;
        status: string;
        sales_channel: PublicSalesChannel;
        fulfillment_type: PublicFulfillmentType;
        delivery_method_code?: string;
        delivery_method_name?: string;
        expires_at: string;
        reservation_minutes: number;
        public_order_token: string;
    };
    whatsapp?: {
        digits?: string;
        message?: string;
        url?: string;
    };
}

export interface PublicOrderTrackingItem {
    name: string;
    quantity: number;
    unit_price: number;
    discount: number;
    line_total: number;
}

export interface PublicOrderTrackingResponse {
    ok: boolean;
    error?: string;
    store?: {
        name: string;
        slug: string;
        logo_url?: string | null;
    };
    order?: {
        order_code: string;
        status: string;
        customer_name?: string | null;
        subtotal: number;
        delivery_fee: number;
        total: number;
        sales_channel: string;
        fulfillment_type: string;
        delivery_method_name?: string | null;
        payment_method_name?: string | null;
        table_code?: string | null;
        created_at: string;
        confirmed_at?: string | null;
        completed_at?: string | null;
        expires_at?: string | null;
        items: PublicOrderTrackingItem[];
    };
}

export const PublicOrderService = {
    async getPublicOrderByToken(token: string): Promise<PublicOrderTrackingResponse> {
        const normalizedToken = decodeURIComponent(token).trim();
        const { data, error } = await supabasePublic.rpc('get_public_order_by_token', {
            p_token: normalizedToken,
        });

        if (error) {
            console.error('get_public_order_by_token error:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
            });
            throw error;
        }

        return data as PublicOrderTrackingResponse;
    },

    async createPublicOrder(input: CreatePublicOrderInput): Promise<CreatePublicOrderResponse> {
        const { data, error } = await supabaseCustomer.rpc('create_public_order_by_slug', {
            p_slug: input.slug,
            p_customer_name: input.customer_name,
            p_customer_phone: input.customer_phone,
            p_fulfillment_type: input.fulfillment_type,
            p_sales_channel: input.sales_channel,
            p_payment_method_code: input.payment_method_code || 'pending',
            p_delivery_method_code: input.delivery_method_code || null,
            p_items: input.items,
            p_delivery_address: input.delivery_address || {},
            p_table_code: input.table_code || null,
            p_notes: input.notes || null,
        });

        if (error) {
            console.error('create_public_order_by_slug error:', error);
            throw error;
        }

        return data as CreatePublicOrderResponse;
    },
};
