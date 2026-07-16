#!/usr/bin/env node
/*
 * Aplica ajustes conservadores de UX de modo leitura no painel de fechamento do caixa.
 *
 * Uso:
 *   node scripts/apply_day_closing_readonly_ux.cjs
 *
 * O script desabilita campos de conferência quando o usuário não pode salvar/fechar caixa,
 * mantendo visualização, histórico e detalhes disponíveis.
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx'
);

function fail(message) {
  console.error(`\n[day-closing-readonly-ux] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[day-closing-readonly-ux] Aviso: ${message}`);
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

replaceAll(
  'disabled={!value && !usingDetails}',
  'disabled={!canClose || (!value && !usingDetails)}',
  'desabilitar limpar conferência externa'
);

replaceAll(
  'disabled={usingDetails}',
  'disabled={!canClose || usingDetails}',
  'desabilitar total externo simples'
);

replaceAll(
  'onClick={() => addExternalDetail(method)}\n            className=',
  'onClick={() => addExternalDetail(method)}\n            disabled={!canClose}\n            className=',
  'desabilitar botão detalhar externo'
);

replaceAll(
  'className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50 dark:border-teal-900/60 dark:bg-gray-900 dark:text-teal-300"',
  'className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-teal-900/60 dark:bg-gray-900 dark:text-teal-300"',
  'estilo botão detalhar externo desabilitado'
);

replaceAll(
  'onChange={(event) => updateExternalDetail(method, item.id, \'label\', event.target.value)}\n                  placeholder="Ex.: Infinite, Bradesco pessoal"',
  'onChange={(event) => updateExternalDetail(method, item.id, \'label\', event.target.value)}\n                  disabled={!canClose}\n                  placeholder="Ex.: Infinite, Bradesco pessoal"',
  'desabilitar descrição detalhamento externo'
);

replaceAll(
  'onChange={(event) => updateExternalDetail(method, item.id, \'amount\', event.target.value)}\n                  placeholder="0,00"',
  'onChange={(event) => updateExternalDetail(method, item.id, \'amount\', event.target.value)}\n                  disabled={!canClose}\n                  placeholder="0,00"',
  'desabilitar valor detalhamento externo'
);

replaceAll(
  'onClick={() => removeExternalDetail(method, item.id)}\n                  className=',
  'onClick={() => removeExternalDetail(method, item.id)}\n                  disabled={!canClose}\n                  className=',
  'desabilitar remover detalhamento externo'
);

replaceAll(
  'className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 dark:border-gray-700"',
  'className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700"',
  'estilo remover detalhamento externo desabilitado'
);

replaceAll(
  'value={quantity || \'\'} onChange={(event) => updateCount(denomination, event.target.value)} className=',
  'value={quantity || \'\'} onChange={(event) => updateCount(denomination, event.target.value)} disabled={!canClose} className=',
  'desabilitar quantidade dinheiro'
);

replaceAll(
  'onClick={() => setCounts((current) => ({ ...current, [String(denomination)]: 0 }))} disabled={!quantity}',
  'onClick={() => setCounts((current) => ({ ...current, [String(denomination)]: 0 }))} disabled={!canClose || !quantity}',
  'desabilitar limpar quantidade dinheiro'
);

replaceAll(
  'onClick={() => setCounts({})} disabled={countedCashTotal <= 0}',
  'onClick={() => setCounts({})} disabled={!canClose || countedCashTotal <= 0}',
  'desabilitar limpar total dinheiro'
);

replaceAll(
  '<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3}',
  '<textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canClose} rows={3}',
  'desabilitar observação fechamento'
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[day-closing-readonly-ux] DayClosingPanel.tsx atualizado com UX de leitura.');
} else {
  console.log('[day-closing-readonly-ux] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
