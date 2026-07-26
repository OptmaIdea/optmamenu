import fs from 'node:fs';

const target = 'src/pages/private/admin/settings/onlineOrders/OnlineOrderSettingsPage.tsx';
const source = fs.readFileSync(target, 'utf8');

const saveStart = `    async function handleSave() {\n        if (!storeId) return;\n        if (disabled) {\n            toast.error('Você não tem permissão para executar esta alteração.');\n            return;\n        }\n\n        try {`;

const saveReplacement = `    async function handleSave() {\n        if (!storeId) return;\n        if (disabled) {\n            toast.error('Você não tem permissão para executar esta alteração.');\n            return;\n        }\n\n        const normalizedSlug = slug.trim().toLowerCase();\n        const currentSlug = (store?.slug || '').trim().toLowerCase();\n        if (currentSlug && normalizedSlug !== currentSlug) {\n            const confirmed = window.confirm(\n                \`Você está alterando o endereço público da loja.\\n\\nAtual: /s/\${currentSlug}\\nNovo: /s/\${normalizedSlug}\\n\\nLinks e QR Codes antigos continuarão levando para esta mesma loja, mas novos materiais devem usar o endereço novo. Deseja continuar?\`\n            );\n            if (!confirmed) return;\n        }\n\n        try {`;

const slugField = `<div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Slug público</label><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase())} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder="gelinharessjn" disabled={disabled} /><p className="mt-1 text-xs text-gray-500">Link: {publicUrl || 'configure um slug'}</p></div>`;

const slugFieldReplacement = `<div><label className="text-sm font-bold text-gray-700 dark:text-gray-200">Slug público</label><input value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} minLength={3} maxLength={60} className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder="gelinharessjn" disabled={disabled} /><p className="mt-1 text-xs text-gray-500">Link: {publicUrl || 'configure um slug'}</p>{store?.slug && slug.trim().toLowerCase() !== store.slug.trim().toLowerCase() && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-800">A mudança preservará o endereço antigo como alias protegido, mas novos QR Codes e materiais devem usar o novo link.</p>}</div>`;

const normalizedPayload = `                slug,\n                minimum_order_value:`;
const normalizedPayloadReplacement = `                slug: normalizedSlug,\n                minimum_order_value:`;

const checks = [
  ['handleSave', saveStart],
  ['slug field', slugField],
  ['normalized payload', normalizedPayload],
];

for (const [label, needle] of checks) {
  if (!source.includes(needle)) {
    throw new Error(`Integração abortada: trecho esperado não encontrado (${label}). Nenhum arquivo foi alterado.`);
  }
}

let output = source
  .replace(saveStart, saveReplacement)
  .replace(slugField, slugFieldReplacement)
  .replace(normalizedPayload, normalizedPayloadReplacement);

if (output === source) {
  throw new Error('Integração abortada: nenhuma alteração foi produzida.');
}

fs.writeFileSync(target, output, 'utf8');
console.log('Governança visual do slug integrada e validada em OnlineOrderSettingsPage.tsx.');
