import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import type { Order, OrderStatus, StoreConfig } from '@/types';
import PageContainer from '@/components/common/PageContainer';
import OrderStatusFilter from '@/components/common/OrderStatusFilter';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [storeData, setStoreData] = useState<{ id: string, name: string, token: string, config?: StoreConfig } | null>(null);
    const [now, setNow] = useState(new Date());

    // Filter displayed orders locally if 'current' is selected
    const displayedOrders = useMemo(() => {
        if (filterStatus === 'current') {
            return orders.filter(o => o.status === 'reserved' || o.status === 'confirmed');
        }
        return orders;
    }, [orders, filterStatus]);

    const emptyStateMessage = filterStatus === 'current'
        ? 'Pedidos atuais mostra apenas novos/em preparo. Vendas diretas já concluídas aparecem em Todos os Status ou Finalizados.'
        : 'Nenhum pedido encontrado para o filtro selecionado.';

    // Fetch orders
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // First get the store for this user via RPC (agora retorna todos os campos)
            const { data: storeRpcData, error: storeRpcError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (storeRpcError) throw storeRpcError;
            const store = Array.isArray(storeRpcData) ? storeRpcData[0] : storeRpcData;

            if (!store) {
                setLoading(false);
                return;
            }

            setStoreData({ id: store.id, name: store.name, token: store.sms_gateway_token, config: store.config });

            const rpcStatus = (filterStatus === 'all' || filterStatus === 'current') ? 'all' : filterStatus;

            const { data: result, error } = await supabase.rpc('get_admin_orders_safe', {
                p_store_id: store.id,
                p_status: rpcStatus,
                p_limit: 200,
            });

            if (error) {
                console.error('Error fetching orders:', error);
                throw error;
            }

            if (!result?.ok) {
                throw new Error(result?.error || 'Erro ao buscar pedidos.');
            }

            setOrders(result.orders || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    // Initial Load & Load on filterStatus change
    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Connect to global refresh frame
    useRefreshFrame(fetchOrders);

    // Handle changes in orders via Realtime
    const handleOrdersChange = useCallback(() => {
        fetchOrders();
        // Play Sound
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => { });
    }, [fetchOrders]);

    // Listen to changes in orders table in real-time
    useRealtimeListener({
        channelName: `orders_rt_${storeData?.id || 'pending'}`,
        tables: [
            {
                table: 'orders',
                ...(storeData?.id ? { filter: `store_id=eq.${storeData.id}` } : {})
            }
        ],
        onChanged: handleOrdersChange,
        enabled: !!storeData?.id,
    });

    // Update 'now' every second for the UI timers
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Monitor Expirations every 30 seconds
    useEffect(() => {
        const monitor = setInterval(checkExpirations, 30000);
        return () => clearInterval(monitor);
    }, [orders]);

    async function checkExpirations() {
        if (!storeData) return;

        orders.forEach(async (order) => {
            if (order.status !== 'reserved' || !order.stock_reservations?.[0]) return;

            const expiresAt = new Date(order.stock_reservations[0].expires_at).getTime();
            const timeRemaining = expiresAt - Date.now();
            const minutesRemaining = timeRemaining / 60000;

            // Warning: Less than 3 minutes and NOT already warned (local check avoided for simplicity, just log/console for now to avoid spamming user in this version)
            // In a real app, we'd flag 'warned' in DB or local state map. 
            // For MVP: We will auto-cancel if expired.

            if (minutesRemaining <= 0) {
                console.log(`Order ${order.id} expired. Cancelling...`);
                await supabase.rpc('cancel_expired_reservations', { p_store_id: storeData.id });

                const sentKey = `cancelled_sms_${order.id}`;
                if (!localStorage.getItem(sentKey)) {
                    sendSmsNotification(order, 'cancelled');
                    localStorage.setItem(sentKey, 'true');
                }
                fetchOrders();
            } else if (minutesRemaining <= 3 && minutesRemaining > 2.0) {
                // Trigger One-time warning
                const sentKey = `warning_sms_${order.id}`;
                if (!localStorage.getItem(sentKey)) {
                    console.warn(`Sending warning for Order ${order.id}`);
                    sendSmsNotification(order, 'warning');
                    localStorage.setItem(sentKey, 'true');
                }
            }
        });
    }

    async function extendReservation(orderId: string) {
        const extensionMinutes = storeData?.config?.extension_minutes || 10;
        if (!confirm(`Deseja prorrogar a reserva em ${extensionMinutes} minutos?`)) return;
        try {
            const { error } = await supabase.rpc('extend_reservation', {
                p_order_id: orderId,
                p_minutes: extensionMinutes
            });

            if (error) throw error;
            alert('Reserva prorrogada com sucesso!');
            fetchOrders();
        } catch (error) {
            console.error('Extension error:', error);
            const message = error instanceof Error ? error.message : 'Erro desconhecido';
            alert('Erro ao prorrogar: ' + message);
        }
    }

    // Send SMS / WhatsApp via OptmaSMSGate
    async function sendSmsNotification(order: Order, type: 'prepared' | 'ready' | 'warning' | 'cancelled') {
        if (!storeData?.token) {
            alert('Erro: Token do Gateway SMS não configurado.');
            return;
        }

        const phone = (order.customer_phone ?? '').replace(/\D/g, '');
        if (phone.length < 10) return;

        const firstName = (order.customer_name ?? 'Cliente').split(' ')[0];
        let message = '';

        if (type === 'prepared') {
            message = `Olá ${firstName}! Seu pedido #${order.id.slice(0, 5)} foi aceito e já está sendo preparado! 👨‍🍳`;
        } else if (type === 'ready') {
            message = `Olá ${firstName}! Seu pedido #${order.id.slice(0, 5)} está PRONTO! 🛵📦`;
        } else if (type === 'warning') {
            message = `⏳ ${firstName}, seu pedido #${order.id.slice(0, 5)} vai expirar em 3 min!`;
        } else if (type === 'cancelled') {
            message = `❌ ${firstName}, o prazo de reserva do pedido #${order.id.slice(0, 5)} expirou e ele foi cancelado.`;
        }

        const deviceId = '9bVs7d8LmmXlJYbmQjFIDKyMsoZ2_a10s';

        try {
            await fetch('https://optmasmsgate.vercel.app/api/v1/sms/send', {
                method: 'POST',
                headers: {
                    'x-api-key': storeData.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    deviceId: deviceId,
                    phoneNumber: `+55${phone}`,
                    message: message
                })
            });
            // Silent success or toast
        } catch (error) {
            console.error('Generic SMS Error', error);
        }
    }

    // Update Status
    async function updateStatus(orderId: string, newStatus: OrderStatus) {
        try {
            if (newStatus === 'confirmed') {
                const { data, error } = await supabase.rpc('confirm_order_payment', { p_order_id: orderId });
                if (error) throw error;
                if (data?.ok === false) throw new Error(data?.error || 'Erro ao confirmar pedido.');
            } else if (newStatus === 'cancelled') {
                const { data, error } = await supabase.rpc('admin_cancel_public_order_safe', {
                    p_order_id: orderId,
                    p_reason: 'Cancelado pelo painel administrativo',
                });
                if (error) throw error;
                if (data?.ok === false) throw new Error(data?.error || 'Erro ao cancelar pedido.');
            } else if (newStatus === 'completed') {
                const { data, error } = await supabase.rpc('admin_complete_public_order_safe', {
                    p_order_id: orderId,
                });
                if (error) throw error;
                if (data?.ok === false) throw new Error(data?.error || 'Erro ao finalizar pedido.');
            } else {
                throw new Error(`Status não suportado: ${newStatus}`);
            }
            // Optimistic update
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Erro ao atualizar status');
        }
    }

    // Format Helpers
    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return new Intl.DateTimeFormat('pt-BR', {
            hour: '2-digit', minute: '2-digit',
            day: '2-digit', month: '2-digit'
        }).format(date);
    };

    const getTimerColor = (minutes: number) => {
        if (minutes < 3) return 'text-red-600 animate-pulse';
        if (minutes < 5) return 'text-orange-600';
        return 'text-green-600';
    };

    const statusColors: Record<string, string> = {
        reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
        completed: 'bg-green-100 text-green-800 border-green-200',
        cancelled: 'bg-red-100 text-red-800 border-red-200',
    };

    const statusLabels: Record<string, string> = {
        reserved: 'Novo / Pendente',
        confirmed: 'Em Preparo',
        completed: 'Entregue / Pronto',
        cancelled: 'Cancelado',
    };

    return (
        <PageContainer
            title="Pedidos"
            subtitle="Gerencie os pedidos chegando em tempo real."
            category="Comercial"
            icon={<ShoppingBag className="text-[#21A896]" size={28} />}
            onRefresh={fetchOrders}
            flat
        >
            <OrderStatusFilter value={filterStatus} onChange={setFilterStatus} />
            {/* Kanban / List */}
            {displayedOrders.length === 0 && !loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-center px-6">
                    <ShoppingBag size={64} className="opacity-20 mb-4" />
                    <h2 className="text-xl font-bold">Nenhum pedido encontrado</h2>
                    <p className="text-sm max-w-md">{emptyStateMessage}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {displayedOrders.map(order => {
                        // Calculate timer for this order if reserved
                        let timerDisplay = null;
                        let isExpiring = false;

                        if (order.status === 'reserved' && order.stock_reservations?.[0]) {
                            const expiresAt = new Date(order.stock_reservations[0].expires_at).getTime();
                            const diff = expiresAt - now.getTime();
                            if (diff > 0) {
                                const min = Math.floor(diff / 60000);
                                const sec = Math.floor((diff % 60000) / 1000);
                                timerDisplay = `${min}m ${sec}s`;
                                if (min < 3) isExpiring = true;
                            } else {
                                timerDisplay = 'Expirado';
                                isExpiring = true;
                            }
                        }

                        return (
                            <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-2xl border-l-4 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${
                                order.status === 'reserved' ? 'border-l-yellow-400' :
                                order.status === 'confirmed' ? 'border-l-blue-400' :
                                order.status === 'completed' ? 'border-l-green-400' : 'border-l-red-400'
                            }`}>
                                {/* Card Header */}
                                <div
                                    className="p-5 flex flex-wrap md:flex-nowrap items-center justify-between gap-4 cursor-pointer"
                                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                >
                                    {/* Left: Info */}
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={`p-3 rounded-full ${statusColors[order.status]} bg-opacity-20`}>
                                            {order.status === 'reserved' ? <AlertCircle size={24} /> :
                                             order.status === 'confirmed' ? <Clock size={24} /> :
                                             order.status === 'completed' ? <CheckCircle size={24} /> : <XCircle size={24} />}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-lg text-gray-800 dark:text-white">#{order.id.slice(0, 8).toUpperCase()}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${statusColors[order.status]}`}>
                                                    {statusLabels[order.status]}
                                                </span>
                                                {/* Timer Badge */}
                                                {order.status === 'reserved' && timerDisplay && (
                                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border border-current ${getTimerColor(isExpiring ? 0 : 5)}`}>
                                                        <Clock size={12} /> {timerDisplay}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                                                <span>{order.customer_name}</span>
                                                <span>•</span>
                                                <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(order.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Total & Actions */}
                                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                        <div className="text-right">
                                            <span className="block text-2xl font-black text-brand-green dark:text-brand-mint">
                                                {formatCurrency(order.total)}
                                            </span>
                                            <span className="text-xs text-gray-400 font-bold uppercase">{order.payment_method === 'pix' ? 'Pix' : 'Retirada'}</span>
                                        </div>

                                        <div className="hidden md:block">
                                            {expandedOrder === order.id ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                                        </div>
                                    </div>
                                </div>

                                {/* Collapsible Details */}
                                {expandedOrder === order.id && (
                                    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-5 animate-fade-in-down">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                            {/* Contact Info */}
                                            <div className="space-y-4">
                                                <h4 className="font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-widest">Detalhes do Cliente</h4>
                                                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                                                    <p className="flex justify-between"><span className="text-gray-500">Nome:</span> <span className="font-medium text-gray-900 dark:text-white">{order.customer_name || 'Não informado'}</span></p>
                                                    <p className="flex justify-between"><span className="text-gray-500">Telefone:</span> <span className="font-medium text-gray-900 dark:text-white">{order.customer_phone || 'Não informado'}</span></p>
                                                    <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
                                                        <a
                                                            href={`https://wa.me/55${(order.customer_phone ?? '').replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-center gap-2 w-full p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-bold"
                                                        >
                                                            <MessageCircle size={16} /> Contatar no WhatsApp
                                                        </a>
                                                        {storeData?.token && (
                                                            <button
                                                                onClick={() => sendSmsNotification(order, 'prepared')}
                                                                className="flex items-center justify-center gap-2 w-full p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-sm font-bold mt-2"
                                                            >
                                                                <MessageCircle size={16} /> Enviar Aviso "Preparando"
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Order Items */}
                                            <div className="space-y-4">
                                                <h4 className="font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-widest">Itens do Pedido</h4>
                                                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                    {order.order_items?.map(item => (
                                                        <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                            <div className="flex items-center gap-3">
                                                                <span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-xs font-bold text-gray-600 dark:text-gray-300">
                                                                    {item.quantity}x
                                                                </span>
                                                                <span className="text-gray-800 dark:text-gray-200 font-medium">
                                                                    {item.product?.name || 'Produto Removido'}
                                                                </span>
                                                            </div>
                                                            <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">
                                                                {formatCurrency(item.unit_price * item.quantity)}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="mt-6 flex flex-wrap gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                                                {/* Actions based on status */}
                                                {order.status === 'reserved' && (
                                                    <>
                                                        {/* Extend Reservation */}
                                                        <button
                                                            onClick={() => extendReservation(order.id)}
                                                            className="px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold text-sm transition flex items-center gap-2"
                                                            title={`Adicionar +${storeData?.config?.extension_minutes || 10} minutos ao prazo`}
                                                        >
                                                            Prorrogar (+{storeData?.config?.extension_minutes || 10}min)
                                                        </button>

                                                        <button
                                                            onClick={() => updateStatus(order.id, 'cancelled')}
                                                            className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-bold text-sm transition"
                                                        >
                                                            Recusar / Cancelar
                                                        </button>

                                                        <button
                                                            onClick={() => {
                                                                const confirmSend = window.confirm('Deseja enviar aviso automático para o cliente?');
                                                                updateStatus(order.id, 'confirmed');
                                                                if (confirmSend) sendSmsNotification(order, 'prepared');
                                                            }}
                                                            className="px-6 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-lg font-bold text-sm transition shadow-lg shadow-teal-200 flex items-center gap-2"
                                                        >
                                                            <Clock size={16} /> Aceitar e Preparar
                                                        </button>
                                                    </>
                                                )}

                                                {order.status === 'confirmed' && (
                                                    <>
                                                        <button
                                                            onClick={() => updateStatus(order.id, 'cancelled')}
                                                            className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-bold text-sm transition"
                                                        >
                                                            Cancelar
                                                        </button>

                                                        <button
                                                            onClick={() => updateStatus(order.id, 'completed')}
                                                            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition shadow-lg shadow-green-200 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Prontificar / Finalizar
                                                        </button>
                                                    </>
                                                )}

                                                {order.status === 'completed' && (
                                                    <span className="px-4 py-2 text-green-600 bg-green-50 rounded-lg font-bold text-sm flex items-center gap-2 cursor-default">
                                                        <CheckCircle size={16} /> Pedido Concluído
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </PageContainer>
    );
}
