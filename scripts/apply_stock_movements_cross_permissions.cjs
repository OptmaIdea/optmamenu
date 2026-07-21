#!/usr/bin/env node
/*
 * Ajusta permissões cruzadas na tela de Movimentações de Estoque.
 *
 * Regras:
 * - stock.view mantém consulta/filtros.
 * - stock.adjust controla ajuste manual e o próprio modal.
 * - products.view controla o atalho para Vida do Produto.
 * - transfers.view controla o atalho para detalhe da transferência.
 *
 * Uso:
 *   node scripts/apply_stock_movements_cross_permissions.cjs
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(
  process.cwd(),
  'src/pages/private/admin/products/inventory/StockMovements.tsx',
);

function fail(message) {
  console.error(`\n[stock-movements-cross-permissions] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  fail(`Arquivo não encontrado: ${filePath}`);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

function replaceRequired(before, after, label) {
  if (source.includes(after)) return;
  if (!source.includes(before)) fail(`Trecho não encontrado para ${label}.`);
  source = source.replace(before, after);
  changed = true;
}

replaceRequired(
  `  const canAdjustStock = hasPermission('stock.adjust');\n  const canExportReports = hasPermission('reports.export');`,
  `  const canAdjustStock = hasPermission('stock.adjust');\n  const canExportReports = hasPermission('reports.export');\n  const canViewProducts = hasPermission('products.view');\n  const canViewTransfers = hasPermission('transfers.view');`,
  'flags de permissões cruzadas',
);

replaceRequired(
  `                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 font-medium text-gray-900 dark:text-white">\n                            <button\n                              type="button"\n                              onClick={() => navigate(\`/admin/products/\${movement.product_id}/lifecycle\`)}\n                              className="font-medium text-[#19A999] hover:underline text-left"\n                            >\n                              {movement.product_name || 'Produto removido'}\n                            </button>\n                          </td>`,
  `                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 font-medium text-gray-900 dark:text-white">\n                            {canViewProducts ? (\n                              <button\n                                type="button"\n                                onClick={() => navigate(\`/admin/products/\${movement.product_id}/lifecycle\`)}\n                                className="font-medium text-[#19A999] hover:underline text-left"\n                              >\n                                {movement.product_name || 'Produto removido'}\n                              </button>\n                            ) : (\n                              <span>{movement.product_name || 'Produto removido'}</span>\n                            )}\n                          </td>`,
  'atalho Vida do Produto',
);

replaceRequired(
  `                            {movement.transfer_id && (\n                              <button\n                                type="button"\n                                onClick={() => navigate(\`/admin/transfers/\${movement.transfer_id}\`)}\n                                className="text-xs text-gray-500 hover:text-[#19A999] mt-0.5"\n                              >\n                                Ver transferência\n                              </button>\n                            )}`,
  `                            {canViewTransfers && movement.transfer_id && (\n                              <button\n                                type="button"\n                                onClick={() => navigate(\`/admin/transfers/\${movement.transfer_id}\`)}\n                                className="text-xs text-gray-500 hover:text-[#19A999] mt-0.5"\n                              >\n                                Ver transferência\n                              </button>\n                            )}`,
  'atalho Ver transferência',
);

replaceRequired(
  `      <ManualStockAdjustmentModal\n        open={adjustmentModalOpen}\n        onClose={() => setAdjustmentModalOpen(false)}\n        onSuccess={() => {\n          void loadMovements();\n          refreshInventory();\n        }}\n        products={availableProducts}\n        locations={adjustmentLocations.length > 0 ? adjustmentLocations : locationOptions}\n      />`,
  `      {canAdjustStock && (\n        <ManualStockAdjustmentModal\n          open={adjustmentModalOpen}\n          onClose={() => setAdjustmentModalOpen(false)}\n          onSuccess={() => {\n            void loadMovements();\n            refreshInventory();\n          }}\n          products={availableProducts}\n          locations={adjustmentLocations.length > 0 ? adjustmentLocations : locationOptions}\n        />\n      )}`,
  'proteção do modal de ajuste',
);

if (changed) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('[stock-movements-cross-permissions] Permissões cruzadas aplicadas com sucesso.');
} else {
  console.log('[stock-movements-cross-permissions] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
