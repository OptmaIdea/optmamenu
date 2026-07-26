#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx');
const rawSource = fs.readFileSync(target, 'utf8');
const usesCrlf = rawSource.includes('\r\n');
let source = rawSource.replace(/\r\n/g, '\n');
const before = source;

function replaceOnce(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) throw new Error(`Ponto de integração não encontrado: ${label}`);
  source = source.replace(search, replacement);
}

replaceOnce(
  "import { toast } from 'sonner';",
  "import { toast } from 'sonner';\nimport RewardImageLibrary from './RewardImageLibrary';\nimport { uploadRewardMediaAsset, type RewardMediaAsset } from '@/services/rewardMediaLibrary';",
  'imports da biblioteca',
);

replaceOnce(
  "    image_url?: string;\n    additional_cash_cost?: number;",
  "    image_url?: string;\n    media_asset_id?: string | null;\n    additional_cash_cost?: number;",
  'campo media_asset_id',
);

replaceOnce(
  "    isNew: boolean\n}) => {",
  "    isNew: boolean,\n    storeId: string\n}) => {",
  'prop storeId do formulário',
);

replaceOnce(
  "    const [saving, setSaving] = useState(false);",
  "    const [saving, setSaving] = useState(false);\n    const [libraryOpen, setLibraryOpen] = useState(false);",
  'estado da biblioteca no formulário',
);

replaceOnce(
  "                image_url: prodImage || prev.image_url // Use product image if available",
  "                image_url: prodImage || prev.image_url, // Use product image if available\n                media_asset_id: null",
  'limpeza de vínculo ao selecionar produto',
);

replaceOnce(
  "                     <div className=\"absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition flex items-center justify-center backdrop-blur-sm\">\n                         <label className=\"cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 shadow-lg\">",
  "                     <div className=\"absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition flex items-center justify-center gap-2 backdrop-blur-sm\">\n                         <button type=\"button\" onClick={() => setLibraryOpen(true)} className=\"bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 shadow-lg\">\n                             <ImageIcon size={16} /> Biblioteca\n                         </button>\n                         <label className=\"cursor-pointer bg-white text-gray-900 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-gray-50 transition transform hover:scale-105 shadow-lg\">",
  'botão da biblioteca no formulário',
);

replaceOnce(
  "             </div>\n         </div>\n     );\n });",
  "             </div>\n             <RewardImageLibrary\n                 storeId={storeId}\n                 open={libraryOpen}\n                 selectable\n                 selectedId={formData.media_asset_id}\n                 onClose={() => setLibraryOpen(false)}\n                 onSelect={(asset: RewardMediaAsset) => {\n                     setFormData(prev => ({ ...prev, image_url: asset.public_url, media_asset_id: asset.id }));\n                     setPreviewUrl(asset.public_url);\n                     setImageFile(null);\n                     setLibraryOpen(false);\n                 }}\n             />\n         </div>\n     );\n });",
  'modal da biblioteca no formulário',
);

replaceOnce(
  "    const [filterType, setFilterType] = useState<'all' | 'product' | 'discount' | 'gift'>('all');",
  "    const [filterType, setFilterType] = useState<'all' | 'product' | 'discount' | 'gift'>('all');\n    const [libraryOpen, setLibraryOpen] = useState(false);",
  'estado da biblioteca principal',
);

replaceOnce(
  "        // 1. Handle File Upload\n        if (imageFile) {\n            const uploadedUrl = await uploadRewardImage(imageFile, storeId);\n            if (uploadedUrl) {\n                finalImageUrl = uploadedUrl;\n            }\n        }",
  "        // 1. Todo upload próprio entra na biblioteca, com otimização e deduplicação.\n        if (imageFile) {\n            const { asset, reused } = await uploadRewardMediaAsset(storeId, imageFile, data.title || undefined);\n            finalImageUrl = asset.public_url;\n            data.media_asset_id = asset.id;\n            if (reused) toast.info('Imagem já existente na biblioteca; o arquivo foi reutilizado.');\n        }",
  'upload pela biblioteca',
);

replaceOnce(
  "            if (!finalImageUrl) {\n                finalImageUrl = DEFAULT_REWARD_IMAGE;\n            }",
  "            if (!finalImageUrl) {\n                finalImageUrl = DEFAULT_REWARD_IMAGE;\n                data.media_asset_id = null;\n            }",
  'fallback sem vínculo',
);

replaceOnce(
  "                products={products}\n                onCancel={() => setEditingId(null)}",
  "                products={products}\n                storeId={storeId}\n                onCancel={() => setEditingId(null)}",
  'storeId no RewardForm',
);

replaceOnce(
  "                    <button\n                        onClick={handleAddReward}",
  "                    <button\n                        onClick={() => setLibraryOpen(true)}\n                        className=\"border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition whitespace-nowrap text-sm\"\n                    >\n                        <ImageIcon size={16} /> Biblioteca\n                    </button>\n                    <button\n                        onClick={handleAddReward}",
  'botão principal da biblioteca',
);

replaceOnce(
  "            {loading ? (",
  "            <RewardImageLibrary storeId={storeId} open={libraryOpen} onClose={() => setLibraryOpen(false)} />\n\n            {loading ? (",
  'modal principal da biblioteca',
);

if (source === before) {
  console.log('Biblioteca de imagens já integrada.');
  process.exit(0);
}

const output = usesCrlf ? source.replace(/\n/g, '\r\n') : source;
fs.writeFileSync(target, output, 'utf8');
console.log('Biblioteca de imagens integrada em RewardsConfig.tsx.');
