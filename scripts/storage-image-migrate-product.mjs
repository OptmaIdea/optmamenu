#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reportDir = path.join(projectRoot, 'reports', 'storage-images');
const bucket = 'products';
const profile = { maxWidth: 800, maxHeight: 800, quality: 82 };

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

function getArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function requireArgs() {
  const productId = getArg('--product-id');
  const confirmation = getArg('--confirm-product-id');
  const execute = process.argv.includes('--execute');

  if (!productId) throw new Error('Informe --product-id <uuid>.');
  if (!execute) throw new Error('Execução bloqueada. Informe --execute para migrar o produto piloto.');
  if (confirmation !== productId) {
    throw new Error('Confirmação inválida. --confirm-product-id deve ser idêntico a --product-id.');
  }

  return { productId };
}

function requireEnvironment() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl) throw new Error('Defina SUPABASE_URL ou VITE_SUPABASE_URL localmente.');
  if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY localmente, sem prefixo VITE_.');
  return { supabaseUrl, serviceRoleKey };
}

function normalizeObjectPath(value) {
  if (!value || typeof value !== 'string') return null;
  const decoded = decodeURIComponent(value);
  const marker = `/storage/v1/object/public/${bucket}/`;
  const markerIndex = decoded.indexOf(marker);
  if (markerIndex >= 0) return decoded.slice(markerIndex + marker.length).split('?')[0].replace(/^\/+/, '');
  if (!decoded.includes('://')) return decoded.split('?')[0].replace(/^\/+/, '');
  return null;
}

function publicUrl(supabase, objectPath) {
  return supabase.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function verifyObject(supabase, objectPath) {
  const directory = path.posix.dirname(objectPath);
  const filename = path.posix.basename(objectPath);
  const { data, error } = await supabase.storage.from(bucket).list(directory, {
    limit: 100,
    search: filename,
  });
  if (error) throw error;
  const object = (data || []).find((item) => item.name === filename);
  if (!object) throw new Error(`O novo objeto não foi encontrado após o upload: ${objectPath}`);
  return object;
}

async function main() {
  loadLocalEnv();
  const { productId } = requireArgs();
  const { supabaseUrl, serviceRoleKey } = requireEnvironment();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, store_id, name, images, updated_at')
    .eq('id', productId)
    .single();
  if (productError) throw productError;

  const oldImages = Array.isArray(product.images) ? product.images : [];
  if (oldImages.length !== 1) {
    throw new Error(`O piloto exige produto com exatamente 1 imagem. Encontradas: ${oldImages.length}.`);
  }

  const oldUrl = oldImages[0];
  const oldPath = normalizeObjectPath(oldUrl);
  if (!oldPath) throw new Error('Não foi possível identificar o caminho atual da imagem no bucket products.');

  const newPath = `${product.store_id}/${product.id}/image-01.webp`;
  if (oldPath === newPath) throw new Error('O produto já usa o caminho determinístico esperado.');

  fs.mkdirSync(reportDir, { recursive: true });
  const runId = timestamp();
  const backupPath = path.join(reportDir, `product-image-migration-backup-${product.id}-${runId}.json`);
  const reportPath = path.join(reportDir, `product-image-migration-result-${product.id}-${runId}.json`);

  const backup = {
    generatedAt: new Date().toISOString(),
    product: {
      id: product.id,
      storeId: product.store_id,
      name: product.name,
      updatedAt: product.updated_at,
      oldImages,
    },
    storage: { bucket, oldPath, newPath },
    rollback: {
      instruction: 'Restaurar products.images para oldImages. O arquivo antigo foi preservado.',
      oldImages,
    },
  };
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

  const { data: downloaded, error: downloadError } = await supabase.storage.from(bucket).download(oldPath);
  if (downloadError) throw downloadError;
  const input = Buffer.from(await downloaded.arrayBuffer());
  const optimized = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({
      width: profile.maxWidth,
      height: profile.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: profile.quality })
    .toBuffer({ resolveWithObject: true });

  const { error: uploadError } = await supabase.storage.from(bucket).upload(newPath, optimized.data, {
    upsert: true,
    contentType: 'image/webp',
    cacheControl: '31536000',
  });
  if (uploadError) throw uploadError;

  await verifyObject(supabase, newPath);
  const newUrl = `${publicUrl(supabase, newPath)}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from('products')
    .update({ images: [newUrl] })
    .eq('id', product.id)
    .eq('store_id', product.store_id);
  if (updateError) throw updateError;

  const { data: validated, error: validationError } = await supabase
    .from('products')
    .select('id, images')
    .eq('id', product.id)
    .single();
  if (validationError) throw validationError;
  if (!Array.isArray(validated.images) || validated.images[0] !== newUrl) {
    throw new Error('A releitura do produto não confirmou a nova URL. O arquivo antigo foi preservado; use o backup para rollback.');
  }

  const result = {
    completedAt: new Date().toISOString(),
    writeOperationsPerformed: true,
    oldObjectDeleted: false,
    product: { id: product.id, name: product.name, storeId: product.store_id },
    oldImage: { url: oldUrl, path: oldPath, sizeBytes: input.length },
    newImage: {
      url: newUrl,
      path: newPath,
      sizeBytes: optimized.data.length,
      width: optimized.info.width,
      height: optimized.info.height,
      mimeType: 'image/webp',
    },
    savingBytes: input.length - optimized.data.length,
    savingPercent: Number((((input.length - optimized.data.length) / input.length) * 100).toFixed(1)),
    backupPath,
    nextStep: 'Validar visualmente em Produtos, PDV e slug. Somente depois remover o objeto antigo em operação separada.',
  };
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2), 'utf8');

  console.log('\nMigração piloto concluída com segurança');
  console.log(`Produto: ${product.name} (${product.id})`);
  console.log(`Antiga: ${(input.length / 1024).toFixed(1)} KB`);
  console.log(`Nova: ${(optimized.data.length / 1024).toFixed(1)} KB`);
  console.log(`Economia: ${result.savingPercent}%`);
  console.log('Arquivo antigo preservado: sim');
  console.log(`Backup: ${backupPath}`);
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na migração piloto:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
