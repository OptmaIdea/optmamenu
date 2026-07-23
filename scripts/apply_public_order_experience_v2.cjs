#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const catalogPath = path.join(root, 'src/pages/store/Catalog.tsx');
const routesPath = path.join(root, 'src/AppRoutes.tsx');
const recentPath = path.join(root, 'src/components/common/RecentActivity.tsx');

function fail(message) {
  console.error(`\n[public-order-v2] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

let catalog = read(catalogPath);
let routes = read(routesPath);
let recent = read(recentPath);

if (!routes.includes("PublicOrderTracking")) {
  routes = routes.replace(
    "const Checkout = lazy(() => import('@/pages/store/Checkout'));",
    "const Checkout = lazy(() => import('@/pages/store/Checkout'));\nconst PublicOrderTracking = lazy(() => import('@/pages/store/PublicOrderTracking'));",
  );
}

if (!routes.includes('path="/p/:publicOrderToken"')) {
  routes = routes.replace(
    '          <Route path="/checkout" element={<Checkout />} />',
    '          <Route path="/checkout" element={<Checkout />} />\n          <Route path="/p/:publicOrderToken" element={<PublicOrderTracking />} />',
  );
}

if (!catalog.includes('function compactPublicOrderCode')) {
  catalog = catalog.replace(
    '// Simple Theme Toggle Icon Component',
    `function compactPublicOrderCode(orderCode: string) {\n    const suffix = orderCode.split('-').pop();\n    return suffix ? \`#\${suffix}\` : orderCode;\n}\n\nfunction formatOrderCurrency(value: number) {\n    return Number(value || 0).toLocaleString('pt-BR', {\n        style: 'currency',\n        currency: 'BRL',\n    });\n}\n\n// Simple Theme Toggle Icon Component`,
  );
}

if (!catalog.includes('public_order_token: string;')) {
  catalog = catalog.replace(
    `        whatsapp_url?: string;\n    } | null>(null);`,
    `        whatsapp_url?: string;\n        public_order_token: string;\n        tracking_url: string;\n    } | null>(null);`,
  );
}

if (!catalog.includes('setTimeout(() => setOrderSuccess(null), 5000)')) {
  catalog = catalog.replace(
    `    const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);`,
    `    useEffect(() => {\n        if (!orderSuccess) return;\n        const timer = window.setTimeout(() => setOrderSuccess(null), 5000);\n        return () => window.clearTimeout(timer);\n    }, [orderSuccess]);\n\n    const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);`,
  );
}

const successPattern = /\s*setOrderSuccess\(\{\s*order_code:\s*result\.order\.order_code,\s*total:\s*Number\(result\.order\.total\s*\|\|\s*0\),\s*whatsapp_url:\s*result\.whatsapp\?\.url\s*\|\|\s*undefined,\s*\}\);\s*clearCart\(\);\s*if\s*\(result\.whatsapp\?\.url\)\s*\{\s*window\.open\(result\.whatsapp\.url,\s*'_blank',\s*'noopener,noreferrer'\);\s*\}/m;

if (!catalog.includes('const trackingUrl =')) {
  if (!successPattern.test(catalog)) fail('Bloco atual de sucesso do pedido não encontrado.');

  const replacement = `\n            const trackingUrl = \`${'${window.location.origin}'}/p/${'${encodeURIComponent(result.order.public_order_token)}'}\`;\n            const compactCode = compactPublicOrderCode(result.order.order_code);\n            const paymentName = paymentMethods.find((method) => method.code === selectedPaymentMethodCode)?.name || 'A combinar';\n            const fulfillmentName = selectedDeliveryMethod?.name || (selectedFulfillmentType === 'delivery' ? 'Entrega' : selectedFulfillmentType === 'qr_table' ? 'Mesa/comanda' : 'Retirada');\n            const itemLines = cartItems.flatMap((item) => [\n                \`• \${item.quantity}x \${item.name}\`,\n                \`  \${formatOrderCurrency(Number(item.price || 0))} cada — \${formatOrderCurrency(Number(item.price || 0) * item.quantity)}\`,\n            ]);\n            const orderMessage = [\n                \`🛒 *Novo pedido — \${compactCode}*\`,\n                '',\n                \`🏪 *Loja:* \${store.name}\`,\n                \`👤 *Cliente:* \${customerName.trim() || 'Cliente não identificado'}\`,\n                '',\n                '📦 *Itens*',\n                ...itemLines,\n                '',\n                \`Subtotal: \${formatOrderCurrency(Number(result.order.subtotal || 0))}\`,\n                ...(Number(result.order.delivery_fee || 0) > 0 ? [\`Entrega: \${formatOrderCurrency(Number(result.order.delivery_fee || 0))}\`] : []),\n                \`*Total: \${formatOrderCurrency(Number(result.order.total || 0))}*\`,\n                '',\n                \`💳 *Pagamento:* \${paymentName}\`,\n                \`📍 *Atendimento:* \${fulfillmentName}\`,\n                ...(tableCode ? [\`🪑 *Mesa/comanda:* \${tableCode}\`] : []),\n                '',\n                '🔗 *Acompanhar este pedido:*',\n                trackingUrl,\n                '',\n                'Por favor, confirme o recebimento do pedido.',\n            ].join('\\n');\n            const orderWhatsappUrl = result.whatsapp?.digits && canOpenWhatsapp(result.whatsapp.digits)\n                ? buildWhatsappUrl(result.whatsapp.digits, orderMessage)\n                : result.whatsapp?.url || undefined;\n\n            setOrderSuccess({\n                order_code: result.order.order_code,\n                total: Number(result.order.total || 0),\n                whatsapp_url: orderWhatsappUrl,\n                public_order_token: result.order.public_order_token,\n                tracking_url: trackingUrl,\n            });\n\n            clearCart();\n\n            if (orderWhatsappUrl) {\n                window.open(orderWhatsappUrl, '_blank', 'noopener,noreferrer');\n            }`;

  catalog = catalog.replace(successPattern, replacement);
}

if (!catalog.includes('Pedido enviado com sucesso!')) {
  const marker = '            {!storeStatus.isOpen && (';
  if (!catalog.includes(marker)) fail('Marcador visual do catálogo não encontrado.');
  catalog = catalog.replace(
    marker,
    `            {orderSuccess && (\n                <div className="fixed inset-x-4 top-5 z-[120] mx-auto max-w-lg animate-fadeIn">\n                    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-800 dark:bg-slate-900">\n                        <div className="flex items-start gap-3">\n                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓</div>\n                            <div className="min-w-0 flex-1">\n                                <p className="font-black text-emerald-800 dark:text-emerald-200">Pedido enviado com sucesso!</p>\n                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Pedido {compactPublicOrderCode(orderSuccess.order_code)} encaminhado para a loja.</p>\n                                <a href={orderSuccess.tracking_url} className="mt-2 inline-flex text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">Acompanhar pedido</a>\n                            </div>\n                            <button type="button" onClick={() => setOrderSuccess(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">×</button>\n                        </div>\n                    </div>\n                </div>\n            )}\n\n${marker}`,
  );
}

if (!recent.includes('function formatActivityTarget')) {
  recent = recent.replace(
    'function formatActivityDateTime(timestamp: Date): string {',
    `function formatActivityTarget(activity: Activity): string {\n  if (activity.type !== 'order') return activity.target;\n  const suffix = String(activity.target || '').split('-').pop();\n  return suffix ? \`#\${suffix}\` : activity.target;\n}\n\nfunction formatActivityDateTime(timestamp: Date): string {`,
  );
  recent = recent.replace('{activity.target}', '{formatActivityTarget(activity)}');
}

fs.writeFileSync(catalogPath, catalog, 'utf8');
fs.writeFileSync(routesPath, routes, 'utf8');
fs.writeFileSync(recentPath, recent, 'utf8');

console.log('[public-order-v2] Rota, splash, WhatsApp e código compacto aplicados.');