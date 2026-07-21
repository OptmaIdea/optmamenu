#!/usr/bin/env node
/*
 * Ajusta o botão "Abrir compra" na lista de cotações.
 *
 * Regra:
 * - A cotação continua visível com quotes.view.
 * - O botão que navega para a compra vinculada só aparece com purchases.view.
 *
 * Uso:
 *   node scripts/apply_quotes_purchase_link_permission.cjs
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  process.cwd(),
  'src/pages/private/admin/products/inventory/PurchaseQuotationsPage.tsx',
);

function fail(message) {
  console.error(`\n[quotes-purchase-link-permission] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  fail(`Arquivo não encontrado: ${filePath}`);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

const flagsBefore = `    const canViewQuotes = hasEffectivePermission(permissions, 'quotes.view');
    const canManageQuotes = hasEffectivePermission(permissions, 'quotes.manage');`;

const flagsAfter = `    const canViewQuotes = hasEffectivePermission(permissions, 'quotes.view');
    const canManageQuotes = hasEffectivePermission(permissions, 'quotes.manage');
    const canViewPurchases = hasEffectivePermission(permissions, 'purchases.view');`;

if (!source.includes(`const canViewPurchases = hasEffectivePermission(permissions, 'purchases.view');`)) {
  if (!source.includes(flagsBefore)) {
    fail('Não foi possível localizar as flags de permissões da página.');
  }

  source = source.replace(flagsBefore, flagsAfter);
  changed = true;
}

const conditionBefore = `{quotation.status === 'converted' && quotation.converted_purchase_document_id && (`;
const conditionAfter = `{canViewPurchases && quotation.status === 'converted' && quotation.converted_purchase_document_id && (`;

if (!source.includes(conditionAfter)) {
  if (!source.includes(conditionBefore)) {
    fail('Não foi possível localizar o botão de abrir compra vinculada.');
  }

  source = source.replace(conditionBefore, conditionAfter);
  changed = true;
}

if (changed) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('[quotes-purchase-link-permission] Botão Abrir compra agora exige purchases.view.');
} else {
  console.log('[quotes-purchase-link-permission] Nenhuma alteração necessária; ajuste já aplicado.');
}
