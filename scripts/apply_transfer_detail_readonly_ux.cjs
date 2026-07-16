#!/usr/bin/env node
/*
 * Aplica ajustes conservadores de UX de modo leitura no detalhe da transferência.
 *
 * Uso:
 *   node scripts/apply_transfer_detail_readonly_ux.cjs
 *
 * O script alinha ações internas ao catálogo V3 usando transfers.manage para
 * enviar, receber, cancelar e tratar divergências. A visualização do detalhe,
 * timeline, itens e exportação permanecem disponíveis via transfers.view.
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/products/inventory/TransferDetailPage.tsx'
);

function fail(message) {
  console.error(`\n[transfer-detail-readonly-ux] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[transfer-detail-readonly-ux] Aviso: ${message}`);
}

if (!fs.existsSync(targetPath)) {
  fail(`Arquivo não encontrado: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

function replaceAll(search, replacement, label) {
  if (!source.includes(search)) {
    if (!source.includes(replacement)) {
      warn(`trecho não encontrado para: ${label}; pode já estar aplicado ou variar nesta versão.`);
    }
    return false;
  }

  const before = source;
  source = source.split(search).join(replacement);
  changed = changed || before !== source;
  return true;
}

function replaceOnce(search, replacement, label, alreadyAppliedNeedle = replacement) {
  if (source.includes(alreadyAppliedNeedle)) return true;

  if (!source.includes(search)) {
    warn(`trecho não encontrado para: ${label}; pode já estar aplicado ou variar nesta versão.`);
    return false;
  }

  source = source.replace(search, replacement);
  changed = true;
  return true;
}

replaceOnce(
  `    const { hasPermission } = usePermissions(storeId ?? null);
    const canConfirmTransfers = hasPermission('transfers.confirm');
    const canCancelTransfers = hasPermission('transfers.cancel');`,
  `    const { hasPermission } = usePermissions(storeId ?? null);
    const canManageTransfers = hasPermission('transfers.manage');`,
  'alinhar permissões do detalhe ao catálogo V3',
  `const canManageTransfers = hasPermission('transfers.manage');`
);

replaceAll(
  'if (!canConfirmTransfers) {',
  'if (!canManageTransfers) {',
  'guards confirmar/enviar/receber'
);

replaceAll(
  'if (!canCancelTransfers) {',
  'if (!canManageTransfers) {',
  'guard cancelar'
);

replaceAll(
  '{canConfirmTransfers && (',
  '{canManageTransfers && (',
  'ocultar ações confirmar/enviar'
);

replaceAll(
  '{canCancelTransfers && (',
  '{canManageTransfers && (',
  'ocultar cancelar'
);

replaceAll(
  'transfer.status === \'shipped\' && canConfirmTransfers && (',
  'transfer.status === \'shipped\' && canManageTransfers && (',
  'ocultar receber'
);

replaceOnce(
  `{showReceiveForm && transfer.status === 'shipped' && (`,
  `{showReceiveForm && transfer.status === 'shipped' && canManageTransfers && (`,
  'blindar formulário de recebimento',
  `{showReceiveForm && transfer.status === 'shipped' && canManageTransfers && (`
);

replaceOnce(
  `                            disabled={actionLoading}
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"`,
  `                            disabled={!canManageTransfers || actionLoading}
                            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"`,
  'desabilitar confirmar recebimento',
  `disabled={!canManageTransfers || actionLoading}`
);

replaceAll(
  `                                                    value={receivedQty}
                                                    onChange={(e) => {`,
  `                                                    value={receivedQty}
                                                    disabled={!canManageTransfers || actionLoading}
                                                    onChange={(e) => {`,
  'desabilitar quantidade recebida'
);

replaceAll(
  '                                                    disabled={!hasDivergence}',
  '                                                    disabled={!canManageTransfers || actionLoading || !hasDivergence}',
  'desabilitar campos de divergência'
);

replaceAll(
  'disabled:opacity-50 dark:border-emerald-900 dark:bg-gray-950',
  'disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-gray-950',
  'estilo disabled divergência'
);

replaceOnce(
  `            <TransferItemsTable items={items} />`,
  `            {!canManageTransfers && transfer.status && ['draft', 'shipped'].includes(transfer.status) && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    Você pode visualizar esta transferência, mas não tem permissão para enviar, receber, cancelar ou tratar divergências.
                </p>
            )}

            <TransferItemsTable items={items} />`,
  'aviso modo leitura detalhe transferência',
  'Você pode visualizar esta transferência, mas não tem permissão para enviar, receber, cancelar ou tratar divergências.'
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[transfer-detail-readonly-ux] TransferDetailPage.tsx atualizado com UX de leitura.');
} else {
  console.log('[transfer-detail-readonly-ux] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
