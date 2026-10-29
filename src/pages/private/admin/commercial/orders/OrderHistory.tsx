import { useCallback, useEffect, useRef, useState } from 'react';
import { ShoppingBag, ChevronDown, ChevronUp, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { CustomerService } from '@/services/customerService';
import { useCustomerAuth } from '@/store/useCustomerAuth';
import type { Order } from '@/types';

const CUSTOMER_ORDERS_REFRESH_MS = 12000;

const statusColors: Record<string, string> = {
    reserved: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
    ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    out_for_delivery: 'bg-purple-100 text-purple-800 border-purple-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const statusLabels: Record<string, string> = {
    reserved: 'Pendente',
    confirmed: 'Em preparo',
    ready: 'Pronto',
    out_for_delivery: 'Saiu para entrega',
    completed: 'Entregue',
    cancelled: 'Cancelado',
};

const statusIcons: Record<string, typeof AlertCircle> = {
    reserved: AlertCircle,
    confirmed: Clock,
    ready: CheckCircle,
    out_for_delivery: Truck,
    completed: CheckCircle,
    cancelled: XCircle,
};

function getFriendlyStatusUpdate(order: Order) {
    const label = statusLabels[order.status] || order.status;
    const code = (order as Order & { order_code?: string | null }).order_code || `#${order.id.slice(0, 6).toUpperCase()}`;

    if (order.status === 'out_for_delivery') {
        return `${code}: saiu para entrega. Acompanhe por aqui as próximas atualizações.`;
    }

    if (order.status === 'ready') {
        return `${code}: seu pedido está pronto.`;
    }

    if (order.status === 'completed') {
        return `${code}: pedido concluído. Obrigado pela compra!`;
    }

    if (order.status === 'cancelled') {
        return `${code}: o pedido foi cancelado.`;
    }

    return `${code}: status atualizado para ${label}.`;
}

export default function OrderHistory() {
    const { customer } = useCustomerAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const ordersRef = useRef<Order[]>([]);
    const requestInFlightRef = useRef(false);

    const fetchOrders = useCallback(async (options?: { silent?: boolean; notifyStatusChanges?: boolean }) => {
        if (!customer || requestInFlightRef.current) return;
        const silent = options?.silent ?? false;
        const notifyStatusChanges = options?.notifyStatusChanges ?? false;
        requestInFlightRef.current = true;

        if (silent) setRefreshing(true);
        else setLoading(true);

        try {
            const data = await CustomerService.getOrders(customer.id);

            if (notifyStatusChanges && ordersRef.current.length > 0) {
                const previousById = new Map(ordersRef.current.map((order) => [order.id, order.status]));
                data.forEach((order) => {
                    const previousStatus = previousById.get(order.id);
                    if (previousStatus && previousStatus !== order.status) {
                        toast.info(getFriendlyStatusUpdate(order));
                    }
                });
            }

            ordersRef.current = data;
            setOrders(data);
        } catch (error) {
            console.error('Error fetching orders:', error);
            if (!silent) toast.error('Não foi possível atualizar seus pedidos agora. Tente novamente em instantes.');
        } finally {
            requestInFlightRef.current = false;
            setLoading(false);
            setRefreshing(false);
        }
    }, [customer]);

    useEffect(() => {
        ordersRef.current = [];
        if (customer) void fetchOrders();
    }, [customer, fetchOrders]);

    useEffect(() => {
        if (!customer) return;

        const refreshIfVisible = () => {
            if (document.visibilityState === 'visible') {
                void fetchOrders({ silent: true, notifyStatusChanges: true });
            }
        };

        const intervalId = window.setInterval(refreshIfVisible, CUSTOMER_ORDERS_REFRESH_MS);
        document.addEventListener('visibilitychange', refreshIfVisible);
        window.addEventListener('focus', refreshIfVisible);

        return () => {
            window.clearInterval(intervalId);
            document.removeEventListener('visibilitychange', refreshIfVisible);
            window.removeEventListener('focus', refreshIfVisible);
        };
    }, [customer, fetchOrders]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <RefreshCw className="animate-spin mb-2" size={24} />
                <p>Carregando histórico...</p>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-12 px-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="bg-white p-4 rounded-full inline-flex mb-3 shadow-sm">
                    <ShoppingBag size={32} className="text-gray-300" />
                </div>
                <h3 className="font-bold text-gray-800 mb-1">Nenhum pedido encontrado</h3>
                <p className="text-gray-500 text-sm">Seus pedidos recentes aparecerão aqui.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                <span>Os status são atualizados automaticamente enquanto esta área estiver aberta.</span>
                <button
                    type="button"
                    onClick={() => void fetchOrders({ silent: true, notifyStatusChanges: true })}
                    className="inline-flex shrink-0 items-center gap-1 font-bold text-brand-green hover:underline disabled:opacity-50"
                    disabled={refreshing}
                >
                    <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
                    Atualizar
                </button>
            </div>

            {orders.map(order => {
                const StatusIcon = statusIcons[order.status] || AlertCircle;
                const isExpanded = expandedOrder === order.id;

                return (
                    <div key={order.id} className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm hover:shadow transition-shadow">
                        <div
                            className="p-4 flex items-center justify-between cursor-pointer active:bg-gray-50 transition-colors"
                            onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${statusColors[order.status] || statusColors.reserved} bg-opacity-20`}>
                                    <StatusIcon size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-gray-800 text-sm">#{order.id.slice(0, 6)}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${statusColors[order.status] || statusColors.reserved}`}>
                                            {statusLabels[order.status] || order.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500">{formatDate(order.created_at)}</p>
                                </div>
                            </div>

                            <div className="text-right">
                                <p className="font-bold text-brand-green">{formatCurrency(order.total)}</p>
                                <div className="flex items-center justify-end gap-1 text-gray-400 mt-1">
                                    <span className="text-[10px] uppercase font-bold">{order.order_items?.length || 0} itens</span>
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </div>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="border-t border-gray-100 bg-gray-50 p-4 animate-fadeIn">
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Itens do Pedido</h4>
                                <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
                                    {order.order_items?.map(item => (
                                        <div key={item.id} className="p-3 flex justify-between items-center text-sm">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-brand-green">{item.quantity}x</span>
                                                <span className="text-gray-700">{item.product?.name || 'Produto indisponível'}</span>
                                            </div>
                                            <span className="text-gray-500">{formatCurrency(item.unit_price * item.quantity)}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                                    <span>Pagamento via {order.payment_method === 'pix' ? 'Pix' : 'Dinheiro/Cartão'}</span>
                                    <button className="text-brand-green font-bold hover:underline">
                                        Ajuda com este pedido
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
