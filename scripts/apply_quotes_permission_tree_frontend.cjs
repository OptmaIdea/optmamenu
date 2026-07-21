#!/usr/bin/env node
/*
 * Adiciona Cotações ao grupo hardcoded Produtos e Estoque da árvore de permissões.
 *
 * Contexto:
 * - O catálogo/RPC já pode retornar quotes.view e quotes.manage.
 * - A tela de Segurança também usa ROLE_PERMISSION_TREE para montar os grupos visuais.
 * - Sem incluir as chaves nessa árvore, Cotações não aparecem na aba Permissões por papel.
 *
 * Uso:
 *   node scripts/apply_quotes_permission_tree_frontend.cjs
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const filePath = path.join(root, 'src/pages/private/admin/settings/security/Security.tsx');

function fail(message) {
  console.error(`\n[quotes-permission-tree] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  fail(`Arquivo não encontrado: ${filePath}`);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');

if (source.includes("'quotes.view'") && source.includes("'quotes.manage'")) {
  console.log('[quotes-permission-tree] Cotações já aparecem na árvore de permissões. Nenhuma alteração necessária.');
  process.exit(0);
}

const anchor = `                    'purchases.cancel',
                    'transfers.view',`;
const replacement = `                    'purchases.cancel',
                    'quotes.view',
                    'quotes.manage',
                    'transfers.view',`;

if (!source.includes(anchor)) {
  fail('Âncora do grupo Produtos e Estoque não encontrada. Revise manualmente ROLE_PERMISSION_TREE em Security.tsx.');
}

source = source.replace(anchor, replacement);

fs.writeFileSync(filePath, source, 'utf8');
console.log('[quotes-permission-tree] Cotações adicionadas ao grupo Produtos e Estoque em ROLE_PERMISSION_TREE.');
