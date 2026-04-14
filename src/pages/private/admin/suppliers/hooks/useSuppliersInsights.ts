import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';

export type SupplierListInsight = {
    supplier_id: string;
    rank_position: number | null;
    share_pct: number | null;
    ranking_band: 'leader' | 'top_3' | 'top_10' | 'long_tail' | null;
    total_spent: number | null;
    distinct_products: number | null;
    last_purchase_at: string | null;
    confirmed_documents: number | null;
};

export function useSuppliersInsights() {
    const { storeId } = useCurrentStore();
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<Record<string, SupplierListInsight>>({});
    const [error, setError] = useState<string | null>(null);

    const fetchInsights = useCallback(async () => {
        if (!storeId) {
            setInsights({});
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [rankingRes, metricsRes] = await Promise.all([
                supabase
                    .from('v_supplier_ranking')
                    .select('supplier_id, rank_position, share_pct, ranking_band')
                    .eq('store_id', storeId),

                supabase
                    .from('v_supplier_metrics')
                    .select('supplier_id, total_spent, distinct_products, last_purchase_at, confirmed_documents')
                    .eq('store_id', storeId),
            ]);

            if (rankingRes.error) throw rankingRes.error;
            if (metricsRes.error) throw metricsRes.error;

            const merged: Record<string, SupplierListInsight> = {};

            for (const row of metricsRes.data ?? []) {
                merged[row.supplier_id] = {
                    supplier_id: row.supplier_id,
                    rank_position: null,
                    share_pct: null,
                    ranking_band: null,
                    total_spent: row.total_spent ?? 0,
                    distinct_products: row.distinct_products ?? 0,
                    last_purchase_at: row.last_purchase_at ?? null,
                    confirmed_documents: row.confirmed_documents ?? 0,
                };
            }

            for (const row of rankingRes.data ?? []) {
                merged[row.supplier_id] = {
                    supplier_id: row.supplier_id,
                    rank_position: row.rank_position ?? null,
                    share_pct: row.share_pct ?? null,
                    ranking_band: row.ranking_band ?? null,
                    total_spent: merged[row.supplier_id]?.total_spent ?? 0,
                    distinct_products: merged[row.supplier_id]?.distinct_products ?? 0,
                    last_purchase_at: merged[row.supplier_id]?.last_purchase_at ?? null,
                    confirmed_documents: merged[row.supplier_id]?.confirmed_documents ?? 0,
                };
            }

            setInsights(merged);
        } catch (err: any) {
            console.error('Error fetching suppliers insights:', err);
            setError(err?.message ?? 'Erro ao carregar insights dos fornecedores');
            setInsights({});
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        void fetchInsights();
    }, [fetchInsights]);

    return {
        loading,
        error,
        insights,
        refreshInsights: fetchInsights,
    };
}