import type { PaymentMethod, OrderStatus } from '@/types';

export interface OrderItem {
    id: string;
    quantity: number;
    unit_price: number;
    product: {
        name: string;
        price?: number;
    } | null;
}

export interface Order {
    id: string;
    created_at: string;
    customer_name?: string;
    customer_phone?: string;
    total: number;
    status: OrderStatus;
    payment_method: PaymentMethod | string;
    store_id?: string;
    order_items?: OrderItem[];
    stock_reservations?: { expires_at: string }[];
}
