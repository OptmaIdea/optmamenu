#!/usr/bin/env node
/*
 * Aplica ajustes conservadores de UX de permissões no Livro Diário.
 *
 * Uso:
 *   node scripts/apply_cashbook_readonly_ux.cjs
 *
 * O script troca alerts de permissão por toast.error e oculta botões de edição
 * quando o usuário não tem permissão de lançar/alterar no Livro Diário.
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  process.cwd(),
  'src/pages/private/admin/financial/cashbook/CashbookPage.tsx'
);

function fail(message) {
  console.error(`\n[cashbook-readonly-ux] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[cashbook-readonly-ux] Aviso: ${message}`);
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

replaceAll(
  "alert('Você não tem permissão para lançar no Livro Diário.');",
  "toast.error('Você não tem permissão para lançar no Livro Diário.');",
  'permissão para lançar'
);

replaceAll(
  "alert('Você não tem permissão para cancelar lançamentos do Livro Diário.');",
  "toast.error('Você não tem permissão para cancelar lançamentos do Livro Diário.');",
  'permissão para cancelar'
);

replaceAll(
  "alert('Erro ao cancelar lançamento.');",
  "toast.error('Erro ao cancelar lançamento.');",
  'erro ao cancelar'
);

replaceOnce(
  `                                                    <button
                                                        type="button"
                                                        onClick={() => openEditForm(entry)}
                                                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                        title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                        aria-label={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                    >
                                                        <Edit2 size={15} />
                                                    </button>`,
  `                                                    {canCreateCashbookEntry && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditForm(entry)}
                                                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                            title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                            aria-label={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                        >
                                                            <Edit2 size={15} />
                                                        </button>
                                                    )}`,
  'ocultar editar no modo livro',
  '{canCreateCashbookEntry && (\n                                                        <button\n                                                            type="button"\n                                                            onClick={() => openEditForm(entry)}'
);

replaceOnce(
  `                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openEditForm(entry)}
                                                                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                                            title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                                        >
                                                                            <Edit2 size={13} />
                                                                        </button>`,
  `                                                                        {canCreateCashbookEntry && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openEditForm(entry)}
                                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
                                                                                title={entry.type === 'sale' ? 'Editar descrição' : 'Editar lançamento'}
                                                                            >
                                                                                <Edit2 size={13} />
                                                                            </button>
                                                                        )}`,
  'ocultar editar no modo extrato',
  '{canCreateCashbookEntry && (\n                                                                            <button\n                                                                                type="button"\n                                                                                onClick={() => openEditForm(entry)}'
);

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[cashbook-readonly-ux] CashbookPage.tsx atualizado com UX de leitura.');
} else {
  console.log('[cashbook-readonly-ux] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
