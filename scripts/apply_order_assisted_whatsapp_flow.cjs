#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/pages/private/admin/commercial/orders/Orders.tsx');

function fail(message) {
  console.error(`\n[order-assisted-whatsapp] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(file)) fail('Orders.tsx não encontrado.');
let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

if (!source.includes("OrderCommunicationService")) {
  const marker = "import { useRealtimeListener } from '@/hooks/useRealtimeListener';";
  if (!source.includes(marker)) fail('Marcador de import não encontrado.');
  source = source.replace(
    marker,
    `${marker}\nimport { OrderCommunicationService, type OrderMessageEventCode } from '@/services/orderCommunicationService';`,
  );
}

const smsFunctionPattern = /\n    \/\/ Send SMS \/ WhatsApp via OptmaSMSGate[\s\S]*?\n    \/\/ Update Status/m;
if (!source.includes('async function openOrderMessage')) {
  if (!smsFunctionPattern.test(source)) fail('Função antiga do SMS Gate não encontrada.');
  source = source.replace(
    smsFunctionPattern,
    `
    function getPublicOrderFields(order: Order) {
        return order as Order & {
            order_code?: string;
            public_order_token?: string;
            fulfillment_type?: string;
        };
    }

    async function openOrderMessage(order: Order, eventCode: OrderMessageEventCode) {
        const publicOrder = getPublicOrderFields(order);
        const token = publicOrder.public_order_token;
        const orderCode = publicOrder.order_code || order.id;

        if (!token) {
            alert('Este pedido não possui link público de acompanhamento.');
            return false;
        }

        const phone = String(order.customer_phone || '').replace(/\\D/g, '');
        if (phone.length < 10) {
            alert('O cliente não possui um WhatsApp válido cadastrado neste pedido.');
            return false;
        }

        const storeSlug = String(
            (order as Order & { commercial_metadata?: Record<string, unknown> }).commercial_metadata?.slug || ''
        );

        const opened = await OrderCommunicationService.open(eventCode, {
            orderId: order.id,
            orderCode,
            customerName: order.customer_name,
            customerPhone: phone,
            trackingUrl: \`${'${window.location.origin}'}/p/${'${encodeURIComponent(token)}'}\`,
            catalogUrl: storeSlug
                ? \`${'${window.location.origin}'}/s/${'${encodeURIComponent(storeSlug)}'}\`
                : window.location.origin,
            expiresAt: order.stock_reservations?.[0]?.expires_at || null,
            fulfillmentType: publicOrder.fulfillment_type || null,
        });

        if (!opened) alert('Não foi possível abrir o WhatsApp para este cliente.');
        return opened;
    }

    // Update Status`,
  );
}

source = source.replace(
  `        for (const order of warningOrders) {
            const sentKey = \`warning_sms_\${order.id}\`;
            if (!localStorage.getItem(sentKey)) {
                sendSmsNotification(order, 'warning');
                localStorage.setItem(sentKey, 'true');
            }
        }`,
  `        // O aviso ao cliente é assistido. A tela apenas identifica pedidos próximos do vencimento.
        void warningOrders;`,
);

source = source.replace(
  `        for (const order of expiredOrders) {
            const sentKey = \`cancelled_sms_\${order.id}\`;
            if (!localStorage.getItem(sentKey)) {
                sendSmsNotification(order, 'cancelled');
                localStorage.setItem(sentKey, 'true');
            }
        }

        fetchOrders();`,
  `        fetchOrders();`,
);

source = source.replace(
  `            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Erro ao atualizar status');
        }
    }`,
  `            setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            return true;
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Erro ao atualizar status');
            return false;
        }
    }`,
);

source = source.replace(
  `                                                        {storeData?.token && (
                                                            <button
                                                                onClick={() => sendSmsNotification(order, 'prepared')}
                                                                className="flex items-center justify-center gap-2 w-full p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-sm font-bold mt-2"
                                                            >
                                                                <MessageCircle size={16} /> Enviar Aviso "Preparando"
                                                            </button>
                                                        )}`,
  `                                                        <button
                                                            type="button"
                                                            onClick={() => openOrderMessage(order, 'order_accepted')}
                                                            className="flex items-center justify-center gap-2 w-full p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition text-sm font-bold mt-2"
                                                        >
                                                            <MessageCircle size={16} /> Mensagem de pedido aceito
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openOrderMessage(order, 'order_ready')}
                                                            className="flex items-center justify-center gap-2 w-full p-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 transition text-sm font-bold mt-2"
                                                        >
                                                            <MessageCircle size={16} /> Avisar que está pronto
                                                        </button>`,
);

source = source.replace(
  `                                                            onClick={() => updateStatus(order.id, 'cancelled')}`,
  `                                                            onClick={async () => {
                                                                const changed = await updateStatus(order.id, 'cancelled');
                                                                if (changed && window.confirm('Deseja avisar o cliente pelo WhatsApp?')) {
                                                                    await openOrderMessage(order, 'order_cancelled');
                                                                }
                                                            }}`,
);

source = source.replace(
  `                                                            onClick={() => {
                                                                const confirmSend = window.confirm('Deseja enviar aviso automático para o cliente?');
                                                                updateStatus(order.id, 'confirmed');
                                                                if (confirmSend) sendSmsNotification(order, 'prepared');
                                                            }}`,
  `                                                            onClick={async () => {
                                                                const changed = await updateStatus(order.id, 'confirmed');
                                                                if (changed && window.confirm('Pedido aceito. Deseja abrir a mensagem para o cliente?')) {
                                                                    await openOrderMessage(order, 'order_accepted');
                                                                }
                                                            }}`,
);

const confirmedCancel = `                                                            onClick={() => updateStatus(order.id, 'cancelled')}`;
if (source.includes(confirmedCancel)) {
  source = source.replace(
    confirmedCancel,
    `                                                            onClick={async () => {
                                                                const changed = await updateStatus(order.id, 'cancelled');
                                                                if (changed && window.confirm('Deseja avisar o cliente pelo WhatsApp?')) {
                                                                    await openOrderMessage(order, 'order_cancelled');
                                                                }
                                                            }}`,
  );
}

source = source.replace(
  `                                                        <button
                                                            onClick={() => updateStatus(order.id, 'completed')}
                                                            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition shadow-lg shadow-green-200 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Prontificar / Finalizar
                                                        </button>`,
  `                                                        <button
                                                            type="button"
                                                            onClick={() => openOrderMessage(order, 'order_ready')}
                                                            className="px-4 py-2 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg font-bold text-sm transition flex items-center gap-2"
                                                        >
                                                            <MessageCircle size={16} /> Avisar que está pronto
                                                        </button>
                                                        <button
                                                            onClick={() => updateStatus(order.id, 'completed')}
                                                            className="px-6 py-2 text-white bg-green-600 hover:bg-green-700 rounded-lg font-bold text-sm transition shadow-lg shadow-green-200 flex items-center gap-2"
                                                        >
                                                            <CheckCircle size={16} /> Finalizar pedido
                                                        </button>`,
);

if (source.includes('sendSmsNotification(')) fail('Ainda restaram chamadas ao SMS Gate em Orders.tsx.');
if (!source.includes('OrderCommunicationService.open')) fail('O novo serviço não foi conectado.');

fs.writeFileSync(file, source, 'utf8');
console.log('[order-assisted-whatsapp] Fluxo assistido aplicado à tela de Pedidos.');
