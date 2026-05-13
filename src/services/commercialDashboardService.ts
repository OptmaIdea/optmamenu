import { supabase } from '@/lib/supabase';

export interface CommercialDashboardSummary {
    today_sales: number;
    today_orders: number;
    today_completed_orders: number;
    month_sales: number;
    month_completed_orders: number;
    period_sales: number;
    period_orders: number;
    period_completed_orders: number;
    period_average_ticket: number;
}

export interface CommercialDashboardStatus {
    status: string;
    count: number;
    total: number;
}

export interface CommercialDashboardChannel {
    sales_channel: string;
    count: number;
    total: number;
}

export interface CommercialDashboardTopProduct {
    product_id: string | null;
    product_name: string;
    quantity: number;
    total: number;
}

export interface CommercialDashboardRecentOrder {
    id: string;
    order_code: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    total: number;
    status: string;
    sales_channel: string | null;
    fulfillment_type: string | null;
    payment_method_code: string | null;
    created_at: string;
    confirmed_at: string | null;
    completed_at: string | null;
}

export interface CommercialDashboardCashbook {
    period_entries: number;
    period_outputs: number;
    period_balance: number;
    month_entries: number;
    month_outputs: number;
}

export interface CommercialDashboardLoyalty {
    period_points_issued: number;
    period_transactions: number;
    active_customers_with_points: number;
}

export interface CommercialDashboardCustomers {
    total_customers: number;
    new_customers_period: number;
    customer_owned: number;
    store_managed: number;
    loyalty_opt_in: number;
}

export interface CommercialDashboardData {
    summary: CommercialDashboardSummary;
    orders_by_status: CommercialDashboardStatus[];
    sales_by_channel: CommercialDashboardChannel[];
    top_products: CommercialDashboardTopProduct[];
    recent_orders: CommercialDashboardRecentOrder[];
    cashbook: CommercialDashboardCashbook;
    loyalty: CommercialDashboardLoyalty;
    customers: CommercialDashboardCustomers;
}

export const CommercialDashboardService = {
    async getDashboard(input: {
        storeId: string;
        startDate?: string | null;
        endDate?: string | null;
    }): Promise<CommercialDashboardData> {
        const { data, error } = await supabase.rpc('get_commercial_dashboard_safe', {
            p_store_id: input.storeId,
            p_start_date: input.startDate || null,
            p_end_date: input.endDate || null,
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.error || 'Erro ao carregar dashboard comercial.');
        }

        return {
            summary: data.summary,
            orders_by_status: data.orders_by_status || [],
            sales_by_channel: data.sales_by_channel || [],
            top_products: data.top_products || [],
            recent_orders: data.recent_orders || [],
            cashbook: data.cashbook,
            loyalty: data.loyalty,
            customers: data.customers,
        };
    },
};