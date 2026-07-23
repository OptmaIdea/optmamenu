#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const layoutPath = path.join(root, 'src/components/layouts/PrivateLayout.tsx');
const ordersPath = path.join(root, 'src/pages/private/admin/commercial/orders/Orders.tsx');
const checkoutPath = path.join(root, 'src/pages/store/Checkout.tsx');

function fail(message) {
  console.error(`\n[pending-orders-payment] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

let layout = read(layoutPath);
let orders = read(ordersPath);
let checkout = read(checkoutPath);

// 1. Alerta flutuante global no layout privado.
if (!layout.includes("PendingOrdersFloatingAlert")) {
  const importMarker = "import BackToTopButton from '@/components/common/navigation/BackToTopButton';";
  if (!layout.includes(importMarker)) fail('Import de BackToTopButton não encontrado no PrivateLayout.');
  layout = layout.replace(
    importMarker,
    `${importMarker}\nimport PendingOrdersFloatingAlert from '@/components/orders/PendingOrdersFloatingAlert';`,
  );
}

if (!layout.includes('<PendingOrdersFloatingAlert')) {
  const marker = '            <BackToTopButton />';
  if (!layout.includes(marker)) fail('Ponto de montagem do alerta não encontrado no PrivateLayout.');
  layout = layout.replace(
    marker,
    `            <PendingOrdersFloatingAlert\n                storeId={storeId}\n                enabled={hasPermission('orders.view')}\n            />\n${marker}`,
  );
}

// 2. Checkout: "pagar na retirada" não antecipa a forma final.
checkout = checkout.replace("type PaymentChoice = 'pix' | 'cash';", "type PaymentChoice = 'pix' | 'pending';");
checkout = checkout.replaceAll("paymentMethod === 'cash'", "paymentMethod === 'pending'");
checkout = checkout.replace("setPaymentMethod('cash')", "setPaymentMethod('pending')");
checkout = checkout.replace('Dinheiro na retirada', 'Pagar na retirada');

// 3. Tela de Pedidos: modal de pagamento, pronto com extensão e alerta de prazo.
if (!orders.includes("OrderPaymentModal")) {
  const importMarker = "import { OrderCommunicationService, type OrderMessageEventCode } from '@/services/orderCommunicationService';";
  if (!orders.includes(importMarker)) fail('Import do serviço de comunicação não encontrado em Orders.tsx.');
  orders = orders.replace(
    importMarker,
    `${importMarker}\nimport OrderPaymentModal, { type FinalPaymentMethodCode } from '@/components/orders/OrderPaymentModal';`,
  );
}

if (!orders.includes('finalizingOrder')) {
  const stateMarker = '    const [now, setNow] = useState(new Date());';
  if (!orders.includes(stateMarker)) fail('Estado now não encontrado em Orders.tsx.');
  orders = orders.replace(
    stateMarker,
    `${stateMarker}\n    const [finalizingOrder, setFinalizingOrder] = useState<Order | null>(null);\n    const [finalizationLoading, setFinalizationLoading] = useState(false);`,
  );
}

orders = orders.replace(
  "return orders.filter(o => o.status === 'reserved' || o.status === 'confirmed');",
  "return orders.filter(o => o.status === 'reserved' || o.status === 'confirmed' || o.status === 'ready');",
);

orders = orders.replace(
  "    async function openOrderMessage(order: Order, eventCode: OrderMessageEventCode) {",
  "    async function openOrderMessage(order: Order, eventCode: OrderMessageEventCode, expiresAtOverride?: string | null) {",
);
orders = orders.replace(
  "            expiresAt: order.stock_reservations?.[0]?.expires_at || null,",
  "            expiresAt: expiresAtOverride || order.stock_reservations?.[0]?.expires_at || null,",
);

if (!orders.includes('async function markReadyAndNotify')) {
  const marker = '    // Update Status';
  if (!orders.includes(marker)) fail('Marcador Update Status não encontrado.');
  const functions = `    async function markReadyAndNotify(order: Order) {\n        try {\n            const { data, error } = await supabase.rpc('admin_mark_public_order_ready_safe', {\n                p_order_id: order.id,\n            });\n            if (error) throw error;\n            if (data?.ok === false) throw new Error(data?.error || 'Erro ao marcar pedido como pronto.');\n\n            const expiresAt = data?.expires_at || order.stock_reservations?.[0]?.expires_at || null;\n            setOrders((current) => current.map((item) => item.id === order.id\n                ? {\n                    ...item,\n                    status: 'ready',\n                    stock_reservations: expiresAt ? [{ expires_at: expiresAt }] : item.stock_reservations,\n                }\n                : item));\n\n            await openOrderMessage(order, 'order_ready', expiresAt);\n            await fetchOrders();\n        } catch (error) {\n            console.error('Erro ao marcar pedido como pronto:', error);\n            alert('Não foi possível marcar o pedido como pronto.');\n        }\n    }\n\n    async function finalizeOrder(method: FinalPaymentMethodCode) {\n        if (!finalizingOrder) return;\n        setFinalizationLoading(true);\n        try {\n            const { data, error } = await supabase.rpc('admin_finalize_public_order_with_payment', {\n                p_order_id: finalizingOrder.id,\n                p_payment_method_code: method,\n            });\n            if (error) throw error;\n            if (data?.ok === false) throw new Error(data?.error || 'Erro ao finalizar pedido.');\n\n            setFinalizingOrder(null);\n            await fetchOrders();\n        } catch (error) {\n            console.error('Erro ao finalizar pedido com pagamento:', error);\n            alert('Não foi possível finalizar o pedido e registrar o pagamento.');\n        } finally {\n            setFinalizationLoading(false);\n        }\n    }\n\n`;
  orders = orders.replace(marker, functions + marker);
}

// Timer também acompanha preparo e pronto.
orders = orders.replace(
  "if (order.status === 'reserved' && order.stock_reservations?.[0]) {",
  "if ((order.status === 'reserved' || order.status === 'confirmed' || order.status === 'ready') && order.stock_reservations?.[0]) {",
);
orders = orders.replace(
  "{order.status === 'reserved' && timerDisplay && (",
  "{(order.status === 'reserved' || order.status === 'confirmed' || order.status === 'ready') && timerDisplay && (",
);

orders = orders.replace(
  "        confirmed: 'bg-blue-100 text-blue-800 border-blue-200',\n        completed:",
  "        confirmed: 'bg-blue-100 text-blue-800 border-blue-200',\n        ready: 'bg-emerald-100 text-emerald-800 border-emerald-200',\n        completed:",
);
orders = orders.replace(
  "        confirmed: 'Em Preparo',\n        completed:",
  "        confirmed: 'Em Preparo',\n        ready: 'Pronto para retirada',\n        completed:",
);

orders = orders.replace(
  "order.status === 'confirmed' ? 'border-l-blue-400' :\n                                 order.status === 'completed' ?",
  "order.status === 'confirmed' ? 'border-l-blue-400' :\n                                 order.status === 'ready' ? 'border-l-emerald-400' :\n                                 order.status === 'completed' ?",
);
orders = orders.replace(
  "order.status === 'confirmed' ? <Clock size={24} /> :\n                                              order.status === 'completed' ?",
  "order.status === 'confirmed' ? <Clock size={24} /> :\n                                              order.status === 'ready' ? <CheckCircle size={24} /> :\n                                              order.status === 'completed' ?",
);

// Botão do bloco de contato também muda o estado antes de enviar.
orders = orders.replaceAll(
  "onClick={() => openOrderMessage(order, 'order_ready')}",
  "onClick={() => markReadyAndNotify(order)}",
);

// Em preparo: permitir prorrogar e marcar pronto.
const confirmedMarker = `                                                {order.status === 'confirmed' && (\n                                                    <>`;
if (orders.includes(confirmedMarker) && !orders.includes("order.status === 'confirmed' && (\n                                                    <>\n                                                        <button\n                                                            onClick={() => extendReservation")) {
  orders = orders.replace(
    confirmedMarker,
    `${confirmedMarker}\n                                                        <button\n                                                            onClick={() => extendReservation(order.id)}\n                                                            className="px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold text-sm transition"\n                                                        >\n                                                            Prorrogar (+{storeData?.config?.extension_minutes || 10}min)\n                                                        </button>`,
  );
}

orders = orders.replace(
  "onClick={() => updateStatus(order.id, 'completed')}",
  "onClick={() => setFinalizingOrder(order)}",
);

// Estado pronto: prorrogar, cancelar ou finalizar com pagamento.
if (!orders.includes("{order.status === 'ready' && (")) {
  const completedMarker = `                                                {order.status === 'completed' && (`;
  if (!orders.includes(completedMarker)) fail('Bloco completed não encontrado para inserir ações ready.');
  const readyBlock = `                                                {order.status === 'ready' && (\n                                                    <>\n                                                        <button\n                                                            onClick={() => extendReservation(order.id)}\n                                                            className="px-4 py-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg font-bold text-sm transition"\n                                                        >\n                                                            Prorrogar (+{storeData?.config?.extension_minutes || 10}min)\n                                                        </button>\n                                                        <button\n                                                            onClick={() => setFinalizingOrder(order)}\n                                                            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition shadow-lg shadow-green-200 flex items-center gap-2"\n                                                        >\n                                                            <CheckCircle size={16} /> Finalizar pedido\n                                                        </button>\n                                                    </>\n                                                )}\n\n`;
  orders = orders.replace(completedMarker, readyBlock + completedMarker);
}

if (!orders.includes('<OrderPaymentModal')) {
  const marker = '        </PageContainer>';
  if (!orders.includes(marker)) fail('Fechamento do PageContainer não encontrado.');
  orders = orders.replace(
    marker,
    `            <OrderPaymentModal\n                order={finalizingOrder}\n                loading={finalizationLoading}\n                onClose={() => !finalizationLoading && setFinalizingOrder(null)}\n                onConfirm={finalizeOrder}\n            />\n${marker}`,
  );
}

write(layoutPath, layout);
write(ordersPath, orders);
write(checkoutPath, checkout);

console.log('[pending-orders-payment] Alerta global, prazos e modal de pagamento aplicados.');
