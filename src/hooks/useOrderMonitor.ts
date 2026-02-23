// src/hooks/useOrderMonitor.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useOrderMonitor(storeId?: string) {
    useEffect(() => {
        if (!storeId) return;

        const checkOrders = async () => {
            console.log('🔍 [OrderMonitor] Checking for pending orders...');

            const { data: orders, error: ordersError } = await supabase
                .from('orders')
                .select('id, created_at, status, customer_phone, customer_name, metadata')
                .eq('store_id', storeId)
                .in('status', ['reserved'])
                .gt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
                .is('metadata->notified_3min', null);

            if (ordersError) {
                console.error('[OrderMonitor] Error fetching orders:', ordersError);
                return;
            }

            if (!orders || orders.length === 0) return;

            // ✅ RPC (evita . from('stores') e stack depth)
            const { data: storeRows, error: storeRpcError } = await supabase.rpc(
                'get_store_config_admin',
                { p_store_id: storeId }
            );

            if (storeRpcError) {
                console.error('[OrderMonitor] Error fetching store config:', storeRpcError);
                return;
            }

            const store = Array.isArray(storeRows) ? storeRows[0] : storeRows;
            if (!store) return;

            const timerDuration = store.config?.timer_duration_minutes || 10;
            const now = new Date();

            for (const order of orders) {
                const createdAt = new Date(order.created_at);
                const expiresAt = new Date(createdAt.getTime() + timerDuration * 60000);
                const timeLeftMinutes = (expiresAt.getTime() - now.getTime()) / 60000;

                if (timeLeftMinutes <= 3.5 && timeLeftMinutes > 0) {
                    console.log(
                        `⚠️ [OrderMonitor] Order #${order.id} is expiring soon (${timeLeftMinutes.toFixed(
                            1
                        )}m left). Sending warning...`
                    );

                    await send3MinWarning(order, store.sms_gateway_token);

                    await supabase
                        .from('orders')
                        .update({
                            metadata: {
                                ...(order.metadata || {}),
                                notified_3min: new Date().toISOString(),
                            },
                        })
                        .eq('id', order.id);
                }
            }
        };

        const interval = setInterval(checkOrders, 60 * 1000);
        checkOrders();

        return () => clearInterval(interval);
    }, [storeId]);

    const send3MinWarning = async (order: any, token: string) => {
        if (!token) {
            console.warn('[OrderMonitor] No SMS Token. Skipping message.');
            return;
        }

        const message = `Ola ${order.customer_name}, seu tempo de reserva do pedido #${order.id
            .toString()
            .slice(0, 8)} esta acabando! Restam 3 minutos. Responda para manter sua reserva.`;

        const phone = order.customer_phone.replace(/\D/g, '');

        try {
            await fetch('https://optmasmsgate.vercel.app/api/v1/sms/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ to: phone, message }),
            });

            toast.info(`Notificação de 3min enviada para pedido #${order.id}`);
        } catch (e) {
            console.error('[OrderMonitor] Failed to send SMS', e);
        }
    };
}