#!/usr/bin/env node
/*
 * Corrige a proteção da rota direta de Cotações.
 *
 * Uso:
 *   node scripts/repair_quotes_direct_route_permission.cjs
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/AppRoutes.tsx');

if (!fs.existsSync(filePath)) {
  console.error('[quotes-direct-route] src/AppRoutes.tsx não encontrado.');
  process.exit(1);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

const before = `<Route path="/admin/stock/quotations" element={<RequirePermission permission="purchases.view"><PurchaseQuotationsPage /></RequirePermission>} />`;
const after = `<Route path="/admin/stock/quotations" element={<RequirePermission permission="quotes.view"><PurchaseQuotationsPage /></RequirePermission>} />`;

if (source.includes(after)) {
  console.log('[quotes-direct-route] Rota já está protegida por quotes.view.');
  process.exit(0);
}

if (!source.includes(before)) {
  console.error('[quotes-direct-route] Trecho esperado não encontrado; revise src/AppRoutes.tsx manualmente.');
  process.exit(1);
}

source = source.replace(before, after);
fs.writeFileSync(filePath, source, 'utf8');

console.log('[quotes-direct-route] Rota /admin/stock/quotations corrigida para quotes.view.');
