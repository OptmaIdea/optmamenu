import { supabaseCustomer } from '@/lib/supabase';

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

export const PublicOrderService = {
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