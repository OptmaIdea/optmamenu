#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/pages/private/admin/commercial/orders/Orders.tsx');

function fail(message) {
  console.error(`\n[repair-order-ready] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(file)) fail('Orders.tsx não encontrado.');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const oldMarkOrderReady = `    async function markOrderReady(order: Order) {
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
`;

const newMarkOrderReady = `    async function markOrderReady(order: Order) {
        try {
            const { data, error } = await supabase.rpc('admin_mark_public_order_ready_safe', {
                p_order_id: order.id,
            });
            if (error) throw error;
            if (data?.ok === false) throw new Error(data?.error || 'Erro ao marcar pedido como pronto.');

            const expiresAt = data?.expires_at || order.stock_reservations?.[0]?.expires_at || null;
            const updatedOrder = {
                ...order,
                status: 'ready' as OrderStatus,
                available_until: expiresAt,
                cancellation_grace_until: data?.cancellation_grace_until || null,
                stock_reservations: expiresAt ? [{ expires_at: expiresAt }] : order.stock_reservations,
            } as Order;

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
`;

if (!source.includes(oldMarkOrderReady)) fail('Função markOrderReady esperada não encontrada.');
source = source.replace(oldMarkOrderReady, newMarkOrderReady);

const duplicatePattern = /\n    async function markReadyAndNotify\(order: Order\) \{[\s\S]*?\n    \}\n\n    async function finalizeOrder/;
if (!duplicatePattern.test(source)) fail('Função duplicada markReadyAndNotify não encontrada.');
source = source.replace(duplicatePattern, '\n    async function finalizeOrder');

const confirmedFinalizeButton = `                                                        <button
                                                            onClick={() => setFinalizingOrder(order)}
                                                            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition shadow-lg shadow-green-200 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Finalizar pedido
                                                        </button>`;

const confirmedReadyAndFinalizeButtons = `                                                        <button
                                                            type="button"
                                                            onClick={() => markOrderReady(order)}
                                                            className="px-4 py-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-bold text-sm transition flex items-center gap-2"
                                                        >
                                                            <MessageCircle size={16} /> Avisar que está pronto
                                                        </button>
                                                        <button
                                                            onClick={() => setFinalizingOrder(order)}
                                                            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition shadow-lg shadow-green-200 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Finalizar pedido
                                                        </button>`;

const confirmedBlockStart = source.indexOf("{order.status === 'confirmed' && (");
const readyBlockStart = source.indexOf("{order.status === 'ready' && (");
if (confirmedBlockStart < 0 || readyBlockStart < 0) fail('Blocos confirmed/ready não encontrados.');

const confirmedBlock = source.slice(confirmedBlockStart, readyBlockStart);
if (!confirmedBlock.includes(confirmedFinalizeButton)) fail('Botão de finalizar do bloco confirmed não encontrado.');
const updatedConfirmedBlock = confirmedBlock.replace(confirmedFinalizeButton, confirmedReadyAndFinalizeButtons);
source = source.slice(0, confirmedBlockStart) + updatedConfirmedBlock + source.slice(readyBlockStart);

if (source.includes('markReadyAndNotify')) fail('Ainda existe referência à função duplicada.');
if (!source.includes("onClick={() => markOrderReady(order)}")) fail('Botão de pedido pronto não foi conectado.');

fs.writeFileSync(file, source, 'utf8');
console.log('[repair-order-ready] Função de pedido pronto conectada e prazo atualizado.');
