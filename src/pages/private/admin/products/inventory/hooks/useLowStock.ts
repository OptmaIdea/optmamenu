import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

type UseLowStockResult = {
    loading: boolean;
    error: string | null;

    // Contagens (sempre excluindo descontinuados)
    activeCount: number;
    zeroCount: number;     // stock_quantity === 0
    lowCount: number;      // 0 < stock_quantity <= min_stock
    excessCount: number;   // stock_quantity > max_stock
    criticalCount: number; // zero + low

    // Dados úteis
    refreshedAt: Date | null;
    refresh: () => Promise<void>;
};

// Regras default (alinhadas com seu Dashboard)
const DEFAULT_MIN_STOCK = 5;
const DEFAULT_MAX_STOCK = 20;

export function useLowStock(storeId?: string, opts?: { autoRefreshMs?: number }): UseLowStockResult {
    const autoRefreshMs = opts?.autoRefreshMs ?? 5 * 60 * 1000;

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [activeCount, setActiveCount] = useState(0);
    const [zeroCount, setZeroCount] = useState(0);
    const [lowCount, setLowCount] = useState(0);
    const [excessCount, setExcessCount] = useState(0);

    const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

    const criticalCount = useMemo(() => zeroCount + lowCount, [zeroCount, lowCount]);

    const refresh = useCallback(async () => {
        if (!storeId) {
            setLoading(false);
            setError(null);
            setActiveCount(0);
            setZeroCount(0);
            setLowCount(0);
            setExcessCount(0);
            setRefreshedAt(new Date());
            return;
        }

        try {
            setLoading(true);
            setError(null);

            // Importante: excluir descontinuados (existem 2 flags no seu schema)
            const { data, error: qErr } = await supabase
                .from('products')
                .select('id, stock_quantity, min_stock, max_stock')
                .eq('store_id', storeId)
                .eq('active', true)
                .eq('discontinued', false)
                .eq('is_discontinued', false);

            if (qErr) throw qErr;

            const products = (data || []).map((p: any) => ({
                stock: Number(p.stock_quantity ?? 0),
                min: Number(p.min_stock ?? DEFAULT_MIN_STOCK),
                max: Number(p.max_stock ?? DEFAULT_MAX_STOCK),
            }));

            const zero = products.filter((p) => p.stock === 0).length;
            const low = products.filter((p) => p.stock > 0 && p.stock <= p.min).length;
            const excess = products.filter((p) => p.stock > p.max).length;

            setActiveCount(products.length);
            setZeroCount(zero);
            setLowCount(low);
            setExcessCount(excess);
            setRefreshedAt(new Date());
        } catch (e: any) {
            console.error('useLowStock error:', e);
            setError(e?.message || 'Erro ao carregar alertas de estoque.');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (!storeId) return;

        const interval = setInterval(() => {
            refresh();
        }, autoRefreshMs);

        return () => clearInterval(interval);
    }, [storeId, autoRefreshMs, refresh]);

    return {
        loading,
        error,
        activeCount,
        zeroCount,
        lowCount,
        excessCount,
        criticalCount,
        refreshedAt,
        refresh,
    };
}