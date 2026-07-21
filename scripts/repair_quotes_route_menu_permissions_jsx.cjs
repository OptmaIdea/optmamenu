#!/usr/bin/env node
/*
 * Repara JSX da página standalone de Cotações após apply_quotes_route_menu_permissions.cjs.
 *
 * Problema corrigido:
 * - O botão Nova Cotação do quick-access é renderizado com createPortal(...).
 * - A condição canManageQuotes precisa envolver o createPortal por fora.
 * - Quando a condição é injetada dentro do argumento do createPortal, o TSX quebra.
 *
 * Uso:
 *   node scripts/repair_quotes_route_menu_permissions_jsx.cjs
 */

const fs = require('fs');
const path = require('path');

const root = process.cwd();
const filePath = path.join(root, 'src/pages/private/admin/products/inventory/PurchaseQuotationsPage.tsx');

function fail(message) {
  console.error(`\n[repair-quotes-jsx] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  fail(`Arquivo não encontrado: ${filePath}`);
}

let source = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

const portalBlock = `            {portalContainer && canManageQuotes && createPortal(
                <button
                    type="button"
                    onClick={() => setManualQuotationOpen(true)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#19A999] hover:bg-[#14887B] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
                >
                    <Plus size={13} />
                    <span>Nova Cotação</span>
                </button>,
                portalContainer
            )}`;

const portalPattern = /            \{portalContainer && createPortal\([\s\S]*?\n                portalContainer\n            \)\}/;
if (portalPattern.test(source)) {
  source = source.replace(portalPattern, portalBlock);
  changed = true;
} else if (!source.includes('{portalContainer && canManageQuotes && createPortal(')) {
  fail('Bloco createPortal de Nova Cotação não encontrado para reparo.');
}

const toolbarReplacement = `$1                    {canManageQuotes && (
                        <button
                            type="button"
                            onClick={() => setManualQuotationOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                            <Plus className="h-4 w-4" />
                            Nova cotação
                        </button>
                    )}
`;

const toolbarPattern = /(                <div className="flex flex-wrap items-center gap-2">\n)[\s\S]*?(?=\n                    <button\n                        type="button"\n                        onClick=\{exportFilteredQuotationsCsv\})/;
if (toolbarPattern.test(source)) {
  source = source.replace(toolbarPattern, toolbarReplacement);
  changed = true;
} else if (!source.includes('Nova cotação')) {
  fail('Bloco do botão Nova cotação no toolbar não encontrado para reparo.');
}

// Garante que as substituições perigosas anteriores não sobraram dentro de createPortal.
source = source.replace(
  /createPortal\(\s*\{canManageQuotes && \(/g,
  'createPortal('
);

// Garante que o botão de conversão na lista está sintaticamente correto.
source = source.replace(
  /\{canManageQuotes && quotation\.status === 'approved' && \(\s*<button/g,
  `{canManageQuotes && quotation.status === 'approved' && (\n                            <button`
);

// Garante que o botão Salvar resposta está sintaticamente correto.
source = source.replace(
  /\{canManageQuotes && detail\.status !== 'converted' && \(\s*<button/g,
  `{canManageQuotes && detail.status !== 'converted' && (\n                            <button`
);

if (changed) {
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('[repair-quotes-jsx] JSX de Cotações reparado. Rode npm run build.');
} else {
  console.log('[repair-quotes-jsx] Nenhuma alteração necessária.');
}
