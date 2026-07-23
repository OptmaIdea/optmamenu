#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const ordersPath = path.join(root, 'src/pages/private/admin/commercial/orders/Orders.tsx');
const catalogPath = path.join(root, 'src/pages/store/Catalog.tsx');

function fail(message) {
  console.error(`\n[order-ready-flow] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

let orders = read(ordersPath);
let catalog = read(catalogPath);

orders = orders.replace(
  "return orders.filter(o => o.status === 'reserved' || o.status === 'confirmed');",
  "return orders.filter(o => o.status === 'reserved' || o.status === 'confirmed' || o.status === 'ready');",
);

orders = orders.replace(
  `            fulfillment_type?: string;\n        };`,
  `            fulfillment_type?: string;\n            payment_status?: 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded';\n            available_until?: string | null;\n            cancellation_grace_until?: string | null;\n        };`,
);

orders = orders.replace(
  `            expiresAt: order.stock_reservations?.[0]?.expires_at || null,`,
  `            expiresAt: publicOrder.available_until || order.stock_reservations?.[0]?.expires_at || null,`,
);

const oldUpdateStatus = `    // Update Status
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
                throw new Error(\`Status não suportado: \${newStatus}\`);
            }
            // Optimistic update
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Erro ao atualizar status');
            return false;
        }
    }`;

const newUpdateStatus = `    async function acceptOrder(order: Order) {
        try {
            const { data, error } = await supabase.rpc('admin_accept_public_order_safe', {
                p_order_id: order.id,
            });
            if (error) throw error;
            if (data?.ok === false) throw new Error(data?.error || 'Erro ao aceitar pedido.');

            const updatedOrder = {
                ...order,
                status: 'confirmed' as OrderStatus,
                available_until: data.available_until,
                cancellation_grace_until: data.cancellation_grace_until,
                stock_reservations: [{ expires_at: data.available_until }],
            } as Order;

            setOrders((current) => current.map((item) => item.id === order.id ? updatedOrder : item));

            if (window.confirm('Pedido aceito. Deseja abrir a mensagem para o cliente?')) {
                await openOrderMessage(updatedOrder, 'order_accepted');
            }
            return true;
        } catch (error) {
            console.error('Erro ao aceitar pedido:', error);
            alert('Erro ao aceitar pedido.');
            return false;
        }
    }

    async function markOrderReady(order: Order) {
        try {
            const { data, error } = await supabase.rpc('admin_mark_public_order_ready_safe', {
                p_order_id: order.id,
            });
            if (error) throw error;
            if (data?.ok === false) throw new Error(data?.error || 'Erro ao marcar pedido como pronto.');

            const updatedOrder = { ...order, status: 'ready' as OrderStatus };
            setOrders((current) => current.map((item) => item.id === order.id ? updatedOrder : item));
            await openOrderMessage(updatedOrder, 'order_ready');
            return true;
        } catch (error) {
            console.error('Erro ao marcar pedido como pronto:', error);
            alert('Erro ao marcar pedido como pronto.');
            return false;
        }
    }

    // Update Status
    async function updateStatus(orderId: string, newStatus: OrderStatus) {
        try {
            if (newStatus === 'cancelled') {
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
                throw new Error(\`Status não suportado: \${newStatus}\`);
            }
            setOrders((current) => current.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Erro ao atualizar status');
            return false;
        }
    }`;

if (!orders.includes('async function acceptOrder')) {
  if (!orders.includes(oldUpdateStatus)) fail('Bloco atual de atualização de status não encontrado.');
  orders = orders.replace(oldUpdateStatus, newUpdateStatus);
}

orders = orders.replace(
  `        const expiredOrders = orders.filter((order) => {
            if (order.status !== 'reserved' || !order.stock_reservations?.[0]) return false;
            return new Date(order.stock_reservations[0].expires_at).getTime() <= Date.now();
        });`,
  `        const expiredOrders = orders.filter((order) => {
            const publicOrder = getPublicOrderFields(order);
            if (!['reserved', 'confirmed', 'ready'].includes(order.status) || !order.stock_reservations?.[0]) return false;
            if (publicOrder.payment_status === 'paid') return false;
            const cancellationAt = publicOrder.cancellation_grace_until || order.stock_reservations[0].expires_at;
            return new Date(cancellationAt).getTime() <= Date.now();
        });`,
);

