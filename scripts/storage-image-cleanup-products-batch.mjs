#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reportDir = path.join(projectRoot, 'reports', 'storage-images');
const bucket = 'products';

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

function requireEnvironment() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl) throw new Error('Defina SUPABASE_URL ou VITE_SUPABASE_URL localmente.');
  if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY localmente, sem prefixo VITE_.');
  return { supabaseUrl, serviceRoleKey };
}

function requireArgs() {
  const storeId = getArg('--store-id');
  const execute = process.argv.includes('--execute');
  const confirmation = getArg('--confirm');
  if (!storeId) throw new Error('Informe --store-id <uuid>.');
  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== 'CLEANUP_MIGRATED_PRODUCTS') {
    throw new Error('Confirmação inválida. Use --confirm CLEANUP_MIGRATED_PRODUCTS.');
  }
  return { storeId };
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

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function listFolder(supabase, folder) {
  const { data, error } = await supabase.storage.from(bucket).list(folder, {
    limit: 100,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  return data || [];
}

async function main() {
  loadLocalEnv();
  const { storeId } = requireArgs();
  const { supabaseUrl, serviceRoleKey } = requireEnvironment();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, store_id, name, images')
    .eq('store_id', storeId)
    .order('name', { ascending: true });
  if (productsError) throw productsError;

  const candidates = (products || []).flatMap((product) => {
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length !== 1) return [];
    const currentPath = normalizeObjectPath(images[0]);
    const expectedPath = `${product.store_id}/${product.id}/image-01.webp`;
    if (currentPath !== expectedPath) return [];
    return [{ ...product, currentPath, folder: `${product.store_id}/${product.id}` }];
  });

  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `product-images-cleanup-batch-${timestamp()}.json`);
  const report = {
    startedAt: new Date().toISOString(),
    parameters: {
      storeId,
      execute: true,
      preserveCurrentFilename: 'image-01.webp',
      multiImageProductsUntouched: true,
      unclassifiedOrphansUntouched: true,
    },
    candidates: candidates.map(({ id, name, currentPath }) => ({ id, name, currentPath })),
    results: [],
    completed: false,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  for (const product of candidates) {
    const before = await listFolder(supabase, product.folder);
    const current = before.find((item) => item.name === 'image-01.webp');
    if (!current) throw new Error(`Arquivo atual ausente para ${product.name}: ${product.currentPath}`);

    const oldFiles = before.filter(
      (item) => item.name && item.name !== 'image-01.webp' && item.name !== '.emptyFolderPlaceholder',
    );
    const oldPaths = oldFiles.map((item) => `${product.folder}/${item.name}`);

    if (oldPaths.length > 0) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(oldPaths);
      if (removeError) throw removeError;
    }

    const after = await listFolder(supabase, product.folder);
    if (!after.some((item) => item.name === 'image-01.webp')) {
      throw new Error(`Validação falhou: image-01.webp desapareceu de ${product.name}.`);
    }
    const remainingOld = after.filter(
      (item) => item.name && item.name !== 'image-01.webp' && item.name !== '.emptyFolderPlaceholder',
    );
    if (remainingOld.length > 0) {
      throw new Error(`Validação falhou: ainda existem arquivos antigos em ${product.name}.`);
    }

    report.results.push({
      status: 'cleaned',
      productId: product.id,
      name: product.name,
      currentPath: product.currentPath,
      deletedPaths: oldPaths,
      deletedCount: oldPaths.length,
      remainingPaths: after
        .filter((item) => item.name && item.name !== '.emptyFolderPlaceholder')
        .map((item) => `${product.folder}/${item.name}`),
    });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`${product.name}: ${oldPaths.length} arquivo(s) antigo(s) removido(s).`);
  }

  report.completed = true;
  report.completedAt = new Date().toISOString();
  report.summary = {
    productsChecked: candidates.length,
    productsCleaned: report.results.length,
    oldObjectsDeleted: report.results.reduce((sum, item) => sum + item.deletedCount, 0),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nLimpeza em lote concluída com segurança.');
  console.log(`Produtos conferidos: ${report.summary.productsChecked}`);
  console.log(`Objetos antigos removidos: ${report.summary.oldObjectsDeleted}`);
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na limpeza em lote de produtos:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
