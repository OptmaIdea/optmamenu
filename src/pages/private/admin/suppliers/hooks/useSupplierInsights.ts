import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type SupplierRankingRow = {
    store_id: string;
    supplier_id: string;
    name: string;
    total_spent: number;
    total_documents: number;
    confirmed_documents: number;
    distinct_products: number;
    last_purchase_at: string | null;
    rank_position: number;
    share_pct: number;
    ranking_band: 'leader' | 'top_3' | 'top_10' | 'long_tail';
};

export type SupplierAlertRow = {
    store_id: string;
    supplier_id: string;
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
    alert_type:
    | 'no_history'
    | 'high_increase'
    | 'price_up'
    | 'price_down'
    | 'price_stable';
    is_best_price: boolean;
    purchase_age_interval: unknown;
};

export function useSupplierInsights(storeId?: string, supplierId?: string) {
    const [loading, setLoading] = useState(false);
    const [ranking, setRanking] = useState<SupplierRankingRow | null>(null);
    const [alerts, setAlerts] = useState<SupplierAlertRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        if (!storeId || !supplierId) {
            setRanking(null);
            setAlerts([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [rankingRes, alertsRes] = await Promise.all([
                supabase
                    .from('v_supplier_ranking')
                    .select('*')
                    .eq('store_id', storeId)
                    .eq('supplier_id', supplierId)
                    .maybeSingle(),

                supabase
                    .from('v_supplier_alerts')
                    .select('*')
                    .eq('store_id', storeId)
                    .eq('supplier_id', supplierId)
                    .order('delta_pct', { ascending: false }),
            ]);

            if (rankingRes.error) throw rankingRes.error;
            if (alertsRes.error) throw alertsRes.error;

            setRanking((rankingRes.data as SupplierRankingRow | null) ?? null);
            setAlerts((alertsRes.data as SupplierAlertRow[]) ?? []);
        } catch (err: any) {
            console.error('Error fetching supplier insights:', err);
            setError(err?.message ?? 'Erro ao carregar insights do fornecedor');
            setRanking(null);
            setAlerts([]);
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
        ranking,
        alerts,
        refresh: fetchAll,
    };
}