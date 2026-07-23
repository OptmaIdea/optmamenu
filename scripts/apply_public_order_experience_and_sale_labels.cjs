#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = {
  catalog: path.join(root, 'src/pages/store/Catalog.tsx'),
  service: path.join(root, 'src/services/publicOrderService.ts'),
  routes: path.join(root, 'src/AppRoutes.tsx'),
  recent: path.join(root, 'src/components/common/RecentActivity.tsx'),
  types: path.join(root, 'src/pages/private/admin/products/inventory/types/inventory.types.ts'),
  hook: path.join(root, 'src/pages/private/admin/products/inventory/hooks/useStockMovement.ts'),
  narrative: path.join(root, 'src/pages/private/admin/products/inventory/utils/productMovementNarrative.ts'),
};

function fail(message) {
  console.error(`\n[public-order-experience] ${message}\n`);
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`Arquivo não encontrado: ${file}`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function replaceOnce(source, search, replacement, label) {
  if (!source.includes(search)) fail(`Trecho não encontrado: ${label}`);
  return source.replace(search, replacement);
}

function addBefore(source, marker, addition, label) {
  if (source.includes(addition.trim())) return source;
  if (!source.includes(marker)) fail(`Marcador não encontrado: ${label}`);
  return source.replace(marker, `${addition}${marker}`);
}

let service = read(files.service);
let routes = read(files.routes);
let catalog = read(files.catalog);
let recent = read(files.recent);
let types = read(files.types);
let hook = read(files.hook);
let narrative = read(files.narrative);

// -----------------------------------------------------------------------------
// Serviço e tipos de acompanhamento público
// -----------------------------------------------------------------------------
if (!service.includes('export interface PublicOrderTrackingResponse')) {
  service = addBefore(
    service,
    `export const PublicOrderService = {`,
    `export interface PublicOrderTrackingItem {\n    name: string;\n    quantity: number;\n    unit_price: number;\n    discount: number;\n    line_total: number;\n}\n\nexport interface PublicOrderTrackingResponse {\n    ok: boolean;\n    error?: string;\n    store?: {\n        name: string;\n        slug: string;\n        logo_url?: string | null;\n    };\n    order?: {\n        order_code: string;\n        status: string;\n        customer_name?: string | null;\n        subtotal: number;\n        delivery_fee: number;\n        total: number;\n        sales_channel: string;\n        fulfillment_type: string;\n        delivery_method_name?: string | null;\n        payment_method_name?: string | null;\n        table_code?: string | null;\n        created_at: string;\n        confirmed_at?: string | null;\n        completed_at?: string | null;\n        expires_at?: string | null;\n        items: PublicOrderTrackingItem[];\n    };\n}\n\n`,
    'tipos do acompanhamento público',
  );
}

if (!service.includes('getPublicOrderByToken')) {
  service = replaceOnce(
    service,
    `export const PublicOrderService = {\n    async createPublicOrder`,
    `export const PublicOrderService = {\n    async getPublicOrderByToken(token: string): Promise<PublicOrderTrackingResponse> {\n        const { data, error } = await supabaseCustomer.rpc('get_public_order_by_token', {\n            p_token: token,\n        });\n\n        if (error) {\n            console.error('get_public_order_by_token error:', error);\n            throw error;\n        }\n\n        return data as PublicOrderTrackingResponse;\n    },\n\n    async createPublicOrder`,
    'método de acompanhamento público',
  );
}

// -----------------------------------------------------------------------------
// Rota pública do pedido
// -----------------------------------------------------------------------------
if (!routes.includes("PublicOrderTracking")) {
  routes = replaceOnce(
    routes,
    `const Checkout = lazy(() => import('@/pages/store/Checkout'));`,
    `const Checkout = lazy(() => import('@/pages/store/Checkout'));\nconst PublicOrderTracking = lazy(() => import('@/pages/store/PublicOrderTracking'));`,
    'import da página pública do pedido',
  );
}

if (!routes.includes('path="/p/:publicOrderToken"')) {
  routes = replaceOnce(
    routes,
    `          <Route path="/checkout" element={<Checkout />} />`,
    `          <Route path="/checkout" element={<Checkout />} />\n          <Route path="/p/:publicOrderToken" element={<PublicOrderTracking />} />`,
    'rota pública do pedido',
  );
}

// -----------------------------------------------------------------------------
// Catálogo: splash, mensagem completa e link seguro
// -----------------------------------------------------------------------------
if (!catalog.includes('public_order_token: string;')) {
  catalog = replaceOnce(
    catalog,
    `        whatsapp_url?: string;\n    } | null>(null);`,
    `        whatsapp_url?: string;\n        public_order_token: string;\n        tracking_url: string;\n    } | null>(null);`,
    'estado de sucesso do pedido',
  );
}

if (!catalog.includes('function compactPublicOrderCode')) {
  catalog = replaceOnce(
    catalog,
    `// Simple Theme Toggle Icon Component`,
    `function compactPublicOrderCode(orderCode: string) {\n    const suffix = orderCode.split('-').pop();\n    return suffix ? \`#\${suffix}\` : orderCode;\n}\n\nfunction formatOrderCurrency(value: number) {\n    return Number(value || 0).toLocaleString('pt-BR', {\n        style: 'currency',\n        currency: 'BRL',\n    });\n}\n\n// Simple Theme Toggle Icon Component`,
    'helpers visuais do pedido',
  );
}

if (!catalog.includes("setTimeout(() => setOrderSuccess(null), 5000)")) {
  catalog = replaceOnce(
    catalog,
    `    const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);`,
    `    useEffect(() => {\n        if (!orderSuccess) return;\n        const timer = window.setTimeout(() => setOrderSuccess(null), 5000);\n        return () => window.clearTimeout(timer);\n    }, [orderSuccess]);\n\n    const [paymentMethods, setPaymentMethods] = useState<PublicPaymentMethod[]>([]);`,
    'temporizador do splash',
  );
}

const oldSuccessBlock = `            setOrderSuccess({\n                order_code: result.order.order_code,\n                total: Number(result.order.total || 0),\n                whatsapp_url: result.whatsapp?.url || undefined,\n            });\n            clearCart();\n\n            if (result.whatsapp?.url) {\n                window.open(result.whatsapp.url, '_blank', 'noopener,noreferrer');\n            }`;

if (catalog.includes(oldSuccessBlock)) {
  catalog = catalog.replace(
    oldSuccessBlock,
    `            const trackingUrl = \`${'${window.location.origin}'}/p/${'${encodeURIComponent(result.order.public_order_token)}'}\`;\n            const compactCode = compactPublicOrderCode(result.order.order_code);\n            const paymentName =\n                paymentMethods.find((method) => method.code === selectedPaymentMethodCode)?.name ||\n                'A combinar';\n            const fulfillmentName =\n                selectedDeliveryMethod?.name ||\n                (selectedFulfillmentType === 'delivery' ? 'Entrega' :\n                    selectedFulfillmentType === 'qr_table' ? 'Mesa/comanda' : 'Retirada');\n            const itemLines = cartItems.flatMap((item) => [\n                \`• \${item.quantity}x \${item.name}\`,\n                \`  \${formatOrderCurrency(Number(item.price || 0))} cada — \${formatOrderCurrency(Number(item.price || 0) * item.quantity)}\`,\n            ]);\n            const orderMessage = [\n                \`🛒 *Novo pedido — \${compactCode}*\`,\n                '',\n                \`🏪 *Loja:* \${store.name}\`,\n                \`👤 *Cliente:* \${customerName.trim() || 'Cliente não identificado'}\`,\n                '',\n                '📦 *Itens*',\n                ...itemLines,\n                '',\n                \`Subtotal: \${formatOrderCurrency(Number(result.order.subtotal || 0))}\`,\n                ...(Number(result.order.delivery_fee || 0) > 0\n                    ? [\`Entrega: \${formatOrderCurrency(Number(result.order.delivery_fee || 0))}\`]\n                    : []),\n                \`*Total: \${formatOrderCurrency(Number(result.order.total || 0))}*\`,\n                '',\n                \`💳 *Pagamento:* \${paymentName}\`,\n                \`📍 *Atendimento:* \${fulfillmentName}\`,\n                ...(tableCode ? [\`🪑 *Mesa/comanda:* \${tableCode}\`] : []),\n                '',\n                '🔗 *Acompanhar este pedido:*',\n                trackingUrl,\n                '',\n                'Por favor, confirme o recebimento do pedido.',\n            ].join('\\n');\n            const orderWhatsappUrl =\n                result.whatsapp?.digits && canOpenWhatsapp(result.whatsapp.digits)\n                    ? buildWhatsappUrl(result.whatsapp.digits, orderMessage)\n                    : result.whatsapp?.url || undefined;\n\n            setOrderSuccess({\n                order_code: result.order.order_code,\n                total: Number(result.order.total || 0),\n                whatsapp_url: orderWhatsappUrl,\n                public_order_token: result.order.public_order_token,\n                tracking_url: trackingUrl,\n            });\n            clearCart();\n\n            if (orderWhatsappUrl) {\n                window.open(orderWhatsappUrl, '_blank', 'noopener,noreferrer');\n            }`,
  );
} else if (!catalog.includes('const trackingUrl =')) {
  fail('Bloco de sucesso do pedido não encontrado no Catalog.tsx');
}

if (!catalog.includes('Pedido enviado com sucesso!')) {
  catalog = replaceOnce(
    catalog,
    `            {!storeStatus.isOpen && (`,
    `            {orderSuccess && (\n                <div className="fixed inset-x-4 top-5 z-[120] mx-auto max-w-lg animate-fadeIn">\n                    <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xl dark:border-emerald-800 dark:bg-slate-900">\n                        <div className="flex items-start gap-3">\n                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">✓</div>\n                            <div className="min-w-0 flex-1">\n                                <p className="font-black text-emerald-800 dark:text-emerald-200">Pedido enviado com sucesso!</p>\n                                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">\n                                    Pedido {compactPublicOrderCode(orderSuccess.order_code)} encaminhado para a loja.\n                                </p>\n                                <a href={orderSuccess.tracking_url} className="mt-2 inline-flex text-sm font-bold text-emerald-700 hover:underline dark:text-emerald-300">\n                                    Acompanhar pedido\n                                </a>\n                            </div>\n                            <button type="button" onClick={() => setOrderSuccess(null)} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800">×</button>\n                        </div>\n                    </div>\n                </div>\n            )}\n\n            {!storeStatus.isOpen && (`,
    'splash do pedido enviado',
  );
}

// -----------------------------------------------------------------------------
// Atividades recentes: código compacto do pedido
// -----------------------------------------------------------------------------
if (!recent.includes('function formatActivityTarget')) {
  recent = replaceOnce(
    recent,
    `function formatActivityDateTime(timestamp: Date): string {`,
    `function formatActivityTarget(activity: Activity): string {\n  if (activity.type !== 'order') return activity.target;\n  const match = String(activity.target || '').match(/PED-[A-Z0-9-]*-([A-Z0-9]{4,})$/i);\n  return match?.[1] ? \`#\${match[1]}\` : activity.target;\n}\n\nfunction formatActivityDateTime(timestamp: Date): string {`,
    'compactação do pedido',
  );
}

recent = recent.replace(`                      {activity.target}`, `                      {formatActivityTarget(activity)}`);

// -----------------------------------------------------------------------------
// Movimentações: preservar metadata e explicar a causa real da saída
// -----------------------------------------------------------------------------
if (!types.includes('metadata?: Record<string, unknown> | null;')) {
  types = replaceOnce(
    types,
    `    divergence_reason?: string | null;\n}`,
    `    divergence_reason?: string | null;\n    metadata?: Record<string, unknown> | null;\n}`,
    'metadata no tipo StockMovement',
  );
}

if (!hook.includes('metadata?: Record<string, unknown> | null;')) {
  hook = replaceOnce(
    hook,
    `    divergence_reason?: string | null;\n    products?: { name?: string | null };`,
    `    divergence_reason?: string | null;\n    metadata?: Record<string, unknown> | null;\n    products?: { name?: string | null };`,
    'metadata no item da RPC',
  );
}

if (!hook.includes('metadata: item.metadata ?? {}')) {
  hook = replaceOnce(
    hook,
    `                    divergence_reason: item.divergence_reason ?? null,\n                };`,
    `                    divergence_reason: item.divergence_reason ?? null,\n                    metadata: item.metadata ?? {},\n                };`,
    'metadata no mapeamento final',
  );
}

if (!narrative.includes('order_id?: string | null;')) {
  narrative = replaceOnce(
    narrative,
    `  source_id?: string | null;\n  transfer_id?: string | null;`,
    `  source_id?: string | null;\n  order_id?: string | null;\n  transfer_id?: string | null;`,
    'order_id na narrativa',
  );
}

if (!narrative.includes('function getSaleChannelLabel')) {
  narrative = replaceOnce(
    narrative,
    `export function getMovementDestinationLabel(movement: ProductMovementNarrativeInput) {`,
    `function isSaleMovement(movement: ProductMovementNarrativeInput) {\n  const source = String(movement.source ?? '').toLowerCase();\n  return ['order', 'public_order', 'direct_sale'].includes(source) || Boolean(movement.order_id);\n}\n\nfunction getSaleChannelLabel(movement: ProductMovementNarrativeInput) {\n  const source = String(movement.source ?? '').toLowerCase();\n  const channel = String(movement.metadata?.sales_channel ?? '').toLowerCase();\n  if (channel === 'qr_table') return 'Venda por mesa';\n  if (source === 'direct_sale' || channel === 'direct' || channel === 'in_person') return 'Venda direta';\n  if (source === 'public_order' || channel === 'public_store' || channel === 'whatsapp') return 'Venda online';\n  return 'Venda';\n}\n\nfunction getSaleCustomerLabel(movement: ProductMovementNarrativeInput) {\n  return (\n    getMetadataText(movement.metadata, 'customer_name') ??\n    getMetadataText(movement.metadata, 'customer_full_name') ??\n    getMetadataText(movement.metadata, 'destination_label') ??\n    'Cliente não identificado'\n  );\n}\n\nexport function getMovementDestinationLabel(movement: ProductMovementNarrativeInput) {`,
    'helpers de venda',
  );
}

if (!narrative.includes('return getSaleCustomerLabel(movement);')) {
  narrative = replaceOnce(
    narrative,
    `  if (source === 'stock_transfer') {\n    return asText(movement.to_location_name, 'Destino não identificado');\n  }\n\n  return asText(movement.to_location_name ?? movement.location_name, '—');`,
    `  if (source === 'stock_transfer') {\n    return asText(movement.to_location_name, 'Destino não identificado');\n  }\n\n  if (isSaleMovement(movement)) {\n    return getSaleCustomerLabel(movement);\n  }\n\n  return asText(movement.to_location_name ?? movement.location_name, '—');`,
    'destino da venda',
  );
}

if (!narrative.includes('return getSaleChannelLabel(movement);')) {
  narrative = replaceOnce(
    narrative,
    `  if (source === 'purchase_document' && type === 'entry') {\n    return 'Compra confirmada';\n  }`,
    `  if (source === 'purchase_document' && type === 'entry') {\n    return 'Compra confirmada';\n  }\n\n  if (type === 'exit' && isSaleMovement(movement)) {\n    return getSaleChannelLabel(movement);\n  }`,
    'tipo operacional da venda',
  );
}

if (!narrative.includes("shortReference(movement.order_id ?? movement.source_id, 'Pedido')")) {
  narrative = replaceOnce(
    narrative,
    `  if (source === 'purchase_document') {\n    const metadata = movement.metadata ?? {};`,
    `  if (isSaleMovement(movement)) {\n    return (\n      getMetadataText(movement.metadata, 'order_code') ??\n      shortReference(movement.order_id ?? movement.source_id, 'Pedido')\n    );\n  }\n\n  if (source === 'purchase_document') {\n    const metadata = movement.metadata ?? {};`,
    'referência da venda',
  );
}

if (!narrative.includes('por venda para')) {
  narrative = replaceOnce(
    narrative,
    `  if (type === 'exit') {\n    return \`${'${location}'} teve saída de ${'${qty}'} un. do estoque.\`;\n  }`,
    `  if (type === 'exit' && isSaleMovement(movement)) {\n    const customer = getSaleCustomerLabel(movement);\n    const reference = getMovementReferenceLabel(movement);\n    return \`${'${location}'} teve saída de ${'${qty}'} un. por venda para ${'${customer}'} (${reference}).\`;\n  }\n\n  if (type === 'exit') {\n    return \`${'${location}'} teve saída de ${'${qty}'} un. do estoque.\`;\n  }`,
    'descrição da venda',
  );
}

fs.writeFileSync(files.service, service, 'utf8');
fs.writeFileSync(files.routes, routes, 'utf8');
fs.writeFileSync(files.catalog, catalog, 'utf8');
fs.writeFileSync(files.recent, recent, 'utf8');
fs.writeFileSync(files.types, types, 'utf8');
fs.writeFileSync(files.hook, hook, 'utf8');
fs.writeFileSync(files.narrative, narrative, 'utf8');

// -----------------------------------------------------------------------------
// Áudio local: substitui referências quebradas e gera um WAV curto.
// -----------------------------------------------------------------------------
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return [full];
  });
}

const textExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.cjs', '.mjs']);
for (const file of walk(path.join(root, 'src'))) {
  if (!textExtensions.has(path.extname(file))) continue;
  const original = fs.readFileSync(file, 'utf8');
  const updated = original.replaceAll('/notification.mp3', '/notification.wav');
  if (updated !== original) fs.writeFileSync(file, updated, 'utf8');
}

const publicDir = path.join(root, 'public');
fs.mkdirSync(publicDir, { recursive: true });
const wavPath = path.join(publicDir, 'notification.wav');
const sampleRate = 8000;
const durationSeconds = 0.22;
const sampleCount = Math.floor(sampleRate * durationSeconds);
const dataSize = sampleCount * 2;
const buffer = Buffer.alloc(44 + dataSize);
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);
for (let i = 0; i < sampleCount; i += 1) {
  const envelope = 1 - i / sampleCount;
  const sample = Math.sin((2 * Math.PI * 740 * i) / sampleRate) * 0.28 * envelope;
  buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
}
fs.writeFileSync(wavPath, buffer);

console.log('[public-order-experience] Ajustes aplicados.');
console.log('[public-order-experience] Página pública, splash, WhatsApp, atividades, vendas e áudio atualizados.');