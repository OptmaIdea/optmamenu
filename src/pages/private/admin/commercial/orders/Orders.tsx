import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ShoppingBag, Clock, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, MessageCircle, RefreshCw, Truck } from 'lucide-react';
import type { Order, OrderStatus, StoreConfig } from '@/types';
import PageContainer from '@/components/common/PageContainer';
import OrderStatusFilter from '@/components/common/OrderStatusFilter';
import DateRangeFilter, { getPeriodDates } from '@/components/common/DateRangeFilter';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { useRealtimeListener } from '@/hooks/useRealtimeListener';
import { OrderCommunicationService, type OrderMessageEventCode } from '@/services/orderCommunicationService';
import OrderPaymentModal, { type FinalPaymentMethodCode } from '@/components/orders/OrderPaymentModal';
import OrderPaymentProofPanel from './OrderPaymentProofPanel';

function getAutomaticExpirationAt(order: Order): string | null {
    const metadata = (order as Order & { commercial_metadata?: Record<string, unknown> }).commercial_metadata;
    if (metadata?.cancelled_reason !== 'reservation_expired') return null;
    const cancelledAt = metadata.cancelled_at;
    return typeof cancelledAt === 'string' && cancelledAt ? cancelledAt : null;
}

export default function Orders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('current');
    const [periodFilter, setPeriodFilter] = useState<string>('all');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const initialDates = getPeriodDates('all');
    const [startDate, setStartDate] = useState<string>(initialDates.start);
    const [endDate, setEndDate] = useState<string>(initialDates.end);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [storeData, setStoreData] = useState<{ id: string, name: string, token: string, config?: StoreConfig } | null>(null);
    const [now, setNow] = useState(new Date());
    const [finalizingOrder, setFinalizingOrder] = useState<Order | null>(null);
    const [finalizationLoading, setFinalizationLoading] = useState(false);

    const displayedOrders = useMemo(() => {
        return orders.filter(o => {
            if (filterStatus === 'current') {
                if (!(o.status === 'reserved' || o.status === 'confirmed' || o.status === 'ready' || o.status === 'out_for_delivery')) return false;
            }
            if (startDate || endDate) {
                const orderDate = o.created_at ? o.created_at.slice(0, 10) : '';
                if (startDate && orderDate < startDate) return false;
                if (endDate && orderDate > endDate) return false;
            }
            return true;
        });
    }, [orders, filterStatus, startDate, endDate]);

    const emptyStateMessage = filterStatus === 'current'
        ? 'Nenhum pedido aguardando atendimento agora. Vendas de balcão concluídas ficam no dashboard, vida do cliente e histórico comercial.'
        : filterStatus === 'expired_auto'
            ? 'Nenhum pedido foi cancelado automaticamente por expiração.'
            : 'Nenhum pedido encontrado para o filtro selecionado.';

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: storeRpcData, error: storeRpcError } = await supabase.rpc('get_user_store_by_id', { p_user_id: user.id });
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
            if (error) throw error;
            if (!result?.ok) throw new Error(result?.error || 'Erro ao buscar pedidos.');
            setOrders(result.orders || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchOrders(); }, [fetchOrders]);
    useRefreshFrame(fetchOrders);

    const handleOrdersChange = useCallback(() => {
        fetchOrders();
        const audio = new Audio('/notification.wav');
        audio.play().catch(() => { });
    }, [fetchOrders]);

    useRealtimeListener({
        channelName: `orders_rt_${storeData?.id || 'pending'}`,
        tables: [{ table: 'orders', ...(storeData?.id ? { filter: `store_id=eq.${storeData.id}` } : {}) }],
        onChanged: handleOrdersChange,
        enabled: !!storeData?.id,
    });

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const monitor = setInterval(checkExpirations, 30000);
        return () => clearInterval(monitor);
    }, [orders]);

    async function checkExpirations() {
        if (!storeData) return;
        const expiredOrders = orders.filter((order) => {
            const publicOrder = getPublicOrderFields(order);
            if (!['reserved', 'confirmed', 'ready'].includes(order.status) || !order.stock_reservations?.[0]) return false;
            if (publicOrder.payment_status === 'paid' || publicOrder.fulfillment_type === 'delivery') return false;
            const cancellationAt = publicOrder.cancellation_grace_until || order.stock_reservations[0].expires_at;
            return new Date(cancellationAt).getTime() <= Date.now();
        });
        const warningOrders = orders.filter((order) => {
            if (!['reserved', 'confirmed', 'ready'].includes(order.status) || !order.stock_reservations?.[0]) return false;
            if (getPublicOrderFields(order).payment_status === 'paid' || getPublicOrderFields(order).fulfillment_type === 'delivery') return false;
            const remaining = new Date(order.stock_reservations[0].expires_at).getTime() - Date.now();
            return remaining > 120000 && remaining <= 180000;
        });
        void warningOrders;
        if (expiredOrders.length === 0) return;
        const { error } = await supabase.rpc('cancel_expired_reservations', { p_store_id: storeData.id });
        if (error) {
            console.error('Erro ao cancelar reservas expiradas:', error);
            return;
        }
        fetchOrders();
    }

    function isReservationTimerApplicable(order: Order) {
        const publicOrder = getPublicOrderFields(order);
        return ['reserved', 'confirmed', 'ready'].includes(order.status)
            && publicOrder.payment_status !== 'paid'
            && publicOrder.fulfillment_type !== 'delivery';
    }

    async function extendReservation(order: Order) {
        if (!isReservationTimerApplicable(order)) {
            alert('Pedido pago ou de delivery não tem prazo de reserva para prorrogar.');
            return;
        }

        const extensionMinutes = storeData?.config?.extension_minutes || 10;
        if (!confirm(`Deseja prorrogar a reserva em ${extensionMinutes} minutos?`)) return;
        try {
            const { error } = await supabase.rpc('extend_reservation', { p_order_id: order.id, p_minutes: extensionMinutes });
            if (error) throw error;
            alert('Reserva prorrogada com sucesso!');
            fetchOrders();
        } catch (error) {
            console.error('Extension error:', error);
            alert('Erro ao prorrogar: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
        }
    }

    function getPublicOrderFields(order: Order) {
        return order as Order & {
            order_code?: string;
            public_order_token?: string;
            fulfillment_type?: string;
            payment_method_code?: string | null;
            promised_payment_method_code?: string | null;
            payment_status?: 'pending' | 'paid' | 'failed' | 'refund_pending' | 'partially_refunded' | 'refunded';
            available_until?: string | null;
            cancellation_grace_until?: string | null;
        };
    }

    function getPaymentMethodLabel(order: Order) {
        const publicOrder = getPublicOrderFields(order);
        const methodCode = String(publicOrder.payment_method_code || order.payment_method || '').trim();
        const promisedCode = String(publicOrder.promised_payment_method_code || '').trim();

        if (publicOrder.payment_status === 'paid' && methodCode.includes('pix')) return 'PIX pago';
        if (methodCode === 'pix_manual_qr') return 'PIX com comprovante';
        if (methodCode === 'pix') return 'PIX';
        if (methodCode === 'cash') return publicOrder.fulfillment_type === 'delivery' ? 'Dinheiro na entrega' : 'Dinheiro';
        if (methodCode === 'card') return publicOrder.fulfillment_type === 'delivery' ? 'Cartão na entrega' : 'Cartão';
        if (methodCode === 'credit_card') return 'Cartão de crédito';
        if (methodCode === 'debit_card') return 'Cartão de débito';
        if (methodCode === 'payment_link') return 'Link de pagamento';
        if (promisedCode === 'cash') return publicOrder.fulfillment_type === 'delivery' ? 'Dinheiro na entrega' : 'Dinheiro na retirada';
        if (promisedCode === 'card') return publicOrder.fulfillment_type === 'delivery' ? 'Cartão na entrega' : 'Cartão na retirada';
        if (promisedCode === 'pix') return publicOrder.fulfillment_type === 'delivery' ? 'PIX na entrega' : 'PIX na retirada';
        return publicOrder.fulfillment_type === 'delivery' ? 'Na entrega' : 'Na retirada';
    }

    function getOrderActionErrorMessage(error: unknown) {
        const message = error instanceof Error ? error.message : String(error || '');
        const labels: Record<string, string> = {
            insufficient_reserved_stock: 'A reserva deste pedido ficou inconsistente. Atualize a tela e tente novamente; se o pedido já estiver pago, a finalização corrigida não deve mais exigir o contador reservado.',
            insufficient_stock: 'Não há estoque físico suficiente para concluir este pedido.',
            no_active_reservations: 'Este pedido não possui reserva ativa para baixa de estoque.',
            order_not_confirmed: 'Este pedido ainda não está em uma etapa que permita finalização.',
            access_denied: 'Você não tem permissão para alterar este pedido.',
        };
        return labels[message] || message || 'Erro ao atualizar status';
    }

    async function openOrderMessage(order: Order, eventCode: OrderMessageEventCode, expiresAtOverride?: string | null) {
        const publicOrder = getPublicOrderFields(order);
        const token = publicOrder.public_order_token;
        const orderCode = publicOrder.order_code || order.id;
        if (!token) { alert('Este pedido não possui link público de acompanhamento.'); return false; }
        const phone = String(order.customer_phone || '').replace(/\D/g, '');
        if (phone.length < 10) { alert('O cliente não possui um WhatsApp válido cadastrado neste pedido.'); return false; }
        const storeSlug = String((order as Order & { commercial_metadata?: Record<string, unknown> }).commercial_metadata?.slug || '');
        const opened = await OrderCommunicationService.open(eventCode, {
            orderId: order.id,
            orderCode,
            customerName: order.customer_name,
            customerPhone: phone,
            trackingUrl: `${window.location.origin}/p/${encodeURIComponent(token)}`,
            catalogUrl: storeSlug ? `${window.location.origin}/s/${encodeURIComponent(storeSlug)}` : window.location.origin,
            expiresAt: expiresAtOverride || publicOrder.available_until || order.stock_reservations?.[0]?.expires_at || null,
            fulfillmentType: publicOrder.fulfillment_type || null,
            paymentStatus: publicOrder.payment_status || null,
        });
        if (!opened) alert('Não foi possível abrir o WhatsApp para este cliente.');
        return opened;
    }

    async function acceptOrder(order: Order) {
        try {
            const { data, error } = await supabase.rpc('admin_accept_public_order_safe', { p_order_id: order.id });
            if (error) throw error;
            if (data?.ok === false) throw new Error(data?.error || 'Erro ao aceitar pedido.');
            const timerActive = Boolean(data?.timer_active);
            const updatedOrder = {
                ...order,
                status: 'confirmed' as OrderStatus,
                available_until: timerActive ? data.available_until : null,
                cancellation_grace_until: timerActive ? data.cancellation_grace_until : null,
                stock_reservations: timerActive && data.available_until ? [{ expires_at: data.available_until }] : [],
            } as Order;
            setOrders((current) => current.map((item) => item.id === order.id ? updatedOrder : item));
            if (window.confirm('Pedido aceito. Deseja abrir a mensagem para o cliente?')) await openOrderMessage(updatedOrder, 'order_accepted');
            return true;
        } catch (error) {
            console.error('Erro ao aceitar pedido:', error);
            alert('Erro ao aceitar pedido.');
            return false;
        }
    }

    async function markOrderReady(order: Order) {
        try {
            const { data, error } = await supabase.rpc('admin_mark_public_order_ready_safe', { p_order_id: order.id });
            if (error) throw error;
            if (data?.ok === false) throw new Error(data?.error || 'Erro ao marcar pedido como pronto.');
            const timerActive = Boolean(data?.timer_active);
            const expiresAt = timerActive ? (data?.expires_at || order.stock_reservations?.[0]?.expires_at || null) : null;
            const updatedOrder = { ...order, status: 'ready' as OrderStatus, available_until: expiresAt, cancellation_grace_until: timerActive ? data?.cancellation_grace_until || null : null, stock_reservations: expiresAt ? [{ expires_at: expiresAt }] : [] } as Order;
            setOrders((current) => current.map((item) => item.id === order.id ? updatedOrder : item));
            await openOrderMessage(updatedOrder, 'order_ready', expiresAt);
            await fetchOrders();
            return true;
        } catch (error) {
            console.error('Erro ao marcar pedido como pronto:', error);
            alert('Erro ao marcar pedido como pronto.');
            return false;
        }
    }

    async function finalizeOrder(method: FinalPaymentMethodCode) {
        if (!finalizingOrder) return;
        setFinalizationLoading(true);
        try {
            const { data, error } = await supabase.rpc('admin_finalize_public_order_with_payment', { p_order_id: finalizingOrder.id, p_payment_method_code: method });
            if (error) throw error;
            if (data?.ok === false) throw new Error(data?.error || 'Erro ao finalizar pedido.');
            setFinalizingOrder(null);
            await fetchOrders();
        } catch (error) {
            console.error('Erro ao finalizar pedido com pagamento:', error);
            alert('Não foi possível finalizar o pedido e registrar o pagamento.');
        } finally {
            setFinalizationLoading(false);
        }
    }

    async function updateStatus(orderId: string, newStatus: OrderStatus) {
        try {
            if (newStatus === 'cancelled') {
                const { data, error } = await supabase.rpc('admin_cancel_public_order_safe', { p_order_id: orderId, p_reason: 'Cancelado pelo painel administrativo' });
                if (error) throw error;
                if (data?.ok === false) throw new Error(data?.error || 'Erro ao cancelar pedido.');
            } else if (newStatus === 'out_for_delivery' as OrderStatus) {
                const { data, error } = await supabase.rpc('admin_dispatch_public_order_safe', { p_order_id: orderId });
                if (error) throw error;
                if (data?.ok === false) throw new Error(data?.error || 'Erro ao despachar pedido.');
            } else if (newStatus === 'completed') {
                const { data, error } = await supabase.rpc('admin_complete_public_order_safe', { p_order_id: orderId });
                if (error) throw error;
                if (data?.ok === false) throw new Error(data?.error || 'Erro ao finalizar pedido.');
            } else {
                throw new Error(`Status não suportado: ${newStatus}`);
            }
            setOrders((current) => current.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            alert(getOrderActionErrorMessage(error));
            return false;
        }
    }

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (dateStr: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(new Date(dateStr));
    const getTimerColor = (minutes: number) => minutes < 3 ? 'text-red-600 animate-pulse' : minutes < 5 ? 'text-orange-600' : 'text-green-600';
    const statusColors: Record<string, string> = {
        reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200', confirmed: 'bg-orange-100 text-orange-800 border-orange-200', ready: 'bg-emerald-100 text-emerald-800 border-emerald-200', out_for_delivery: 'bg-purple-100 text-purple-800 border-purple-200', completed: 'bg-green-100 text-green-800 border-green-200', cancelled: 'bg-red-100 text-red-800 border-red-200',
    };
    const statusLabels: Record<string, string> = {
        reserved: 'Novo / Pendente', confirmed: 'Em Preparo', ready: 'Pronto', out_for_delivery: 'Saiu para entrega', completed: 'Concluído', cancelled: 'Cancelado',
    };

    function getOrderStatusLabel(order: Order) {
        const publicOrder = getPublicOrderFields(order);
        const isPaidPickup = publicOrder.fulfillment_type === 'pickup' && publicOrder.payment_status === 'paid';

        if (isPaidPickup && ['confirmed', 'ready'].includes(order.status)) return 'Aguardando retirada';
        return statusLabels[order.status] || order.status;
    }

    async function cancelOrder(order: Order) {
        const publicOrder = getPublicOrderFields(order);
        const isPaid = publicOrder.payment_status === 'paid';
        const message = isPaid
            ? 'Este pedido já tem pagamento confirmado. Ao cancelar, registre o estorno do pagamento e avise o cliente sobre a recusa/cancelamento. Continuar?'
            : 'Cancelar este pedido?';

        if (!window.confirm(message)) return;

        const changed = await updateStatus(order.id, 'cancelled');
        if (changed) await openOrderMessage(order, 'order_cancelled');
    }

    async function handleFinalizeOrder(order: Order) {
        const publicOrder = getPublicOrderFields(order);
        if (publicOrder.payment_status === 'paid') {
            await updateStatus(order.id, publicOrder.fulfillment_type === 'delivery' ? ('out_for_delivery' as OrderStatus) : 'completed');
            return;
        }

        setFinalizingOrder(order);
    }

    return (
        <PageContainer title="Pedidos" subtitle="Gerencie os pedidos chegando em tempo real." category="Comercial" icon={<ShoppingBag className="text-[#19A999]" size={28} />} flat>
            <div className="flex min-h-0 flex-col lg:h-[calc(100vh-210px)] lg:overflow-hidden">
                <div className="mb-3 shrink-0 space-y-3 rounded-2xl border border-gray-100 bg-white p-3 font-candara shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:mb-4 sm:p-4 sm:space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <OrderStatusFilter value={filterStatus} onChange={setFilterStatus} />
                        <button type="button" onClick={() => setFiltersOpen((open) => !open)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700 sm:hidden" aria-expanded={filtersOpen}>
                            {filtersOpen ? 'Ocultar período' : 'Filtrar período'}
                            {filtersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button type="button" onClick={fetchOrders} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#19A999] hover:bg-[#14887B] text-white text-xs font-bold transition shadow-sm cursor-pointer shrink-0" title="Atualizar lista de pedidos">
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /><span>Atualizar</span>
                        </button>
                    </div>
                    <div className={`${filtersOpen ? 'block' : 'hidden'} border-t border-gray-100 pt-3 dark:border-gray-700 sm:block`}>
                        <DateRangeFilter periodFilter={periodFilter} onPeriodChange={setPeriodFilter} startDate={startDate} onStartDateChange={setStartDate} endDate={endDate} onEndDateChange={setEndDate} />
                    </div>
                </div>

                <div className="min-h-0 custom-scrollbar lg:flex-1 lg:overflow-y-auto lg:pr-1">
                    {displayedOrders.length === 0 && !loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-center px-6">
                            <ShoppingBag size={64} className="opacity-20 mb-4" /><h2 className="text-xl font-bold">Nenhum pedido encontrado</h2><p className="text-sm max-w-md">{emptyStateMessage}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {displayedOrders.map(order => {
                                const publicOrder = getPublicOrderFields(order);
                                const canUseTimer = isReservationTimerApplicable(order);
                                const automaticExpirationAt = getAutomaticExpirationAt(order);
                                let timerDisplay = null;
                                let isExpiring = false;
                                if (canUseTimer && order.stock_reservations?.[0]) {
                                    const expiresAt = new Date(order.stock_reservations[0].expires_at).getTime();
                                    const diff = expiresAt - now.getTime();
                                    if (diff > 0) {
                                        const min = Math.floor(diff / 60000);
                                        const sec = Math.floor((diff % 60000) / 1000);
                                        timerDisplay = `${min}m ${sec}s`;
                                        if (min < 3) isExpiring = true;
                                    } else { timerDisplay = 'Expirado'; isExpiring = true; }
                                }

                                return (
                                    <div key={order.id} className={`bg-white dark:bg-gray-800 rounded-2xl border-l-4 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden ${order.status === 'reserved' ? 'border-l-yellow-400' : order.status === 'confirmed' ? 'border-l-blue-400' : order.status === 'ready' ? 'border-l-emerald-400' : order.status === 'completed' ? 'border-l-green-400' : 'border-l-red-400'}`}>
                                        <div className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-3 sm:gap-4 sm:p-5 md:flex-nowrap" onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                                            <div className="flex items-center gap-4 flex-1">
                                                <div className={`p-3 rounded-full ${statusColors[order.status]} bg-opacity-20`}>
                                                    {order.status === 'reserved' ? <AlertCircle size={24} /> : order.status === 'confirmed' ? <Clock size={24} /> : order.status === 'ready' ? <CheckCircle size={24} /> : order.status === 'completed' ? <CheckCircle size={24} /> : <XCircle size={24} />}
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">{publicOrder.order_code || `#${order.id.slice(0, 8).toUpperCase()}`}</h3>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${statusColors[order.status]}`}>{getOrderStatusLabel(order)}</span>
                                                        {publicOrder.payment_status === 'paid' && <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase text-emerald-800">Pagamento confirmado</span>}
                                                        {automaticExpirationAt && <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800"><Clock size={11} /> Expirado automaticamente · {formatDate(automaticExpirationAt)}</span>}
                                                        {canUseTimer && timerDisplay && <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border border-current ${getTimerColor(isExpiring ? 0 : 5)}`}><Clock size={12} /> {timerDisplay}</span>}
                                                    </div>
                                                    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1"><span>{order.customer_name}</span><span>•</span><span className="flex items-center gap-1"><Clock size={12} /> {formatDate(order.created_at)}</span></div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                                                <div className="text-right"><span className="block text-2xl font-black text-brand-green dark:text-brand-mint">{formatCurrency(order.total)}</span><span className="text-xs text-gray-400 font-bold uppercase">{getPaymentMethodLabel(order)}</span></div>
                                                <div className="hidden md:block">{expandedOrder === order.id ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}</div>
                                            </div>
                                        </div>

                                        {expandedOrder === order.id && (
                                            <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-5 animate-fade-in-down">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-4">
                                                        <h4 className="font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-widest">Detalhes do Cliente</h4>
                                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                                                            <p className="flex justify-between"><span className="text-gray-500">Nome:</span> <span className="font-medium text-gray-900 dark:text-white">{order.customer_name || 'Não informado'}</span></p>
                                                            <p className="flex justify-between"><span className="text-gray-500">Telefone:</span> <span className="font-medium text-gray-900 dark:text-white">{order.customer_phone || 'Não informado'}</span></p>
                                                            <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-700">
                                                                <a href={`https://wa.me/55${(order.customer_phone ?? '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition text-sm font-bold"><MessageCircle size={16} /> Contatar no WhatsApp</a>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <h4 className="font-bold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-widest">Itens do Pedido</h4>
                                                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                                            {order.order_items?.map(item => (
                                                                <div key={item.id} className="flex justify-between items-center p-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                                                                    <div className="flex items-center gap-3"><span className="w-6 h-6 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded text-xs font-bold text-gray-600 dark:text-gray-300">{item.quantity}x</span><span className="text-gray-800 dark:text-gray-200 font-medium">{item.product?.name || 'Produto Removido'}</span></div>
                                                                    <span className="text-gray-600 dark:text-gray-400 font-mono text-sm">{formatCurrency(item.unit_price * item.quantity)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {storeData && (
                                                        <OrderPaymentProofPanel
                                                            storeId={storeData.id}
                                                            orderId={order.id}
                                                            orderStatus={order.status}
                                                            paymentStatus={publicOrder.payment_status}
                                                            paymentMethodCode={publicOrder.payment_method_code || (order.payment_method === 'pix' ? 'pix' : null)}
                                                            onChanged={fetchOrders}
                                                            onPaymentConfirmed={async () => {
                                                                const paidOrder = {
                                                                    ...order,
                                                                    status: order.status === 'reserved' ? 'confirmed' as OrderStatus : order.status,
                                                                    payment_status: 'paid',
                                                                    available_until: null,
                                                                    cancellation_grace_until: null,
                                                                    stock_reservations: [],
                                                                } as Order;
                                                                setOrders((current) => current.map((item) => item.id === order.id ? paidOrder : item));
                                                                await openOrderMessage(paidOrder, 'order_accepted', null);
                                                                await fetchOrders();
                                                            }}
                                                        />
                                                    )}

                                                    <div className="md:col-span-2 mt-2 flex flex-col gap-2 border-t border-gray-200 pt-4 dark:border-gray-700 sm:flex-row sm:flex-wrap sm:justify-end">
                                                        {order.status === 'reserved' && <>
                                                            {canUseTimer && <button onClick={() => extendReservation(order)} className="w-full rounded-lg bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100 sm:w-auto" title={`Adicionar +${storeData?.config?.extension_minutes || 10} minutos ao prazo`}>Prorrogar (+{storeData?.config?.extension_minutes || 10}min)</button>}
                                                            <button onClick={() => void cancelOrder(order)} className="w-full rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 sm:w-auto">{publicOrder.payment_status === 'paid' ? 'Cancelar com estorno' : 'Recusar / Cancelar'}</button>
                                                            <button onClick={async () => { await acceptOrder(order); }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-teal-200 transition hover:bg-teal-700 sm:w-auto"><Clock size={16} /> Aceitar pedido</button>
                                                        </>}
                                                        {order.status === 'confirmed' && <>
                                                            {canUseTimer && <button onClick={() => extendReservation(order)} className="w-full rounded-lg bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-600 transition hover:bg-indigo-100 sm:w-auto">Prorrogar (+{storeData?.config?.extension_minutes || 10}min)</button>}
                                                            <button onClick={() => void cancelOrder(order)} className="w-full rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 sm:w-auto">{publicOrder.payment_status === 'paid' ? 'Cancelar com estorno' : 'Cancelar'}</button>
                                                            <button type="button" onClick={() => markOrderReady(order)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100 sm:w-auto"><MessageCircle size={16} /> {publicOrder.fulfillment_type === 'pickup' ? 'Avisar retirada' : 'Avisar que está pronto'}</button>
                                                            <button onClick={() => void handleFinalizeOrder(order)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-green-200 transition hover:bg-green-700 sm:w-auto"><CheckCircle size={16} /> {publicOrder.payment_status === 'paid' ? (publicOrder.fulfillment_type === 'delivery' ? 'Saiu para entrega' : 'Finalizar retirada') : 'Finalizar pedido'}</button>
                                                        </>}
                                                        {order.status === 'ready' && <>
                                                            <button onClick={() => void cancelOrder(order)} className="w-full rounded-lg bg-red-50 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 sm:w-auto">{publicOrder.payment_status === 'paid' ? 'Cancelar com estorno' : 'Cancelar'}</button>
                                                            {publicOrder.fulfillment_type === 'delivery' ? <button onClick={() => updateStatus(order.id, 'out_for_delivery' as OrderStatus)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-purple-200 transition hover:bg-purple-700 sm:w-auto"><Truck size={16} /> Saiu para entrega</button> : <button onClick={() => publicOrder.payment_status === 'paid' ? updateStatus(order.id, 'completed') : setFinalizingOrder(order)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2 text-sm font-bold text-white shadow-lg shadow-green-200 transition hover:bg-green-700 sm:w-auto"><CheckCircle size={16} /> Finalizar retirada</button>}
                                                        </>}
                                                        {order.status === 'out_for_delivery' && <button onClick={() => updateStatus(order.id, 'completed')} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#21A896] px-6 py-2 text-sm font-bold text-white transition hover:bg-[#1A867A] sm:w-auto"><CheckCircle size={16} /> Confirmar entrega</button>}
                                                        {order.status === 'completed' && <span className="px-4 py-2 text-green-600 bg-green-50 rounded-lg font-bold text-sm flex items-center gap-2 cursor-default"><CheckCircle size={16} /> Pedido Concluído</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            <OrderPaymentModal order={finalizingOrder} loading={finalizationLoading} onClose={() => !finalizationLoading && setFinalizingOrder(null)} onConfirm={finalizeOrder} />
        </PageContainer>
    );
}
