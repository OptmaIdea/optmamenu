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

function getNumberArg(name, fallback) {
  const value = getArg(name);
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} deve ser um inteiro positivo.`);
  return parsed;
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
  const object = (data || []).find((item) => item.name === filename);
  if (!object) throw new Error(`Novo objeto não encontrado após upload: ${objectPath}`);
  return object;
}

async function migrateOne(supabase, product, runDir) {
  const oldImages = Array.isArray(product.images) ? product.images : [];
  if (oldImages.length !== 1) {
    return { status: 'skipped', reason: `expected_one_image_found_${oldImages.length}`, productId: product.id, name: product.name };
  }

  const oldUrl = oldImages[0];
  const oldPath = normalizeObjectPath(oldUrl);
  if (!oldPath) return { status: 'skipped', reason: 'unrecognized_current_path', productId: product.id, name: product.name };

  const newPath = `${product.store_id}/${product.id}/image-01.webp`;
  if (oldPath === newPath) return { status: 'skipped', reason: 'already_deterministic', productId: product.id, name: product.name };

  const backupPath = path.join(runDir, `backup-${product.id}.json`);
  const backup = {
    generatedAt: new Date().toISOString(),
    product: { id: product.id, storeId: product.store_id, name: product.name, createdAt: product.created_at, oldImages },
    storage: { bucket, oldPath, newPath },
    rollback: { instruction: 'Restaurar products.images para oldImages. O arquivo antigo foi preservado.', oldImages },
  };
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

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
    throw new Error(`Releitura não confirmou a nova URL do produto ${product.id}.`);
  }

  return {
    status: 'migrated',
    productId: product.id,
    name: product.name,
    oldPath,
    newPath,
    oldObjectDeleted: false,
    oldSizeBytes: input.length,
    newSizeBytes: optimized.data.length,
    width: optimized.info.width,
    height: optimized.info.height,
    savingBytes: input.length - optimized.data.length,
    savingPercent: Number((((input.length - optimized.data.length) / input.length) * 100).toFixed(1)),
    backupPath,
  };
}

async function main() {
  loadLocalEnv();
  const execute = process.argv.includes('--execute');
  const confirmation = getArg('--confirm');
  const limit = getNumberArg('--limit', 5);
  const storeId = getArg('--store-id');

  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== 'MIGRATE_PRODUCTS') throw new Error('Confirmação inválida. Use --confirm MIGRATE_PRODUCTS.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl) throw new Error('Defina SUPABASE_URL ou VITE_SUPABASE_URL localmente.');
  if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY localmente, sem prefixo VITE_.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let query = supabase
    .from('products')
    .select('id, store_id, name, images, created_at')
    .not('images', 'is', null)
    .order('created_at', { ascending: true });
  if (storeId) query = query.eq('store_id', storeId);

  const { data: products, error: productsError } = await query;
  if (productsError) throw productsError;

  const candidates = (products || []).filter((product) => {
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length !== 1) return false;
    const currentPath = normalizeObjectPath(images[0]);
    const expectedPath = `${product.store_id}/${product.id}/image-01.webp`;
    return currentPath && currentPath !== expectedPath;
  }).slice(0, limit);

  if (candidates.length === 0) {
    console.log('\nNenhum produto elegível para migração em lote.\n');
    return;
  }

  fs.mkdirSync(reportDir, { recursive: true });
  const runId = timestamp();
  const runDir = path.join(reportDir, `product-batch-${runId}`);
  fs.mkdirSync(runDir, { recursive: true });
  const reportPath = path.join(runDir, 'batch-result.json');

  const report = {
    startedAt: new Date().toISOString(),
    parameters: { limit, storeId: storeId || null, stopOnFirstError: true, deleteOldObjects: false },
    candidates: candidates.map((item) => ({ id: item.id, name: item.name, storeId: item.store_id })),
    results: [],
    completed: false,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  for (const product of candidates) {
    console.log(`Migrando ${product.name} (${product.id})...`);
    try {
      const result = await migrateOne(supabase, product, runDir);
      report.results.push(result);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      if (result.status === 'migrated') {
        console.log(`  ${Math.round(result.oldSizeBytes / 1024)} KB -> ${Math.round(result.newSizeBytes / 1024)} KB (${result.savingPercent}% de economia)`);
      } else {
        console.log(`  Ignorado: ${result.reason}`);
      }
    } catch (error) {
      report.results.push({
        status: 'failed',
        productId: product.id,
        name: product.name,
        error: error instanceof Error ? error.message : String(error),
      });
      report.stoppedAtFirstError = true;
      report.completedAt = new Date().toISOString();
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
      throw new Error(`Lote interrompido no produto ${product.name} (${product.id}): ${error instanceof Error ? error.message : error}`);
    }
  }

  report.completed = true;
  report.completedAt = new Date().toISOString();
  report.summary = {
    migrated: report.results.filter((item) => item.status === 'migrated').length,
    skipped: report.results.filter((item) => item.status === 'skipped').length,
    failed: report.results.filter((item) => item.status === 'failed').length,
    oldObjectsDeleted: 0,
    savingBytes: report.results.reduce((sum, item) => sum + (item.savingBytes || 0), 0),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nMigração em lote concluída');
  console.log(`Migrados: ${report.summary.migrated}`);
  console.log(`Ignorados: ${report.summary.skipped}`);
  console.log('Arquivos antigos removidos: 0');
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na migração em lote:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