orders = orders.replace(
  `        const warningOrders = orders.filter((order) => {
            if (order.status !== 'reserved' || !order.stock_reservations?.[0]) return false;`,
  `        const warningOrders = orders.filter((order) => {
            if (!['reserved', 'confirmed', 'ready'].includes(order.status) || !order.stock_reservations?.[0]) return false;`,
);

orders = orders.replace(
  `        confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
        completed: 'bg-green-100 text-green-800 border-green-200',`,
  `        confirmed: 'bg-blue-100 text-blue-800 border-blue-200',
        ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        completed: 'bg-green-100 text-green-800 border-green-200',`,
);

orders = orders.replace(
  `        confirmed: 'Em Preparo',
        completed: 'Entregue / Pronto',`,
  `        confirmed: 'Em Preparo',
        ready: 'Pronto para retirada',
        completed: 'Concluído',`,
);

orders = orders.replace(
  `order.status === 'confirmed' ? 'border-l-blue-400' :
                                order.status === 'completed' ? 'border-l-green-400' :`,
  `order.status === 'confirmed' ? 'border-l-blue-400' :
                                order.status === 'ready' ? 'border-l-emerald-400' :
                                order.status === 'completed' ? 'border-l-green-400' :`,
);

orders = orders.replace(
  `order.status === 'confirmed' ? <Clock size={24} /> :
                                             order.status === 'completed' ? <CheckCircle size={24} /> :`,
  `order.status === 'confirmed' ? <Clock size={24} /> :
                                             order.status === 'ready' ? <CheckCircle size={24} /> :
                                             order.status === 'completed' ? <CheckCircle size={24} /> :`,
);

orders = orders.replace(
  `{order.status === 'reserved' && timerDisplay && (`,
  `{['reserved', 'confirmed', 'ready'].includes(order.status) && timerDisplay && (`,
);

orders = orders.replace(
  `if (order.status === 'reserved' && order.stock_reservations?.[0]) {`,
  `if (['reserved', 'confirmed', 'ready'].includes(order.status) && order.stock_reservations?.[0]) {`,
);

orders = orders.replace(
  `const changed = await updateStatus(order.id, 'confirmed');
                                                                if (changed && window.confirm('Pedido aceito. Deseja abrir a mensagem para o cliente?')) {
                                                                    await openOrderMessage(order, 'order_accepted');
                                                                }`,
  `await acceptOrder(order)`,
);

orders = orders.replace(
  `onClick={() => openOrderMessage(order, 'order_ready')}`,
  `onClick={() => markOrderReady(order)}`,
);

orders = orders.replace(
  `{order.status === 'completed' && (`,
  `{order.status === 'ready' && (
                                                    <>
                                                        <button
                                                            onClick={async () => {
                                                                const changed = await updateStatus(order.id, 'cancelled');
                                                                if (changed && window.confirm('Deseja avisar o cliente pelo WhatsApp?')) {
                                                                    await openOrderMessage(order, 'order_cancelled');
                                                                }
                                                            }}
                                                            className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg font-bold text-sm transition"
                                                        >
                                                            Cancelar
                                                        </button>
                                                        <button
                                                            onClick={() => updateStatus(order.id, 'completed')}
                                                            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition shadow-lg shadow-green-200 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Finalizar pedido
                                                        </button>
                                                    </>
                                                )}

                                                {order.status === 'completed' && (`,
);

const autoDismiss = `    useEffect(() => {
        if (!orderSuccess) return;
        const timer = window.setTimeout(() => setOrderSuccess(null), 5000);
        return () => window.clearTimeout(timer);
    }, [orderSuccess]);
`;
if (catalog.includes(autoDismiss)) {
  catalog = catalog.replace(autoDismiss, '');
}

if (!orders.includes("admin_mark_public_order_ready_safe")) fail('RPC de pedido pronto não foi conectada.');
if (!orders.includes("admin_accept_public_order_safe")) fail('RPC de aceite não foi conectada.');

fs.writeFileSync(ordersPath, orders, 'utf8');
fs.writeFileSync(catalogPath, catalog, 'utf8');
console.log('[order-ready-flow] Estado pronto, prazo de aceite e sucesso persistente aplicados.');