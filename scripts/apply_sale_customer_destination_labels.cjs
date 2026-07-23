#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = {
  types: path.join(root, 'src/pages/private/admin/products/inventory/types/inventory.types.ts'),
  hook: path.join(root, 'src/pages/private/admin/products/inventory/hooks/useStockMovement.ts'),
  narrative: path.join(root, 'src/pages/private/admin/products/inventory/utils/productMovementNarrative.ts'),
};

function fail(message) {
  console.error(`\n[apply-sale-customer-destination] ${message}\n`);
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

let types = read(files.types);
let hook = read(files.hook);
let narrative = read(files.narrative);

types = replaceOnce(
  types,
  `    divergence_reason?: string | null;\n}`,
  `    divergence_reason?: string | null;\n    metadata?: Record<string, unknown> | null;\n}`,
  'metadata no tipo StockMovement',
);

hook = replaceOnce(
  hook,
  `    divergence_reason?: string | null;\n    products?: { name?: string | null };`,
  `    divergence_reason?: string | null;\n    metadata?: Record<string, unknown> | null;\n    products?: { name?: string | null };`,
  'metadata no item da RPC',
);

hook = replaceOnce(
  hook,
  `                    divergence_reason: item.divergence_reason ?? null,\n                };`,
  `                    divergence_reason: item.divergence_reason ?? null,\n                    metadata: item.metadata ?? {},\n                };`,
  'metadata no mapeamento final',
);

narrative = replaceOnce(
  narrative,
  `  source_id?: string | null;\n  transfer_id?: string | null;`,
  `  source_id?: string | null;\n  order_id?: string | null;\n  transfer_id?: string | null;`,
  'order_id na narrativa',
);

narrative = replaceOnce(
  narrative,
  `export function getMovementDestinationLabel(movement: ProductMovementNarrativeInput) {\n  const source = String(movement.source ?? '').toLowerCase();`,
  `function isSaleMovement(movement: ProductMovementNarrativeInput) {\n  const source = String(movement.source ?? '').toLowerCase();\n  return ['order', 'public_order', 'direct_sale'].includes(source) || Boolean(movement.order_id);\n}\n\nfunction getSaleCustomerLabel(movement: ProductMovementNarrativeInput) {\n  return (\n    getMetadataText(movement.metadata, 'customer_name') ??\n    getMetadataText(movement.metadata, 'customer_full_name') ??\n    getMetadataText(movement.metadata, 'order_customer_name') ??\n    getMetadataText(movement.metadata, 'destination_label') ??\n    'Cliente não identificado'\n  );\n}\n\nexport function getMovementDestinationLabel(movement: ProductMovementNarrativeInput) {\n  const source = String(movement.source ?? '').toLowerCase();`,
  'helpers de venda',
);

narrative = replaceOnce(
  narrative,
  `  if (source === 'stock_transfer') {\n    return asText(movement.to_location_name, 'Destino não identificado');\n  }\n\n  return asText(movement.to_location_name ?? movement.location_name, '—');`,
  `  if (source === 'stock_transfer') {\n    return asText(movement.to_location_name, 'Destino não identificado');\n  }\n\n  if (isSaleMovement(movement)) {\n    return getSaleCustomerLabel(movement);\n  }\n\n  return asText(movement.to_location_name ?? movement.location_name, '—');`,
  'destino da venda',
);

narrative = replaceOnce(
  narrative,
  `  if (source === 'purchase_document') {\n    const metadata = movement.metadata ?? {};`,
  `  if (isSaleMovement(movement)) {\n    return (\n      getMetadataText(movement.metadata, 'order_code') ??\n      shortReference(movement.order_id ?? movement.source_id, 'Pedido')\n    );\n  }\n\n  if (source === 'purchase_document') {\n    const metadata = movement.metadata ?? {};`,
  'referência da venda',
);

narrative = replaceOnce(
  narrative,
  `  if (type === 'exit') {\n    return \`${'${location}'} teve saída de ${'${qty}'} un. do estoque.\`;\n  }`,
  `  if (type === 'exit' && isSaleMovement(movement)) {\n    const customer = getSaleCustomerLabel(movement);\n    const reference = getMovementReferenceLabel(movement);\n    return \`${'${location}'} teve saída de ${'${qty}'} un. por venda para ${'${customer}'} (${'${reference}'}).\`;\n  }\n\n  if (type === 'exit') {\n    return \`${'${location}'} teve saída de ${'${qty}'} un. do estoque.\`;\n  }`,
  'descrição da venda',
);

fs.writeFileSync(files.types, types, 'utf8');
fs.writeFileSync(files.hook, hook, 'utf8');
fs.writeFileSync(files.narrative, narrative, 'utf8');

console.log('[apply-sale-customer-destination] Cliente e pedido aplicados às narrativas de venda.');
