#!/usr/bin/env node
/*
 * Alinha o front ao catálogo atual, onde Produtos possui somente products.manage.
 *
 * Uso:
 *   node scripts/repair_products_single_manage_permission.cjs
 *
 * Ajustes:
 * - Menu Produtos e Vida do Produto passam a usar products.manage.
 * - Rotas de Produtos e Vida do Produto passam a usar products.manage.
 * - Links de produto em Movimentações usam products.manage.
 * - Remove dependência runtime de products.view nesses pontos.
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const files = [
  'src/AppRoutes.tsx',
  'src/components/layouts/PrivateLayout.tsx',
  'src/pages/private/admin/products/inventory/StockMovements.tsx',
];

let changedFiles = 0;

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    console.error(`[products-manage] Arquivo não encontrado: ${relativePath}`);
    process.exitCode = 1;
    continue;
  }

  const original = fs.readFileSync(filePath, 'utf8');
  const updated = original.replace(/products\.view/g, 'products.manage');

  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    changedFiles += 1;
    console.log(`[products-manage] Atualizado: ${relativePath}`);
  } else {
    console.log(`[products-manage] Sem alteração necessária: ${relativePath}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);

console.log(`\n[products-manage] Concluído. Arquivos alterados: ${changedFiles}.`);
console.log('[products-manage] Rode npm run build e teste products.manage=false.');
