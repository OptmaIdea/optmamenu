#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'src/pages/store/Catalog.tsx');

if (!fs.existsSync(file)) {
  console.error('[repair-catalog-store] Catalog.tsx não encontrado.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const current = '`🏪 *Loja:* ${store.name}`';
const replacement = '`🏪 *Loja:* ${store?.name || \'Loja\'}`';

if (source.includes(current)) {
  source = source.replace(current, replacement);
  fs.writeFileSync(file, source, 'utf8');
  console.log('[repair-catalog-store] Nome da loja protegido contra valor nulo.');
  process.exit(0);
}

if (source.includes(replacement)) {
  console.log('[repair-catalog-store] Ajuste já estava aplicado.');
  process.exit(0);
}

console.error('[repair-catalog-store] Trecho esperado não encontrado em Catalog.tsx.');
process.exit(1);
