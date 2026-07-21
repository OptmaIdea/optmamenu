#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/components/layouts/PrivateLayout.tsx');

if (!fs.existsSync(filePath)) {
  console.error('[products-section-gate] PrivateLayout.tsx não encontrado.');
  process.exit(1);
}

const original = fs.readFileSync(filePath, 'utf8');
const target = "        products: 'products.manage',";
const replacement = '        products: null,';

if (!original.includes(target)) {
  console.error('[products-section-gate] Regra products.manage do grupo não encontrada.');
  process.exit(1);
}

const updated = original.replace(target, replacement);
fs.writeFileSync(filePath, updated, 'utf8');
console.log('[products-section-gate] Grupo Produtos e Estoque liberado para avaliação item a item.');
console.log('[products-section-gate] Rode npm run build e teste products.manage=false.');
