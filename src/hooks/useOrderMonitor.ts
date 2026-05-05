import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface MonitorOrder {
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
            intervalMs: 60_000,
        };
    }

    return {
        storeId: arg.storeId ?? null,
        enabled: arg.enabled ?? true,
        intervalMs: arg.intervalMs ?? 60_000,
    };
}

export function useOrderMonitor(arg?: UseOrderMonitorArg) {
    const { storeId, enabled = true, intervalMs = 60_000 } = normalizeOptions(arg);

    const runningRef = useRef(false);
    const timerRef = useRef<number | null>(null);

    const checkOrders = useCallback(async () => {
        if (!storeId || !enabled || runningRef.current) return;

        runningRef.current = true;

        try {
            const since = new Date(Date.now() - 3 * 60 * 1000).toISOString();

            const { data, error } = await supabase.rpc('get_order_monitor_pending_orders', {
                p_store_id: storeId,
                p_since: since,
                p_limit: 20,
            });

            if (error) {
                console.error('[OrderMonitor] Error fetching orders:', error);
                return;
            }

            if (!data?.ok) {
                if (data?.error) {
                    console.warn('[OrderMonitor] Monitor returned:', data.error);
                }
                return;
            }

            const orders = (data.orders || []) as MonitorOrder[];

            if (orders.length === 0) return;

            console.info('[OrderMonitor] Pending orders:', orders);
        } catch (err) {
            console.error('[OrderMonitor] Unexpected error:', err);
        } finally {
            runningRef.current = false;
        }
    }, [storeId, enabled]);

    useEffect(() => {
        if (!storeId || !enabled) return;

        checkOrders();

        timerRef.current = window.setInterval(() => {
            checkOrders();
        }, intervalMs);

        return () => {
            if (timerRef.current) {
                window.clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [storeId, enabled, intervalMs, checkOrders]);

    return {
        checkOrders,
    };
}