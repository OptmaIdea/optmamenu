#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx');
const rawSource = fs.readFileSync(target, 'utf8');
const usesCrlf = rawSource.includes('\r\n');
const original = rawSource.replace(/\r\n/g, '\n');
let source = original;

function replaceRegex(pattern, replacement, label, integratedToken) {
  if (integratedToken && source.includes(integratedToken)) return;
  if (!pattern.test(source)) {
    throw new Error(`Ponto de integração não encontrado: ${label}`);
  }
  source = source.replace(pattern, replacement);
}

replaceRegex(
  /import \{ toast \} from 'sonner';/,
  "import { toast } from 'sonner';\nimport RewardImageLibrary from './RewardImageLibrary';\nimport { uploadRewardMediaAsset, type RewardMediaAsset } from '@/services/rewardMediaLibrary';",
  'imports da biblioteca',
  "import RewardImageLibrary from './RewardImageLibrary';",
);

replaceRegex(
  /(\s+image_url\?: string;)/,
  '$1\n    media_asset_id?: string | null;',
  'campo media_asset_id',
  'media_asset_id?: string | null;',
);

replaceRegex(
  /(\s+isNew: boolean)(\s*\n\s*\}\) => \{)/,
  '$1,\n    storeId: string$2',
  'prop storeId do formulário',
  'storeId: string\n}) => {',
);

replaceRegex(
  /(const \[saving, setSaving\] = useState\(false\);)/,
  '$1\n    const [libraryOpen, setLibraryOpen] = useState(false);',
  'estado da biblioteca no formulário',
  'const [libraryOpen, setLibraryOpen] = useState(false);',
);

replaceRegex(
  /(image_url:\s*prodImage \|\| prev\.image_url)(\s*\/\/ Use product image if available)?/,
  '$1, // Use product image if available\n                media_asset_id: null',
  'limpeza de vínculo ao selecionar produto',
  'media_asset_id: null',
);

replaceRegex(
  /<div className="absolute inset-0 bg-black\/40 opacity-0 group-hover\/image:opacity-100 transition flex items-center justify-center backdrop-blur-sm">\s*<label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 shadow-lg">/,
  `<div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition flex items-center justify-center gap-2 backdrop-blur-sm">
                         <button type="button" onClick={() => setLibraryOpen(true)} className="bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 shadow-lg">
                             <ImageIcon size={16} /> Biblioteca
                         </button>
                         <label className="cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 shadow-lg">`,
  'botão da biblioteca no formulário',
  '<ImageIcon size={16} /> Biblioteca',
);

if (!source.includes('selectedId={formData.media_asset_id}')) {
  const marker = '// --- MAIN Rewards Component ---';
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error('Ponto de integração não encontrado: marcador do componente principal');

  const beforeMarker = source.slice(0, markerIndex);
  const afterMarker = source.slice(markerIndex);
  const formClosingPattern = /(\n\s*<\/div>\s*\n\s*\);\s*\n\}\);\s*\n\s*)$/;

  if (!formClosingPattern.test(beforeMarker)) {
    throw new Error('Ponto de integração não encontrado: fechamento estrutural do RewardForm');
  }

  const modal = `
            <RewardImageLibrary
                storeId={storeId}
                open={libraryOpen}
                selectable
                selectedId={formData.media_asset_id}
                onClose={() => setLibraryOpen(false)}
                onSelect={(asset: RewardMediaAsset) => {
                    setFormData(prev => ({ ...prev, image_url: asset.public_url, media_asset_id: asset.id }));
                    setPreviewUrl(asset.public_url);
                    setImageFile(null);
                    setLibraryOpen(false);
                }}
            />
`;

  source = beforeMarker.replace(
    formClosingPattern,
    `${modal}        </div>\n    );\n});\n\n\n`,
  ) + afterMarker;
}

