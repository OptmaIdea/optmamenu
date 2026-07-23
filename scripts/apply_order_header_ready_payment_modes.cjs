#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = {
  layout: path.join(root, 'src/components/layouts/PrivateLayout.tsx'),
  orders: path.join(root, 'src/pages/private/admin/commercial/orders/Orders.tsx'),
  communication: path.join(root, 'src/services/orderCommunicationService.ts'),
  checkout: path.join(root, 'src/pages/store/Checkout.tsx'),
  types: path.join(root, 'src/types/index.ts'),
};

function fail(message) {
  console.error(`\n[order-header-ready-payment] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

let layout = read(files.layout);
let orders = read(files.orders);
let communication = read(files.communication);
let checkout = read(files.checkout);
let types = read(files.types);

// 1. Tipos de configuração.
if (!types.includes('ready_hold_minutes?: number;')) {
  types = types.replace(
    '    extension_minutes?: number;',
    `    extension_minutes?: number;\n    ready_hold_minutes?: number;\n    expiration_grace_minutes?: number;\n    payment_timing?: {\n        pay_now_enabled?: boolean;\n        pay_on_pickup_enabled?: boolean;\n    };`,
  );
}

// 2. Badge de pedidos ativos no cabeçalho.
if (!layout.includes("useActiveOrderCount")) {
  const importMarker = "import { useOrderMonitor } from '@/hooks/useOrderMonitor';";
  if (!layout.includes(importMarker)) fail('Import de useOrderMonitor não encontrado no layout.');
  layout = layout.replace(
    importMarker,
    `${importMarker}\nimport { useActiveOrderCount } from '@/hooks/useActiveOrderCount';`,
  );
}

if (!layout.includes('activeOrderCount')) {
  const stateMarker = '    const [storeId, setStoreId] = useState<string | null>(null);';
  if (!layout.includes(stateMarker)) fail('Estado storeId não encontrado no layout.');
  layout = layout.replace(
    stateMarker,
    `${stateMarker}\n    const { count: activeOrderCount } = useActiveOrderCount({\n        storeId,\n        enabled: hasPermission('orders.view'),\n        intervalMs: 15_000,\n    });`,
  );
}

if (!layout.includes('title={activeOrderCount > 0')) {
  const marker = `                        <span className="w-[1px] h-6 bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block shrink-0" />`;
  if (!layout.includes(marker)) fail('Separador do cabeçalho não encontrado.');
  const button = `                        {hasPermission('orders.view') && (\n                            <Link\n                                to="/admin/orders"\n                                title={activeOrderCount > 0 ? \\`${'${activeOrderCount}'} pedidos ativos\\` : 'Abrir pedidos'}\n                                className={\\`relative p-2 rounded-lg transition shrink-0 ${'${activeOrderCount > 0 ? \'text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300\' : \'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700\'}'}\\`}\n                            >\n                                <ShoppingBag size={19} className={activeOrderCount > 0 ? 'animate-pulse' : ''} />\n                                {activeOrderCount > 0 && (\n                                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-red-600 px-1 text-[10px] font-black text-white dark:border-gray-800">\n                                        {activeOrderCount > 99 ? '99+' : activeOrderCount}\n                                    </span>\n                                )}\n                            </Link>\n                        )}\n\n`;
  layout = layout.replace(marker, button + marker);
}

// 3. Remover botão duplicado do quadro do cliente.
orders = orders.replace(/\n\s*<button\n\s*type="button"\n\s*onClick=\{\(\) => markOrderReady\(order\)\}[\s\S]*?<MessageCircle size=\{16\} \/> Avisar que está pronto\n\s*<\/button>/, '');

// 4. Mensagem de pronto recebe prazo e estado de pagamento.
if (!communication.includes('paymentStatus?:')) {
  communication = communication.replace(
    '  fulfillmentType?: string | null;',
    `  fulfillmentType?: string | null;\n  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | null;`,
  );
}

if (!communication.includes('{readyDeadlineText}')) {
  communication = communication.replace(
    "    '{readyText}',\n    '',\n    'Acompanhe aqui:',",
    "    '{readyText}',\n    '{readyDeadlineText}',\n    '',\n    'Acompanhe aqui:',",
  );
}

if (!communication.includes('function readyDeadlineText')) {
  communication = communication.replace(
    'function renderTemplate(template: string, data: OrderMessageData): string {',
    `function readyDeadlineText(data: OrderMessageData): string {\n  if (data.paymentStatus === 'paid' || !data.expiresAt) return '';\n  return \\`Retire até às *${'${formatTime(data.expiresAt)}'}*.\\`;\n}\n\nfunction renderTemplate(template: string, data: OrderMessageData): string {`,
  );
}

if (!communication.includes("'{readyDeadlineText}':")) {
  communication = communication.replace(
    "    '{readyText}': readyText(data.fulfillmentType),",
    "    '{readyText}': readyText(data.fulfillmentType),\n    '{readyDeadlineText}': readyDeadlineText(data),",
  );
}

orders = orders.replace(
  '            fulfillmentType: publicOrder.fulfillment_type || null,',
  `            fulfillmentType: publicOrder.fulfillment_type || null,\n            paymentStatus: publicOrder.payment_status || null,`,
);

const oldReadyBlock = `            const updatedOrder = { ...order, status: 'ready' as OrderStatus };\n            setOrders((current) => current.map((item) => item.id === order.id ? updatedOrder : item));\n            await openOrderMessage(updatedOrder, 'order_ready');`;
const newReadyBlock = `            const expiresAt = data?.expires_at || order.stock_reservations?.[0]?.expires_at || null;\n            const updatedOrder = {\n                ...order,\n                status: 'ready' as OrderStatus,\n                payment_status: data?.payment_status || getPublicOrderFields(order).payment_status || 'pending',\n                available_until: expiresAt,\n                stock_reservations: expiresAt ? [{ expires_at: expiresAt }] : order.stock_reservations,\n            } as Order;\n            setOrders((current) => current.map((item) => item.id === order.id ? updatedOrder : item));\n            await openOrderMessage(updatedOrder, 'order_ready', expiresAt);`;
if (orders.includes(oldReadyBlock)) orders = orders.replace(oldReadyBlock, newReadyBlock);

// 5. Checkout: apenas pagamento na retirada por enquanto; "Pagar aqui" fica visível, mas indisponível até integração.
checkout = checkout.replace("type PaymentChoice = 'pix' | 'pending';", "type PaymentChoice = 'pending';");
checkout = checkout.replace("useState<PaymentChoice>('pix')", "useState<PaymentChoice>('pending')");
checkout = checkout.replace("import { ArrowLeft, CheckCircle2, Send, ShoppingBag, Store, Trash2, Wallet } from 'lucide-react';", "import { ArrowLeft, CheckCircle2, Send, ShoppingBag, Store, Trash2, Wallet } from 'lucide-react';");
checkout = checkout.replace(/\n\s*<button type="button" onClick=\{\(\) => setPaymentMethod\('pix'\)\}[\s\S]*?\{paymentMethod === 'pix' && <CheckCircle2 className="w-5 h-5 ml-auto text-green-600" \/>\}\n\s*<\/button>/, `\n                    <button type="button" disabled className="w-full flex items-center p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 opacity-70 cursor-not-allowed">\n                        <Wallet className="w-5 h-5 mr-3 text-gray-400" />\n                        <span className="text-left">\n                            <span className="block font-bold text-gray-600">Pagar aqui</span>\n                            <span className="block text-xs text-gray-400">PIX e cartão serão habilitados quando a integração online estiver configurada.</span>\n                        </span>\n                    </button>`);

checkout = checkout.replace(
  '<span className="font-bold text-gray-700">Pagar na retirada</span>',
  `<span className="text-left">\n                            <span className="block font-bold text-gray-700">Pagar na retirada</span>\n                            <span className="block text-xs text-gray-500">A forma real será informada ao finalizar: PIX, dinheiro ou cartão.</span>\n                        </span>`,
);

write(files.layout, layout);
write(files.orders, orders);
write(files.communication, communication);
write(files.checkout, checkout);
write(files.types, types);

console.log('[order-header-ready-payment] Cabeçalho, prazo de pronto, mensagem e pagamento ajustados.');
