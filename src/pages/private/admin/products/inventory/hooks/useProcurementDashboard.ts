import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';

export type ProcurementSummaryRow = {
    store_id: string;
    confirmed_documents: number;
    active_suppliers: number;
    purchased_products: number;
    total_spent: number;
    avg_ticket: number | null;
    weighted_avg_unit_cost: number;
    first_purchase_date: string | null;
    last_purchase_date: string | null;
};

export type ProcurementTopSupplierRow = {
    store_id: string;
    supplier_id: string;
    supplier_name: string;
    confirmed_documents: number;
    distinct_products: number;
    total_quantity: number;
    total_spent: number;
    last_purchase_date: string | null;
    rank_position: number;
    share_pct: number;
};

export type ProcurementTopProductRow = {
    store_id: string;
    product_id: string;
    product_name: string;
    confirmed_documents: number;
    suppliers_count: number;
    total_quantity: number;
    total_spent: number;
    avg_unit_cost: number | null;
    min_unit_cost: number | null;
    max_unit_cost: number | null;
    last_purchase_date: string | null;
};

export type ProcurementTopProductBySupplierRow = {
    store_id: string;
    supplier_id: string;
    supplier_name: string;
    product_id: string;
    product_name: string;
    confirmed_documents: number;
    total_quantity: number;
    total_spent: number;
    avg_unit_cost: number | null;
    min_unit_cost: number | null;
    max_unit_cost: number | null;
    last_purchase_date: string | null;
};

export type ProcurementPriceAlertRow = {
    store_id: string;
    supplier_id: string;
    supplier_name: string;
    product_id: string;
    product_name: string;
    current_unit_cost: number;
    previous_unit_cost: number | null;
    delta_abs: number | null;
    delta_pct: number | null;
    current_purchase_at: string | null;
    best_unit_cost: number | null;
    best_price_gap_abs: number | null;
    best_price_gap_pct: number | null;
    alert_type: string;
    is_best_price: boolean;
};

export type ProcurementStaleSupplierRow = {
    store_id: string;
    supplier_id: string;
    supplier_name: string;
    total_spent: number;
    confirmed_documents: number;
    distinct_products: number;
    last_purchase_at: string | null;
    days_since_last_purchase: number | null;
    recency_status: 'no_history' | 'recent' | 'warm' | 'stale';
};

export function useProcurementDashboard() {
    const { storeId } = useCurrentStore();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [summary, setSummary] = useState<ProcurementSummaryRow | null>(null);
    const [topSuppliers, setTopSuppliers] = useState<ProcurementTopSupplierRow[]>([]);
    const [topProducts, setTopProducts] = useState<ProcurementTopProductRow[]>([]);
    const [topProductsBySupplier, setTopProductsBySupplier] = useState<
        ProcurementTopProductBySupplierRow[]
    >([]);
    const [priceAlerts, setPriceAlerts] = useState<ProcurementPriceAlertRow[]>([]);
    const [staleSuppliers, setStaleSuppliers] = useState<ProcurementStaleSupplierRow[]>([]);

    const fetchDashboard = useCallback(async () => {
        if (!storeId) {
            setSummary(null);
            setTopSuppliers([]);
            setTopProducts([]);
            setTopProductsBySupplier([]);
            setPriceAlerts([]);
            setStaleSuppliers([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [
                summaryRes,
                topSuppliersRes,
                topProductsRes,
                topProductsBySupplierRes,
                priceAlertsRes,
                staleSuppliersRes,
            ] = await Promise.all([
                supabase
                    .from('v_procurement_summary')
                    .select('*')
                    .eq('store_id', storeId)
                    .maybeSingle(),

                supabase
                    .from('v_procurement_top_suppliers')
                    .select('*')
                    .eq('store_id', storeId)
                    .order('total_spent', { ascending: false }),

                supabase
                    .from('v_procurement_top_products')
                    .select('*')
                    .eq('store_id', storeId)
                    .order('total_spent', { ascending: false }),

                supabase
                    .from('v_procurement_top_products_by_supplier')
                    .select('*')
                    .eq('store_id', storeId)
                    .order('total_spent', { ascending: false }),

                supabase
                    .from('v_procurement_top_price_increases')
                    .select('*')
                    .eq('store_id', storeId)
                    .order('delta_pct', { ascending: false }),

                supabase
                    .from('v_procurement_stale_suppliers')
                    .select('*')
                    .eq('store_id', storeId)
                    .in('recency_status', ['stale', 'no_history'])
                    .order('days_since_last_purchase', { ascending: false }),
            ]);

            if (summaryRes.error) throw summaryRes.error;
            if (topSuppliersRes.error) throw topSuppliersRes.error;
            if (topProductsRes.error) throw topProductsRes.error;
            if (topProductsBySupplierRes.error) throw topProductsBySupplierRes.error;
            if (priceAlertsRes.error) throw priceAlertsRes.error;
            if (staleSuppliersRes.error) throw staleSuppliersRes.error;

            setSummary((summaryRes.data as ProcurementSummaryRow | null) ?? null);
            setTopSuppliers((topSuppliersRes.data as ProcurementTopSupplierRow[]) ?? []);
            setTopProducts((topProductsRes.data as ProcurementTopProductRow[]) ?? []);
            setTopProductsBySupplier(
                (topProductsBySupplierRes.data as ProcurementTopProductBySupplierRow[]) ?? [],
            );
            setPriceAlerts((priceAlertsRes.data as ProcurementPriceAlertRow[]) ?? []);
            setStaleSuppliers((staleSuppliersRes.data as ProcurementStaleSupplierRow[]) ?? []);
        } catch (err: any) {
            console.error('Error fetching procurement dashboard:', err);
            setError(err?.message ?? 'Erro ao carregar dashboard de compras');
            setSummary(null);
            setTopSuppliers([]);
            setTopProducts([]);
            setTopProductsBySupplier([]);
            setPriceAlerts([]);
            setStaleSuppliers([]);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        void fetchDashboard();
    }, [fetchDashboard]);

    return {
        loading,
        error,
        summary,
        topSuppliers,
        topProducts,
        topProductsBySupplier,
        priceAlerts,
        staleSuppliers,
        refresh: fetchDashboard,
    };
}