replaceRegex(
  /(const \[filterType, setFilterType\] = useState<'all' \| 'product' \| 'discount' \| 'gift'>\('all'\);)/,
  '$1\n    const [libraryOpen, setLibraryOpen] = useState(false);',
  'estado da biblioteca principal',
  "const [filterType, setFilterType] = useState<'all' | 'product' | 'discount' | 'gift'>('all');\n    const [libraryOpen, setLibraryOpen] = useState(false);",
);

replaceRegex(
  /\/\/ 1\. Handle File Upload\s*\n\s*if \(imageFile\) \{\s*\n\s*const uploadedUrl = await uploadRewardImage\(imageFile, storeId\);\s*\n\s*if \(uploadedUrl\) \{\s*\n\s*finalImageUrl = uploadedUrl;\s*\n\s*\}\s*\n\s*\}/,
  `// 1. Todo upload próprio entra na biblioteca, com otimização e deduplicação.
        if (imageFile) {
            const { asset, reused } = await uploadRewardMediaAsset(storeId, imageFile, data.title || undefined);
            finalImageUrl = asset.public_url;
            data.media_asset_id = asset.id;
            if (reused) toast.info('Imagem já existente na biblioteca; o arquivo foi reutilizado.');
        }`,
  'upload pela biblioteca',
  'const { asset, reused } = await uploadRewardMediaAsset',
);

replaceRegex(
  /if \(!finalImageUrl\) \{\s*\n\s*finalImageUrl = DEFAULT_REWARD_IMAGE;\s*\n\s*\}/,
  `if (!finalImageUrl) {
                finalImageUrl = DEFAULT_REWARD_IMAGE;
                data.media_asset_id = null;
            }`,
  'fallback sem vínculo',
  'finalImageUrl = DEFAULT_REWARD_IMAGE;\n                data.media_asset_id = null;',
);

replaceRegex(
  /(products=\{products\}\s*\n)(\s*onCancel=\{\(\) => setEditingId\(null\)\})/,
  '$1                storeId={storeId}\n$2',
  'storeId no RewardForm',
  'products={products}\n                storeId={storeId}',
);

replaceRegex(
  /(\s*)<button\s*\n\s*onClick=\{handleAddReward\}/,
  `$1<button
$1    onClick={() => setLibraryOpen(true)}
$1    className="border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition whitespace-nowrap text-sm"
$1>
$1    <ImageIcon size={16} /> Biblioteca
$1</button>
$1<button
$1    onClick={handleAddReward}`,
  'botão principal da biblioteca',
  'onClick={() => setLibraryOpen(true)}',
);

replaceRegex(
  /(\s*)\{loading \? \(/,
  '$1<RewardImageLibrary storeId={storeId} open={libraryOpen} onClose={() => setLibraryOpen(false)} />\n\n$1{loading ? (',
  'modal principal da biblioteca',
  '<RewardImageLibrary storeId={storeId} open={libraryOpen} onClose={() => setLibraryOpen(false)} />',
);

const requiredTokens = [
  "import RewardImageLibrary from './RewardImageLibrary';",
  'media_asset_id?: string | null;',
  'selectedId={formData.media_asset_id}',
  'const { asset, reused } = await uploadRewardMediaAsset',
  'storeId={storeId}',
  '<ImageIcon size={16} /> Biblioteca',
  '<RewardImageLibrary storeId={storeId} open={libraryOpen} onClose={() => setLibraryOpen(false)} />',
];

const missing = requiredTokens.filter((token) => !source.includes(token));
if (missing.length > 0) {
  throw new Error(`Integração incompleta; arquivo não foi gravado. Ausentes: ${missing.join(', ')}`);
}

if (source === original) {
  console.log('Biblioteca de imagens já integrada.');
  process.exit(0);
}

const output = usesCrlf ? source.replace(/\n/g, '\r\n') : source;
fs.writeFileSync(target, output, 'utf8');
console.log('Biblioteca de imagens integrada e validada em RewardsConfig.tsx.');
