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
const reportRoot = path.join(projectRoot, 'reports', 'storage-images');
const bucket = 'products';
const profile = { maxWidth: 800, maxHeight: 800, quality: 82 };
const allowedProductIds = new Set([
  '1524bae5-f856-44b6-bf7e-fd738e4eb0ca',
  'e9678821-7f49-402c-b2b5-102a26c9ccf6',
]);

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
  const ids = (getArg('--product-ids') || '').split(',').map((value) => value.trim()).filter(Boolean);
  const execute = process.argv.includes('--execute');
  const confirmation = getArg('--confirm');
  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== 'MIGRATE_MULTI_IMAGE_PRODUCTS') {
    throw new Error('Confirmação inválida. Use --confirm MIGRATE_MULTI_IMAGE_PRODUCTS.');
  }
  if (ids.length !== 2 || ids.some((id) => !allowedProductIds.has(id))) {
    throw new Error('Informe exatamente os dois UUIDs permitidos em --product-ids, separados por vírgula.');
  }
  return { ids };
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
  const { data, error } = await supabase.storage.from(bucket).list(directory, { limit: 100, search: filename });
  if (error) throw error;
  if (!(data || []).some((item) => item.name === filename)) {
    throw new Error(`Objeto não encontrado após upload: ${objectPath}`);
  }
}

async function migrateProduct(supabase, product, runDir) {
  const oldImages = Array.isArray(product.images) ? product.images : [];
  if (oldImages.length < 2) throw new Error(`${product.name}: esperado produto com múltiplas imagens.`);
  const oldPaths = oldImages.map(normalizeObjectPath);
  if (oldPaths.some((value) => !value)) throw new Error(`${product.name}: caminho legado inválido.`);

  const backupPath = path.join(runDir, `backup-${product.id}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    product: { id: product.id, storeId: product.store_id, name: product.name, oldImages },
    oldPaths,
    rollback: { instruction: 'Restaurar products.images para oldImages. Arquivos antigos foram preservados.', oldImages },
  }, null, 2), 'utf8');

  const newUrls = [];
  const images = [];
  for (let index = 0; index < oldPaths.length; index += 1) {
    const oldPath = oldPaths[index];
    const newPath = `${product.store_id}/${product.id}/image-${String(index + 1).padStart(2, '0')}.webp`;
    const { data: downloaded, error: downloadError } = await supabase.storage.from(bucket).download(oldPath);
    if (downloadError) throw downloadError;
    const input = Buffer.from(await downloaded.arrayBuffer());
    const optimized = await sharp(input, { failOn: 'error' })
      .rotate()
      .resize({ width: profile.maxWidth, height: profile.maxHeight, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: profile.quality })
      .toBuffer({ resolveWithObject: true });
    const { error: uploadError } = await supabase.storage.from(bucket).upload(newPath, optimized.data, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '31536000',
    });
    if (uploadError) throw uploadError;
    await verifyObject(supabase, newPath);
    const newUrl = `${publicUrl(supabase, newPath)}?v=${Date.now()}-${index + 1}`;
    newUrls.push(newUrl);
    images.push({ index, oldPath, newPath, oldSizeBytes: input.length, newSizeBytes: optimized.data.length, width: optimized.info.width, height: optimized.info.height });
  }

  const { error: updateError } = await supabase
    .from('products')
    .update({ images: newUrls })
    .eq('id', product.id)
    .eq('store_id', product.store_id);
  if (updateError) throw updateError;

  const { data: validated, error: validationError } = await supabase
    .from('products')
    .select('id, images')
    .eq('id', product.id)
    .single();
  if (validationError) throw validationError;
  if (JSON.stringify(validated.images) !== JSON.stringify(newUrls)) {
    throw new Error(`${product.name}: releitura não confirmou ordem e quantidade das novas imagens.`);
  }

  return {
    status: 'migrated',
    productId: product.id,
    name: product.name,
    imageCount: images.length,
    oldImages,
    newImages: newUrls,
    images,
    oldObjectsDeleted: false,
    savingBytes: images.reduce((sum, item) => sum + item.oldSizeBytes - item.newSizeBytes, 0),
    backupPath,
  };
}

async function main() {
  loadLocalEnv();
  const { ids } = requireArgs();
  const { supabaseUrl, serviceRoleKey } = requireEnvironment();
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const runId = timestamp();
  const runDir = path.join(reportRoot, `multi-image-products-${runId}`);
  fs.mkdirSync(runDir, { recursive: true });
  const reportPath = path.join(runDir, 'result.json');

  const { data: products, error } = await supabase
    .from('products')
    .select('id, store_id, name, images')
    .in('id', ids);
  if (error) throw error;
  if (!products || products.length !== 2) throw new Error('Não foi possível carregar exatamente os dois produtos permitidos.');

  const report = {
    startedAt: new Date().toISOString(),
    parameters: { ids, preserveOrder: true, preserveCount: true, deleteOldObjects: false, stopOnFirstError: true },
    results: [],
  };

  for (const id of ids) {
    const product = products.find((item) => item.id === id);
    const result = await migrateProduct(supabase, product, runDir);
    report.results.push(result);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`${product.name}: ${result.imageCount} imagens migradas; originais preservados.`);
  }

  report.completed = true;
  report.completedAt = new Date().toISOString();
  report.summary = {
    productsMigrated: report.results.length,
    imagesMigrated: report.results.reduce((sum, item) => sum + item.imageCount, 0),
    oldObjectsDeleted: 0,
    savingBytes: report.results.reduce((sum, item) => sum + item.savingBytes, 0),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Relatório: ${reportPath}`);
}

main().catch((error) => {
  console.error('\nFalha na migração de produtos com múltiplas imagens:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
