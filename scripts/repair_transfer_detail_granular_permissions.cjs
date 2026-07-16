#!/usr/bin/env node
/*
 * Repara o detalhe da transferência para respeitar as permissões granulares exibidas na UI.
 *
 * Uso:
 *   node scripts/repair_transfer_detail_granular_permissions.cjs
 *
 * Mapeamento esperado:
 * - transfers.view    -> abrir/visualizar detalhe
 * - transfers.create  -> criar rascunhos na lista
 * - transfers.confirm -> enviar e receber transferência
 * - transfers.cancel  -> cancelar transferência
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/products/inventory/TransferDetailPage.tsx'
);

function fail(message) {
  console.error(`\n[transfer-detail-granular-permissions] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[transfer-detail-granular-permissions] Aviso: ${message}`);
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

// Estado vindo do script anterior: reverte a chave ampla/oculta para as chaves granulares da UI.
replaceOnce(
  `    const { hasPermission } = usePermissions(storeId ?? null);
    const canManageTransfers = hasPermission('transfers.manage');`,
  `    const { hasPermission } = usePermissions(storeId ?? null);
    const canConfirmTransfers = hasPermission('transfers.confirm');
    const canCancelTransfers = hasPermission('transfers.cancel');`,
  'restaurar permissões granulares',
  `const canConfirmTransfers = hasPermission('transfers.confirm');`
);

// Estado original: mantém como está caso o arquivo ainda não tenha sido alterado pelo script anterior.
if (!source.includes(`const canConfirmTransfers = hasPermission('transfers.confirm');`)) {
  warn('não foi possível confirmar as constantes granulares de transferência.');
}

// Enviar/receber usam Confirmar.
replaceAll(
  'if (!canManageTransfers) {\n            toast.error(\'Você não tem permissão para enviar transferências.\');',
  'if (!canConfirmTransfers) {\n            toast.error(\'Você não tem permissão para enviar transferências.\');',
  'guard enviar granular'
);

replaceAll(
  'if (!canManageTransfers) {\n            toast.error(\'Você não tem permissão para receber transferências.\');',
  'if (!canConfirmTransfers) {\n            toast.error(\'Você não tem permissão para receber transferências.\');',
  'guard receber granular'
);

// Cancelar usa Cancelar.
replaceAll(
  'if (!canManageTransfers) {\n            toast.error(\'Você não tem permissão para cancelar transferências.\');',
  'if (!canCancelTransfers) {\n            toast.error(\'Você não tem permissão para cancelar transferências.\');',
  'guard cancelar granular'
);

replaceAll(
  '{canManageTransfers && (',
  '{canConfirmTransfers && (',
  'restaurar ações confirmar padrão'
);

// O replace acima também pode trocar o botão cancelar em alguns estados; corrige especificamente o bloco de cancelar.
replaceOnce(
  `{canConfirmTransfers && (
                                <button
                                    type="button"
                                    onClick={handleCancelTransfer}`,
  `{canCancelTransfers && (
                                <button
                                    type="button"
                                    onClick={handleCancelTransfer}`,
  'cancelar usa canCancelTransfers',
  `{canCancelTransfers && (
                                <button
                                    type="button"
                                    onClick={handleCancelTransfer}`
);

replaceAll(
  "transfer.status === 'shipped' && canManageTransfers && (",
  "transfer.status === 'shipped' && canConfirmTransfers && (",
  'receber usa confirmar'
);

replaceAll(
  "{showReceiveForm && transfer.status === 'shipped' && canManageTransfers && (",
  "{showReceiveForm && transfer.status === 'shipped' && canConfirmTransfers && (",
  'formulário de recebimento usa confirmar'
);

replaceAll(
  'disabled={!canManageTransfers || actionLoading}',
  'disabled={!canConfirmTransfers || actionLoading}',
  'campos recebimento usam confirmar'
);

replaceAll(
  'disabled={!canManageTransfers || actionLoading || !hasDivergence}',
  'disabled={!canConfirmTransfers || actionLoading || !hasDivergence}',
  'campos divergência usam confirmar'
);

replaceOnce(
  `            {!canManageTransfers && transfer.status && ['draft', 'shipped'].includes(transfer.status) && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    Você pode visualizar esta transferência, mas não tem permissão para enviar, receber, cancelar ou tratar divergências.
                </p>
            )}`,
  `            {transfer.status === 'draft' && !canConfirmTransfers && !canCancelTransfers && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    Você pode visualizar esta transferência, mas não tem permissão para enviar ou cancelar.
                </p>
            )}

            {transfer.status === 'shipped' && !canConfirmTransfers && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    Você pode visualizar esta transferência, mas não tem permissão para receber ou tratar divergências.
                </p>
            )}`,
  'avisos granulares de leitura',
  `Você pode visualizar esta transferência, mas não tem permissão para receber ou tratar divergências.`
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[transfer-detail-granular-permissions] TransferDetailPage.tsx reparado com permissões granulares.');
} else {
  console.log('[transfer-detail-granular-permissions] Nenhuma alteração necessária; permissões granulares já parecem aplicadas.');
}
