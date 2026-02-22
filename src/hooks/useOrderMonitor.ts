
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function useOrderMonitor(storeId?: string) {
    useEffect(() => {
        if (!storeId) return;

        const checkOrders = async () => {
            console.log('🔍 [OrderMonitor] Checking for pending orders...');

            // 1. Get Pending Orders that are not yet expired but close to expiring
            // We need orders where:
            // - Status is pending/reserved
            // - Not cancelled
            // - Created recently (within last 30 mins to avoid old junk)
            const { data: orders, error } = await supabase
                .from('orders')
                .select('id, created_at, status, customer_phone, customer_name, metadata')
                .eq('store_id', storeId)
                .in('status', ['reserved'])
                .gt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 mins
                .is('metadata->notified_3min', null); // Only if not notified

            if (error) {
                console.error('[OrderMonitor] Error fetching orders:', error);
                return;
            }

            if (!orders || orders.length === 0) return;

            // 2. Fetch Store Config for Timer Duration
            const { data: store } = await supabase
                .from('stores')
                .select('config, sms_gateway_token')
                .eq('id', storeId)
                .maybeSingle();

            if (!store) return;

            const timerDuration = store.config?.timer_duration_minutes || 10;
            const now = new Date();

            for (const order of orders) {
                const createdAt = new Date(order.created_at);
                const expiresAt = new Date(createdAt.getTime() + timerDuration * 60000);
                const timeLeftMinutes = (expiresAt.getTime() - now.getTime()) / 60000;

                // Logic: If time left is between 2.5 and 3.5 minutes (approx 3 min mark)
                // We use a window because polling is every 60s.
                // If polling is 60s, we might miss exact 3.0. 
                // Let's say: If time left <= 3.5 minutes AND > 0

                if (timeLeftMinutes <= 3.5 && timeLeftMinutes > 0) {
                    console.log(`⚠️ [OrderMonitor] Order #${order.id} is expiring soon (${timeLeftMinutes.toFixed(1)}m left). Sending warning...`);

                    // SEND NOTIFICATION
                    await send3MinWarning(order, store.sms_gateway_token);

                    // MARK AS NOTIFIED
                    await supabase
                        .from('orders')
                        .update({
                            metadata: {
                                ...(order.metadata || {}),
                                notified_3min: new Date().toISOString()
                            }
                        })
                        .eq('id', order.id);
                }
            }
        };

        const interval = setInterval(checkOrders, 60 * 1000); // Check every minute
        checkOrders(); // Run immediately on mount

        return () => clearInterval(interval);
    }, [storeId]);

    const send3MinWarning = async (order: any, token: string) => {
        if (!token) {
            console.warn('[OrderMonitor] No SMS Token. Skipping message.');
            return;
        }

        const message = `Ola ${order.customer_name}, seu tempo de reserva do pedido #${order.id.toString().slice(0, 8)} esta acabando! Restam 3 minutos. Responda para manter sua reserva.`;
        const phone = order.customer_phone.replace(/\D/g, '');

        try {
            // Using the specific API endpoint mentioned in previous context or generic one?
            // Context mentions: https://optmasmsgate.vercel.app/api/v1/sms/send
            // But I should double check if I have the URL. I'll use a generic fetch here.
            await fetch('https://optmasmsgate.vercel.app/api/v1/sms/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    to: phone,
                    message: message
                })
            });
            toast.info(`Notificação de 3min enviada para pedido #${order.id}`);
        } catch (e) {
            console.error('[OrderMonitor] Failed to send SMS', e);
        }
    };
}
