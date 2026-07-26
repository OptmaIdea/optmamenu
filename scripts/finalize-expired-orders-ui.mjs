#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.resolve(__dirname, '../src/pages/private/admin/commercial/orders/Orders.tsx');
const original = fs.readFileSync(filePath, 'utf8');
const usesCrlf = original.includes('\r\n');
let source = original.replace(/\r\n/g, '\n');

const marker = 'function getAutomaticExpirationAt(order: Order)';
if (source.includes(marker)) {
  console.log('Interface de pedidos expirados já está finalizada.');
  process.exit(0);
}

const replacements = [
  {
    label: 'helper de expiração automática',
    search: "import OrderPaymentModal, { type FinalPaymentMethodCode } from '@/components/orders/OrderPaymentModal';\n",
    replacement: "import OrderPaymentModal, { type FinalPaymentMethodCode } from '@/components/orders/OrderPaymentModal';\n\nfunction getAutomaticExpirationAt(order: Order): string | null {\n    const metadata = (order as Order & { commercial_metadata?: Record<string, unknown> }).commercial_metadata;\n    if (metadata?.cancelled_reason !== 'reservation_expired') return null;\n    const cancelledAt = metadata.cancelled_at;\n    return typeof cancelledAt === 'string' && cancelledAt ? cancelledAt : null;\n}\n",
  },
  {
    label: 'estado vazio do filtro',
    search: "    const emptyStateMessage = filterStatus === 'current'\n        ? 'Nenhum pedido aguardando atendimento agora. Vendas de balcão concluídas ficam no dashboard, vida do cliente e histórico comercial.'\n        : 'Nenhum pedido encontrado para o filtro selecionado.';",
    replacement: "    const emptyStateMessage = filterStatus === 'current'\n        ? 'Nenhum pedido aguardando atendimento agora. Vendas de balcão concluídas ficam no dashboard, vida do cliente e histórico comercial.'\n        : filterStatus === 'expired_auto'\n            ? 'Nenhum pedido foi cancelado automaticamente por expiração.'\n            : 'Nenhum pedido encontrado para o filtro selecionado.';",
  },
  {
    label: 'metadado por card',
    search: "                    {displayedOrders.map(order => {\n                        // Calculate timer for this order if reserved",
    replacement: "                    {displayedOrders.map(order => {\n                        const automaticExpirationAt = getAutomaticExpirationAt(order);\n                        // Calculate timer for this order if reserved",
  },
  {
    label: 'badge de expiração automática',
    search: "                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${statusColors[order.status]}`}>\n                                                    {statusLabels[order.status]}\n                                                </span>",
    replacement: "                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${statusColors[order.status]}`}>\n                                                    {statusLabels[order.status]}\n                                                </span>\n                                                {automaticExpirationAt && (\n                                                    <span className=\"inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-800\">\n                                                        <Clock size={11} /> Expirado automaticamente · {formatDate(automaticExpirationAt)}\n                                                    </span>\n                                                )}",
  },
];

for (const item of replacements) {
  const occurrences = source.split(item.search).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Pré-validação falhou em “${item.label}”: esperado 1 ponto, encontrado ${occurrences}. Nenhum arquivo foi alterado.`);
  }
}

for (const item of replacements) source = source.replace(item.search, item.replacement);

const required = [
  marker,
  "filterStatus === 'expired_auto'",
  'const automaticExpirationAt = getAutomaticExpirationAt(order);',
  'Expirado automaticamente · {formatDate(automaticExpirationAt)}',
];
for (const value of required) {
  if (!source.includes(value)) throw new Error(`Pós-validação falhou: ${value}. Nenhum arquivo foi alterado.`);
}

fs.writeFileSync(filePath, usesCrlf ? source.replace(/\n/g, '\r\n') : source, 'utf8');
console.log('Filtro e badges de expiração automática integrados e validados em Orders.tsx.');
