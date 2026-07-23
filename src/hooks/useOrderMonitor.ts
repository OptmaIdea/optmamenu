import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface MonitorOrder {
    id: string;
    created_at: string;
    status: string;
    customer_phone?: string | null;
    customer_name?: string | null;
    metadata?: Record<string, unknown> | null;
    order_code?: string | null;
    total?: number | string | null;
}

interface UseOrderMonitorOptions {
    storeId?: string | null;
    enabled?: boolean;
    intervalMs?: number;
}

type UseOrderMonitorArg = string | null | undefined | UseOrderMonitorOptions;

function normalizeOptions(arg?: UseOrderMonitorArg): UseOrderMonitorOptions {
    if (typeof arg === 'string' || arg === null || typeof arg === 'undefined') {
        return {
            storeId: arg ?? null,
            enabled: true,
            intervalMs: 15_000,
        };
    }

    return {
        storeId: arg.storeId ?? null,
        enabled: arg.enabled ?? true,
        intervalMs: arg.intervalMs ?? 15_000,
    };
}

export function useOrderMonitor(arg?: UseOrderMonitorArg) {
    const { storeId, enabled = true, intervalMs = 15_000 } = normalizeOptions(arg);
    const [orders, setOrders] = useState<MonitorOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const runningRef = useRef(false);
    const timerRef = useRef<number | null>(null);

    const checkOrders = useCallback(async () => {
        if (!storeId || !enabled || runningRef.current) return;

        runningRef.current = true;
        setLoading(true);

        try {
            const { data, error } = await supabase.rpc('get_order_monitor_pending_orders', {
                p_store_id: storeId,
                p_since: new Date(0).toISOString(),
                p_limit: 50,
            });

            if (error) {
                console.error('[OrderMonitor] Error fetching orders:', error);
                return;
            }

            if (!data?.ok) {
                if (data?.error) console.warn('[OrderMonitor] Monitor returned:', data.error);
                return;
            }

            setOrders((data.orders || []) as MonitorOrder[]);
        } catch (err) {
            console.error('[OrderMonitor] Unexpected error:', err);
        } finally {
            runningRef.current = false;
            setLoading(false);
        }
    }, [storeId, enabled]);

    useEffect(() => {
        if (!storeId || !enabled) {
            setOrders([]);
            return;
        }

        void checkOrders();

        timerRef.current = window.setInterval(() => {
            void checkOrders();
        }, intervalMs);

        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [storeId, enabled, intervalMs, checkOrders]);

    return {
        orders,
        pendingCount: orders.length,
        loading,
        checkOrders,
    };
}
