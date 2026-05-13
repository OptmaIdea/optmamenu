import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type SupplierMetricsRow = {
    store_id: string;
    supplier_id: string;
    name: string;
    active: boolean;
    total_documents: number;
    confirmed_documents: number;
    cancelled_documents: number;
    distinct_products: number;
    total_quantity: number;
    total_spent: number;
    avg_ticket: number;
    first_purchase_at: string | null;
    last_purchase_at: string | null;
};

export type SupplierProductMetricRow = {
    store_id: string;
    supplier_id: string;
    product_id: string;
    product_name: string;
    purchase_events: number;
    total_quantity: number;
    total_spent: number;
    avg_unit_cost: number;
    min_unit_cost: number;
    max_unit_cost: number;
    first_purchase_at: string | null;
    last_purchase_at: string | null;
};

export type SupplierPriceVariationRow = {
    store_id: string;
    supplier_id: string;
    product_id: string;
    product_name: string;
    current_unit_cost: number;
    previous_unit_cost: number | null;
    delta_abs: number | null;
    delta_pct: number | null;
    current_purchase_at: string | null;
};

export function useSupplierMetrics(storeId?: string, supplierId?: string) {
    const [loading, setLoading] = useState(false);
    const [metrics, setMetrics] = useState<SupplierMetricsRow | null>(null);
    const [products, setProducts] = useState<SupplierProductMetricRow[]>([]);
    const [variations, setVariations] = useState<SupplierPriceVariationRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        if (!storeId || !supplierId) {
            setMetrics(null);
            setProducts([]);
            setVariations([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [metricsRes, productsRes, variationsRes] = await Promise.all([
                supabase
                    .from('v_supplier_metrics')
                    .select('*')
                    .eq('store_id', storeId)
                    .eq('supplier_id', supplierId)
                    .maybeSingle(),

                supabase
                    .from('v_supplier_product_metrics')
                    .select('*')
                    .eq('store_id', storeId)
                    .eq('supplier_id', supplierId)
                    .order('total_spent', { ascending: false }),

                supabase
                    .from('v_supplier_price_variation')
                    .select('*')
                    .eq('store_id', storeId)
                    .eq('supplier_id', supplierId)
                    .order('delta_pct', { ascending: false }),
            ]);

            if (metricsRes.error) throw metricsRes.error;
            if (productsRes.error) throw productsRes.error;
            if (variationsRes.error) throw variationsRes.error;

            setMetrics((metricsRes.data as SupplierMetricsRow | null) ?? null);
            setProducts((productsRes.data as SupplierProductMetricRow[]) ?? []);
            setVariations((variationsRes.data as SupplierPriceVariationRow[]) ?? []);
        } catch (err: any) {
            console.error('Error fetching supplier metrics:', err);
            setError(err?.message ?? 'Erro ao carregar métricas do fornecedor');
            setMetrics(null);
            setProducts([]);
            setVariations([]);
        } finally {
            setLoading(false);
        }
    }, [storeId, supplierId]);

    useEffect(() => {
        void fetchAll();
    }, [fetchAll]);

    return {
        loading,
        error,
        metrics,
        products,
        variations,
        refresh: fetchAll,
    };
}