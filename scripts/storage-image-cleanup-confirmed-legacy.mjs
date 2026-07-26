#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reportRoot = path.join(projectRoot, 'reports', 'storage-images');
const rewardsSourcePath = path.join(
  projectRoot,
  'src/pages/private/admin/commercial/loyalty/settings/RewardsConfig.tsx',
);

const legacyRewardUrl =
  'https://lgkkfmqzaorrutuoqeax.supabase.co/storage/v1/object/public/reward-images/0abba741-0f77-4783-8cf8-58811cf7343b/logo-gelinhares.png';

const targets = [
  {
    label: 'Fallback antigo de produto',
    bucket: 'products',
    objectPath: 'imagem-nao-disponvel-fallback-gelinhares.png',
  },
  {
    label: 'Cópia antiga da imagem de categoria',
    bucket: 'products',
    objectPath:
      '0abba741-0f77-4783-8cf8-58811cf7343b/categories/f255555c-ea2c-4200-8702-d4a2f667b388/1784857159543-efe1881b-74e7-4c17-9b7e-1942c4f74229.webp',
  },
  {
    label: 'Fallback antigo de recompensa',
    bucket: 'reward-images',
    objectPath: '0abba741-0f77-4783-8cf8-58811cf7343b/logo-gelinhares.png',
  },
  {
    label: 'Logo JPG legado 1',
    bucket: 'logos',
    objectPath: 'store-logos/0.5233076839757693.jpg',
  },
  {
    label: 'Logo JPG legado 2',
    bucket: 'logos',
    objectPath: 'store-logos/0.9271585533919884.jpg',
  },
];

const protectedAssets = [
  {
    bucket: 'logos',
    objectPath: 'store-assets/OptmaMenuLogo.webp',
    reason: 'Ativo estrutural do OptmaMenu referenciado diretamente pelo frontend e templates.',
  },
];

function loadLocalEnv() {
  for (const filename of ['.env.local', '.env', '.env.development.local']) {
    const fullPath = path.join(projectRoot, filename);
    if (!fs.existsSync(fullPath)) continue;
    for (const rawLine of fs.readFileSync(fullPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const separator = line.indexOf('=');
      if (separator <= 0) continue;
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function assertFrontendReady() {
  for (const relativePath of [
    'public/fallbacks/product.svg',
    'public/fallbacks/reward.svg',
    'public/fallbacks/store.svg',
    'src/lib/imageFallbacks.ts',
  ]) {
    if (!fs.existsSync(path.join(projectRoot, relativePath))) {
      throw new Error(`Fallback obrigatório ausente: ${relativePath}`);
    }
  }

  if (!fs.existsSync(rewardsSourcePath)) {
    throw new Error('RewardsConfig.tsx não encontrado.');
  }

  const source = fs.readFileSync(rewardsSourcePath, 'utf8');
  if (source.includes(legacyRewardUrl)) {
    throw new Error('RewardsConfig.tsx ainda referencia o fallback PNG legado. Execute npm run images:integrate-fallbacks e valide o build.');
  }
  if (!source.includes("IMAGE_FALLBACKS.reward") || !source.includes("applyImageFallback(event, 'reward')")) {
    throw new Error('Integração do fallback local de recompensa não foi confirmada no código.');
  }
}

async function objectExists(supabase, bucket, objectPath) {
  const folder = objectPath.includes('/') ? objectPath.slice(0, objectPath.lastIndexOf('/')) : '';
  const filename = objectPath.includes('/') ? objectPath.slice(objectPath.lastIndexOf('/') + 1) : objectPath;
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 1000,
    search: filename,
  });
  if (error) throw error;
  return (data || []).some((item) => item.name === filename);
}

async function main() {
  loadLocalEnv();
  assertFrontendReady();

  const execute = process.argv.includes('--execute');
  const confirmationIndex = process.argv.indexOf('--confirm');
  const confirmation = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : null;

  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== 'DELETE_CONFIRMED_LEGACY_IMAGES') {
    throw new Error('Confirmação inválida. Use --confirm DELETE_CONFIRMED_LEGACY_IMAGES.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY localmente.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runDir = path.join(reportRoot, `confirmed-legacy-cleanup-${timestamp()}`);
  fs.mkdirSync(runDir, { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    mode: 'cleanup-confirmed-legacy-images',
    writeOperationsPerformed: false,
    protectedAssets,
    results: [],
  };

  for (const target of targets) {
    const existedBefore = await objectExists(supabase, target.bucket, target.objectPath);
    if (!existedBefore) {
      report.results.push({ ...target, status: 'already-absent' });
      continue;
    }

    const { data: backupBlob, error: downloadError } = await supabase.storage
      .from(target.bucket)
      .download(target.objectPath);
    if (downloadError || !backupBlob) {
      throw downloadError || new Error(`${target.label}: falha ao criar backup.`);
    }

    const backupBuffer = Buffer.from(await backupBlob.arrayBuffer());
    const safeFilename = `${target.bucket}-${target.objectPath.replaceAll('/', '__')}`;
    const backupPath = path.join(runDir, safeFilename);
    fs.writeFileSync(backupPath, backupBuffer);

    const { error: removeError } = await supabase.storage
      .from(target.bucket)
      .remove([target.objectPath]);
    if (removeError) throw removeError;

    const existsAfter = await objectExists(supabase, target.bucket, target.objectPath);
    if (existsAfter) {
      throw new Error(`${target.label}: objeto ainda existe após a remoção.`);
    }

    report.writeOperationsPerformed = true;
    report.results.push({
      ...target,
      status: 'deleted',
      sizeBytes: backupBuffer.length,
      backupPath,
    });
  }

  report.completedAt = new Date().toISOString();
  report.summary = {
    targets: targets.length,
    deleted: report.results.filter((item) => item.status === 'deleted').length,
    alreadyAbsent: report.results.filter((item) => item.status === 'already-absent').length,
    bytesDeleted: report.results.reduce((sum, item) => sum + (item.sizeBytes || 0), 0),
    protected: protectedAssets.length,
  };

  const reportPath = path.join(runDir, 'result.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nLimpeza dos legados confirmados concluída');
  console.log(`Arquivos removidos: ${report.summary.deleted}`);
  console.log(`Bytes removidos: ${report.summary.bytesDeleted}`);
  console.log(`Ativos protegidos: ${report.summary.protected}`);
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na limpeza dos legados confirmados:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
