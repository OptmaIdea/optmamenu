#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const rewardsPath = path.join(
  projectRoot,
  'src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx',
);

const legacyRewardUrl =
  'https://lgkkfmqzaorrutuoqeax.supabase.co/storage/v1/object/public/reward-images/0abba741-0f77-4783-8cf8-58811cf7343b/logo-gelinhares.png';

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) {
    throw new Error(`Padrão não encontrado para ${label}. O arquivo pode ter mudado; revise manualmente.`);
  }
  return source.replace(search, replacement);
}

function main() {
  if (!fs.existsSync(rewardsPath)) {
    throw new Error(`Arquivo não encontrado: ${rewardsPath}`);
  }

  let source = fs.readFileSync(rewardsPath, 'utf8');
  const original = source;

  source = replaceRequired(
    source,
    "import { toast } from 'sonner';",
    "import { toast } from 'sonner';\nimport { applyImageFallback, imageOrFallback, IMAGE_FALLBACKS } from '@/lib/imageFallbacks';",
    'importação dos fallbacks',
  );

  source = source.replace(
    `const DEFAULT_REWARD_IMAGE = '${legacyRewardUrl}';`,
    "const DEFAULT_REWARD_IMAGE = IMAGE_FALLBACKS.reward;",
  );

  source = source.replace(
    "        if (imageUrl === DEFAULT_REWARD_IMAGE) return;",
    "        if (imageUrl === DEFAULT_REWARD_IMAGE || imageUrl.startsWith('/fallbacks/')) return;",
  );

  source = replaceRequired(
    source,
    '<img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover" />',
    '<img src={imageOrFallback(reward.image_url, \'reward\')} onError={(event) => applyImageFallback(event, \'reward\')} alt={reward.title} className="w-full h-full object-cover" />',
    'imagem da linha de recompensa',
  );

  source = source.replace(
    'const [previewUrl, setPreviewUrl] = useState<string | undefined>(initialData.image_url);',
    "const [previewUrl, setPreviewUrl] = useState<string>(imageOrFallback(initialData.image_url, 'reward'));",
  );

  source = source.replace(
    /<img src=\{previewUrl\} alt=\{formData\.title\} className=/g,
    "<img src={imageOrFallback(previewUrl, 'reward')} onError={(event) => applyImageFallback(event, 'reward')} alt={formData.title} className=",
  );

  source = source.replaceAll(legacyRewardUrl, IMAGE_FALLBACKS_REPLACEMENT());

  if (source.includes(legacyRewardUrl)) {
    throw new Error('A URL legada de recompensa ainda permanece no arquivo.');
  }

  if (!source.includes("applyImageFallback(event, 'reward')")) {
    throw new Error('O fallback automático não foi integrado às imagens.');
  }

  if (source === original) {
    console.log('Fallbacks de imagem já estavam integrados; nenhuma alteração necessária.');
    return;
  }

  fs.writeFileSync(rewardsPath, source, 'utf8');
  console.log(`Fallbacks locais integrados em: ${rewardsPath}`);
}

function IMAGE_FALLBACKS_REPLACEMENT() {
  return '/fallbacks/reward.svg';
}

try {
  main();
} catch (error) {
  console.error('\nFalha ao integrar fallbacks locais:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
