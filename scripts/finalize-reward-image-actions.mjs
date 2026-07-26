#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx');
const raw = fs.readFileSync(target, 'utf8');
const crlf = raw.includes('\r\n');
let source = raw.replace(/\r\n/g, '\n');
const original = source;

const replaceRequired = (pattern, replacement, label, doneToken) => {
  if (doneToken && source.includes(doneToken)) return;
  if (!pattern.test(source)) throw new Error(`Ponto não encontrado: ${label}`);
  source = source.replace(pattern, replacement);
};

replaceRequired(/image_url\?: string;/, 'image_url?: string | null;', 'tipo image_url', 'image_url?: string | null;');

replaceRequired(
  /(const handleImageSelect = \(e: React\.ChangeEvent<HTMLInputElement>\) => \{[\s\S]*?\n    \};)/,
  `$1

    const handleRemoveImage = () => {
        setImageFile(null);
        setFormData(prev => ({ ...prev, image_url: null, media_asset_id: null }));
        setPreviewUrl(IMAGE_FALLBACKS.reward);
    };`,
  'ação remover imagem',
  'const handleRemoveImage = () =>',
);

replaceRequired(
  /\s*<div className="absolute inset-0 bg-black\/40 opacity-0 group-hover\/image:opacity-100 transition flex items-center justify-center gap-2 backdrop-blur-sm">[\s\S]*?<\/div>\n\s*<\/div>/,
  `
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <button type="button" onClick={() => setLibraryOpen(true)} className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
                        <ImageIcon size={16} /> Usar da biblioteca
                    </button>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-green px-3 py-2 text-sm font-bold text-white hover:bg-green-600">
                        <Upload size={16} /> Enviar nova
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageSelect} />
                    </label>
                    <button type="button" onClick={handleRemoveImage} disabled={!formData.image_url && !imageFile} className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:hover:bg-red-950/30">
                        <Trash2 size={16} /> Remover imagem
                    </button>
                </div>`,
  'ações visíveis de imagem',
  'Usar da biblioteca',
);

replaceRequired(
  /\/\/ 2\. Logic for Default\/Product Image if NO file uploaded[\s\S]*?\n        \}/,
  `// 2. Sem imagem própria, persiste null; o fallback é apenas visual.
        if (!imageFile && !finalImageUrl) {
            finalImageUrl = null;
            data.media_asset_id = null;
        }`,
  'persistência de fallback visual',
  'o fallback é apenas visual',
);

const required = [
  'image_url?: string | null;',
  'const handleRemoveImage = () =>',
  'Usar da biblioteca',
  'Enviar nova',
  'Remover imagem',
  'finalImageUrl = null;',
];
const missing = required.filter((token) => !source.includes(token));
if (missing.length) throw new Error(`Reparo incompleto; nada foi salvo. Ausentes: ${missing.join(', ')}`);

if (source === original) {
  console.log('Ações de imagem já finalizadas.');
  process.exit(0);
}

fs.writeFileSync(target, crlf ? source.replace(/\n/g, '\r\n') : source, 'utf8');
console.log('Ações de imagem de prêmios finalizadas e validadas.');
