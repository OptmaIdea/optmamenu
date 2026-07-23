import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';

interface UseActiveOrderCountOptions {
    storeId?: string | null;
    enabled?: boolean;
    intervalMs?: number;
}

export function useActiveOrderCount({
    storeId,
    enabled = true,
    intervalMs = 15_000,
}: UseActiveOrderCountOptions) {
    const [count, setCount] = useState(0);

    const refresh = useCallback(async () => {
        if (!storeId || !enabled) {
            setCount(0);
            return;
        }

        const { data, error } = await supabase.rpc('get_active_order_count', {
            p_store_id: storeId,
        });

        if (error || data?.ok === false) {
            console.error('[ActiveOrderCount] Não foi possível consultar pedidos ativos:', error || data);
            return;
        }

        setCount(Number(data?.count || 0));
    }, [storeId, enabled]);

    useEffect(() => {
        void refresh();
        if (!storeId || !enabled) return;

        const timer = window.setInterval(() => void refresh(), intervalMs);
        return () => window.clearInterval(timer);
    }, [storeId, enabled, intervalMs, refresh]);

    useRealtimeListener({
        channelName: `active_order_count_${storeId || 'pending'}`,
        tables: [
            {
                table: 'orders',
                ...(storeId ? { filter: `store_id=eq.${storeId}` } : {}),
            },
        ],
        onChanged: refresh,
        enabled: Boolean(storeId && enabled),
    });

    return { count, refresh };
}
