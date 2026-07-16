#!/usr/bin/env node
/*
 * Aplica ajustes conservadores de UX de modo leitura em Transferências.
 *
 * Uso:
 *   node scripts/apply_transfers_readonly_ux.cjs
 *
 * O script mantém listagem, filtros, detalhes e exportação disponíveis,
 * mas desabilita controles de criação de rascunhos quando o usuário não
 * possui permissão para criar/gerenciar transferências.
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/products/inventory/TransfersPage.tsx'
);

function fail(message) {
  console.error(`\n[transfers-readonly-ux] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[transfers-readonly-ux] Aviso: ${message}`);
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

// Card de prefill vindo da Vida do Produto / sugestão gerencial.
replaceOnce(
  `                    value={draftQty}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraftQty(Number.isFinite(value) && value > 0 ? value : 1);
                    }}
                    className=`,
  `                    value={draftQty}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraftQty(Number.isFinite(value) && value > 0 ? value : 1);
                    }}
                    disabled={!canCreateTransfers || creatingDraft}
                    className=`,
  'desabilitar quantidade do prefill',
  'disabled={!canCreateTransfers || creatingDraft}\n                    className='
);

replaceOnce(
  '                disabled={creatingDraft}\n                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"',
  '                disabled={!canCreateTransfers || creatingDraft}\n                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"',
  'desabilitar criar rascunho do prefill',
  'disabled={!canCreateTransfers || creatingDraft}\n                className="inline-flex items-center gap-2 rounded-xl bg-blue-600'
);

replaceOnce(
  `              </div>
            </div>
          </div>
        </div>
      )}`,
  `              </div>
            </div>
            {!canCreateTransfers && (
              <p className="mt-3 rounded-xl border border-blue-200 bg-white/70 p-3 text-xs font-bold text-blue-800 dark:border-blue-900/50 dark:bg-gray-900/50 dark:text-blue-200">
                Você pode visualizar a sugestão, mas não tem permissão para criar rascunhos de transferência.
              </p>
            )}
          </div>
        </div>
      )}`,
  'aviso modo leitura no prefill',
  'Você pode visualizar a sugestão, mas não tem permissão para criar rascunhos de transferência.'
);

// Sugestões gerenciais em lote.
replaceOnce(
  '                        disabled={creatingBatchDraft || selectedCount === 0}\n                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"',
  '                        disabled={!canCreateTransfers || creatingBatchDraft || selectedCount === 0}\n                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"',
  'desabilitar criar rascunho em lote',
  'disabled={!canCreateTransfers || creatingBatchDraft || selectedCount === 0}'
);

replaceAll(
  '                              <input\n                                type="checkbox"\n                                checked={allSelected}\n                                onChange={() => toggleGroupSelection(group.items)}',
  '                              <input\n                                type="checkbox"\n                                checked={allSelected}\n                                onChange={() => toggleGroupSelection(group.items)}\n                                disabled={!canCreateTransfers || creatingBatchDraft}',
  'desabilitar seleção de grupo de sugestões'
);

replaceAll(
  '                                    <input\n                                      type="checkbox"\n                                      checked={selected}\n                                      onChange={() => toggleSuggestion(suggestion)}',
  '                                    <input\n                                      type="checkbox"\n                                      checked={selected}\n                                      onChange={() => toggleSuggestion(suggestion)}\n                                      disabled={!canCreateTransfers || creatingBatchDraft}',
  'desabilitar seleção de sugestão'
);

replaceOnce(
  '                                    disabled={!selected}\n                                    className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"',
  '                                    disabled={!canCreateTransfers || creatingBatchDraft || !selected}\n                                    className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"',
  'desabilitar quantidade de sugestão',
  'disabled={!canCreateTransfers || creatingBatchDraft || !selected}'
);

replaceOnce(
  `          {showSuggestionsPanel && (
            <div className="mt-4 space-y-4">`,
  `          {showSuggestionsPanel && (
            <div className="mt-4 space-y-4">
              {!canCreateTransfers && (
                <p className="rounded-xl border border-emerald-200 bg-white/70 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-gray-900/50 dark:text-emerald-200">
                  Você pode visualizar as sugestões, mas não tem permissão para criar rascunhos de transferência.
                </p>
              )}`,
  'aviso modo leitura nas sugestões',
  'Você pode visualizar as sugestões, mas não tem permissão para criar rascunhos de transferência.'
);

// Blindagem adicional no modal manual, mesmo que o botão de abrir já fique oculto.
replaceOnce(
  '                      onChange={(event) => setManualSourceLocationId(event.target.value)}\n                      className=',
  '                      onChange={(event) => setManualSourceLocationId(event.target.value)}\n                      disabled={!canCreateTransfers || creatingManualBatchDraft}\n                      className=',
  'desabilitar origem manual'
);

replaceOnce(
  '                      onChange={(event) => setManualDestinationLocationId(event.target.value)}\n                      className=',
  '                      onChange={(event) => setManualDestinationLocationId(event.target.value)}\n                      disabled={!canCreateTransfers || creatingManualBatchDraft}\n                      className=',
  'desabilitar destino manual'
);

replaceOnce(
  '                      onClick={addManualBatchItem}\n                      className=',
  '                      onClick={addManualBatchItem}\n                      disabled={!canCreateTransfers || creatingManualBatchDraft}\n                      className=',
  'desabilitar adicionar item manual'
);

replaceAll(
  '                              onChange={(event) => updateManualBatchItem(index, { productId: event.target.value })}\n                              className=',
  '                              onChange={(event) => updateManualBatchItem(index, { productId: event.target.value })}\n                              disabled={!canCreateTransfers || creatingManualBatchDraft}\n                              className=',
  'desabilitar produto manual'
);

replaceAll(
  `                              onChange={(event) => {
                                const value = Number(event.target.value);
                                updateManualBatchItem(index, { quantity: Number.isFinite(value) && value > 0 ? value : 1 });
                              }}
                              className=`,
  `                              onChange={(event) => {
                                const value = Number(event.target.value);
                                updateManualBatchItem(index, { quantity: Number.isFinite(value) && value > 0 ? value : 1 });
                              }}
                              disabled={!canCreateTransfers || creatingManualBatchDraft}
                              className=`,
  'desabilitar quantidade manual'
);

replaceAll(
  '                            onClick={() => removeManualBatchItem(index)}\n                            className=',
  '                            onClick={() => removeManualBatchItem(index)}\n                            disabled={!canCreateTransfers || creatingManualBatchDraft}\n                            className=',
  'desabilitar remover item manual'
);

replaceOnce(
  '                    onChange={(event) => setManualBatchNotes(event.target.value)}\n                    rows={3}',
  '                    onChange={(event) => setManualBatchNotes(event.target.value)}\n                    disabled={!canCreateTransfers || creatingManualBatchDraft}\n                    rows={3}',
  'desabilitar observação manual'
);

replaceOnce(
  '                    disabled={creatingManualBatchDraft || loadingManualInventory}',
  '                    disabled={!canCreateTransfers || creatingManualBatchDraft || loadingManualInventory}',
  'desabilitar criar rascunho manual',
  'disabled={!canCreateTransfers || creatingManualBatchDraft || loadingManualInventory}'
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[transfers-readonly-ux] TransfersPage.tsx atualizado com UX de leitura.');
} else {
  console.log('[transfers-readonly-ux] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
