import fs from 'node:fs';

const target = 'src/pages/private/admin/customers/CustomerEditPage.tsx';
const original = fs.readFileSync(target, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
let source = original.replace(/\r\n/g, '\n');

const alreadyIntegrated =
  !source.includes("        if (isProtected) {\n            toast.error('Este cliente foi criado pelo canal público e não pode ter dados pessoais editados pela administração.');\n            return;\n        }\n") &&
  source.includes('disabled={isProtected}') &&
  source.includes("{isProtected ? 'Salvar campos internos' : 'Salvar alterações'}");

if (alreadyIntegrated) {
  console.log('Edição segura de clientes protegidos já está integrada em CustomerEditPage.tsx.');
  process.exit(0);
}

const submitBlock = `        if (isProtected) {
            toast.error('Este cliente foi criado pelo canal público e não pode ter dados pessoais editados pela administração.');
            return;
        }

`;

const marketingInput = `                            <input
                                type="checkbox"
                                checked={marketingConsent}
                                onChange={(event) => setMarketingConsent(event.target.checked)}
                                className="h-5 w-5"
                            />`;

const marketingInputReplacement = `                            <input
                                type="checkbox"
                                checked={marketingConsent}
                                onChange={(event) => setMarketingConsent(event.target.checked)}
                                disabled={isProtected}
                                title={isProtected ? 'O consentimento de marketing pertence ao cliente e não pode ser concedido pela administração.' : undefined}
                                className="h-5 w-5 disabled:cursor-not-allowed disabled:opacity-50"
                            />`;

const marketingDescription = `                                    Usado futuramente para campanhas.`;
const marketingDescriptionReplacement = `                                    {isProtected
                                        ? 'Consentimento preservado: somente o cliente pode conceder autorização para campanhas.'
                                        : 'Usado futuramente para campanhas.'}`;

const buttonBlock = `                    {canManageCustomers && !isProtected ? (
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Salvar alterações
                        </button>
                    ) : (
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                            {!canManageCustomers
                                ? 'Você não tem permissão para salvar alterações.'
                                : 'Dados pessoais protegidos. Apenas campos internos podem ser alterados.'}
                        </p>
                    )}`;

const buttonReplacement = `                    {canManageCustomers ? (
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            {isProtected ? 'Salvar campos internos' : 'Salvar alterações'}
                        </button>
                    ) : (
                        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                            Você não tem permissão para salvar alterações.
                        </p>
                    )}`;

const checks = [
  ['bloqueio total no submit', submitBlock],
  ['checkbox de marketing', marketingInput],
  ['descrição de marketing', marketingDescription],
  ['bloco do botão salvar', buttonBlock],
];

for (const [label, needle] of checks) {
  if (!source.includes(needle)) {
    throw new Error(`Integração abortada: trecho esperado não encontrado (${label}). Nenhum arquivo foi alterado.`);
  }
}

source = source
  .replace(submitBlock, '')
  .replace(marketingInput, marketingInputReplacement)
  .replace(marketingDescription, marketingDescriptionReplacement)
  .replace(buttonBlock, buttonReplacement);

if (source === original.replace(/\r\n/g, '\n')) {
  throw new Error('Integração abortada: nenhuma alteração foi produzida.');
}

fs.writeFileSync(target, source.replace(/\n/g, eol), 'utf8');
console.log('Edição segura de clientes protegidos integrada e validada em CustomerEditPage.tsx.');
