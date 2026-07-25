#!/usr/bin/env node

/**
 * Inventário e simulação de otimização das imagens antigas do Supabase Storage.
 *
 * Modos seguros disponíveis nesta etapa:
 *   npm run storage:images:inventory
 *   npm run storage:images:dry-run
 *   npm run storage:images:inventory -- --bucket products
 *
 * O script NÃO envia, atualiza ou exclui arquivos e NÃO altera o banco.
 * A chave service_role é usada somente localmente para listar objetos e cruzar
 * referências de todas as lojas.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const SUPPORTED_BUCKETS = ['products', 'logos', 'reward-images'];
const REPORT_DIR = path.join(projectRoot, 'reports', 'storage-images');

const IMAGE_PROFILES = {
  products: { maxWidth: 800, maxHeight: 800, quality: 82, label: 'Produto' },
  logos: { maxWidth: 800, maxHeight: 800, quality: 90, label: 'Logo' },
  'reward-images': { maxWidth: 800, maxHeight: 800, quality: 82, label: 'Recompensa' },
};

function loadLocalEnv() {
  const candidates = ['.env.local', '.env', '.env.development.local'];

  for (const filename of candidates) {
    const fullPath = path.join(projectRoot, filename);
    if (!fs.existsSync(fullPath)) continue;

    const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const separator = line.indexOf('=');
      if (separator <= 0) continue;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    mode: args.includes('--dry-run') ? 'dry-run' : 'inventory',
    bucket: null,
  };

  const bucketIndex = args.indexOf('--bucket');
  if (bucketIndex >= 0 && args[bucketIndex + 1]) {
    options.bucket = args[bucketIndex + 1];
  }

  if (options.bucket && !SUPPORTED_BUCKETS.includes(options.bucket)) {
    throw new Error(
      `Bucket inválido: ${options.bucket}. Opções: ${SUPPORTED_BUCKETS.join(', ')}`,
    );
  }

  return options;
}

function requireEnvironment() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!supabaseUrl) {
    throw new Error('Defina SUPABASE_URL ou VITE_SUPABASE_URL no ambiente local.');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Defina SUPABASE_SERVICE_ROLE_KEY localmente. Nunca use prefixo VITE_ nessa chave.',
    );
  }

  return { supabaseUrl, serviceRoleKey };
}

function normalizeObjectPath(value, expectedBucket) {
  if (!value || typeof value !== 'string') return null;

  try {
    const decoded = decodeURIComponent(value);
    const markers = [
      `/storage/v1/object/public/${expectedBucket}/`,
      `/storage/v1/object/sign/${expectedBucket}/`,
      `/storage/v1/object/authenticated/${expectedBucket}/`,
    ];

    for (const marker of markers) {
      const markerIndex = decoded.indexOf(marker);
      if (markerIndex >= 0) {
        return decoded
          .slice(markerIndex + marker.length)
          .split('?')[0]
          .replace(/^\/+/, '');
      }
    }

    if (!decoded.includes('://')) {
      return decoded.split('?')[0].replace(/^\/+/, '');
    }
  } catch {
    return null;
  }

  return null;
}

function addReference(referenceMap, bucket, objectPath, reference) {
  if (!objectPath) return;
  const key = `${bucket}:${objectPath}`;
  const current = referenceMap.get(key) || [];
  current.push(reference);
  referenceMap.set(key, current);
}

async function loadDatabaseReferences(supabase) {
  const referenceMap = new Map();

  const [productsResult, storesResult, rewardsResult] = await Promise.all([
    supabase.from('products').select('id, store_id, name, images'),
    supabase.from('stores').select('id, name, logo_url'),
    supabase.from('fidelity_rewards').select('id, store_id, name, image_url'),
  ]);

  for (const result of [productsResult, storesResult, rewardsResult]) {
    if (result.error) throw result.error;
  }

  for (const product of productsResult.data || []) {
    const images = Array.isArray(product.images) ? product.images : [];
    images.forEach((url, index) => {
      addReference(
        referenceMap,
        'products',
        normalizeObjectPath(url, 'products'),
        {
          entityType: 'product',
          entityId: product.id,
          storeId: product.store_id,
          entityName: product.name,
          field: 'images',
          index,
          fullValue: url,
        },
      );
    });
  }

  for (const store of storesResult.data || []) {
    addReference(
      referenceMap,
      'logos',
      normalizeObjectPath(store.logo_url, 'logos'),
      {
        entityType: 'store',
        entityId: store.id,
        storeId: store.id,
        entityName: store.name,
        field: 'logo_url',
        fullValue: store.logo_url,
      },
    );
  }

  for (const reward of rewardsResult.data || []) {
    addReference(
      referenceMap,
      'reward-images',
      normalizeObjectPath(reward.image_url, 'reward-images'),
      {
        entityType: 'reward',
        entityId: reward.id,
        storeId: reward.store_id,
        entityName: reward.name,
        field: 'image_url',
        fullValue: reward.image_url,
      },
    );
  }

  return referenceMap;
}

async function listFolder(supabase, bucket, prefix = '') {
  const objects = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });

    if (error) throw error;
    const entries = data || [];

    for (const entry of entries) {
      const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = !entry.id && !entry.metadata;

      if (isFolder) {
        objects.push(...(await listFolder(supabase, bucket, objectPath)));
      } else if (entry.name !== '.emptyFolderPlaceholder') {
        objects.push({
          bucket,
          path: objectPath,
          id: entry.id || null,
          createdAt: entry.created_at || null,
          updatedAt: entry.updated_at || null,
          metadata: entry.metadata || {},
        });
      }
    }

    if (entries.length < limit) break;
    offset += limit;
  }

  return objects;
}

function proposedPath(bucket, references) {
  const reference = references[0];
  if (!reference) return null;

  if (bucket === 'products' && reference.entityType === 'product') {
    const index = Number.isInteger(reference.index) ? reference.index + 1 : 1;
    return `${reference.storeId}/${reference.entityId}/image-${String(index).padStart(2, '0')}.webp`;
  }

  if (bucket === 'logos' && reference.entityType === 'store') {
    return `${reference.storeId}/logo.webp`;
  }

  if (bucket === 'reward-images' && reference.entityType === 'reward') {
    return `${reference.storeId}/${reference.entityId}/reward.webp`;
  }

  return null;
}

function getObjectSize(object) {
  const raw = object.metadata?.size;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMimeType(object) {
  return (
    object.metadata?.mimetype ||
    object.metadata?.contentType ||
    'application/octet-stream'
  );
}

async function estimateOptimization(supabase, object, profile) {
  const { data, error } = await supabase.storage
    .from(object.bucket)
    .download(object.path);

  if (error) throw error;
  const input = Buffer.from(await data.arrayBuffer());
  const image = sharp(input, { failOn: 'error' }).rotate();
  const metadata = await image.metadata();

  const optimized = await image
    .resize({
      width: profile.maxWidth,
      height: profile.maxHeight,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: profile.quality })
    .toBuffer({ resolveWithObject: true });

  return {
    originalWidth: metadata.width || null,
    originalHeight: metadata.height || null,
    optimizedWidth: optimized.info.width || null,
    optimizedHeight: optimized.info.height || null,
    estimatedSizeBytes: optimized.data.length,
    estimatedSavingBytes: Math.max(0, input.length - optimized.data.length),
    estimatedSavingPercent:
      input.length > 0
        ? Number((((input.length - optimized.data.length) / input.length) * 100).toFixed(1))
        : 0,
  };
}

function summarize(items) {
  const summary = {
    objects: items.length,
    referenced: 0,
    orphan: 0,
    duplicateReference: 0,
    totalBytes: 0,
    estimatedBytes: 0,
    estimatedSavingBytes: 0,
    byBucket: {},
  };

  for (const item of items) {
    const bucketSummary = (summary.byBucket[item.bucket] ||= {
      objects: 0,
      referenced: 0,
      orphan: 0,
      totalBytes: 0,
      estimatedBytes: 0,
    });

    summary.totalBytes += item.sizeBytes;
    bucketSummary.objects += 1;
    bucketSummary.totalBytes += item.sizeBytes;

    if (item.status === 'orphan') {
      summary.orphan += 1;
      bucketSummary.orphan += 1;
    } else {
      summary.referenced += 1;
      bucketSummary.referenced += 1;
    }

    if (item.references.length > 1) summary.duplicateReference += 1;

    if (item.optimization?.estimatedSizeBytes) {
      summary.estimatedBytes += item.optimization.estimatedSizeBytes;
      summary.estimatedSavingBytes += item.optimization.estimatedSavingBytes;
      bucketSummary.estimatedBytes += item.optimization.estimatedSizeBytes;
    }
  }

  return summary;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function printSummary(summary, mode, reportPath) {
  console.log('\nInventário concluído');
  console.log(`Modo: ${mode}`);
  console.log(`Objetos: ${summary.objects}`);
  console.log(`Referenciados: ${summary.referenced}`);
  console.log(`Órfãos candidatos: ${summary.orphan}`);
  console.log(`Referências compartilhadas: ${summary.duplicateReference}`);
  console.log(`Tamanho atual: ${formatBytes(summary.totalBytes)}`);

  if (mode === 'dry-run') {
    console.log(`Tamanho estimado: ${formatBytes(summary.estimatedBytes)}`);
    console.log(
      `Economia estimada: ${formatBytes(summary.estimatedSavingBytes)}`,
    );
  }

  console.log(`Relatório: ${reportPath}\n`);
}

async function main() {
  loadLocalEnv();
  const options = parseArgs();
  const { supabaseUrl, serviceRoleKey } = requireEnvironment();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const buckets = options.bucket ? [options.bucket] : SUPPORTED_BUCKETS;
  const references = await loadDatabaseReferences(supabase);
  const items = [];

  for (const bucket of buckets) {
    console.log(`Analisando bucket ${bucket}...`);
    const objects = await listFolder(supabase, bucket);

    for (const object of objects) {
      const key = `${bucket}:${object.path}`;
      const objectReferences = references.get(key) || [];
      const profile = IMAGE_PROFILES[bucket];
      const item = {
        bucket,
        path: object.path,
        mimeType: getMimeType(object),
        sizeBytes: getObjectSize(object),
        createdAt: object.createdAt,
        updatedAt: object.updatedAt,
        status: objectReferences.length ? 'referenced' : 'orphan',
        references: objectReferences,
        proposedPath: proposedPath(bucket, objectReferences),
        optimization: null,
        error: null,
      };

      if (options.mode === 'dry-run' && objectReferences.length > 0) {
        try {
          item.optimization = await estimateOptimization(
            supabase,
            object,
            profile,
          );
        } catch (error) {
          item.error = error instanceof Error ? error.message : String(error);
        }
      }

      items.push(item);
    }
  }

  const summary = summarize(items);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(
    REPORT_DIR,
    `storage-images-${options.mode}-${timestamp}.json`,
  );

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    buckets,
    writeOperationsPerformed: false,
    profiles: IMAGE_PROFILES,
    summary,
    items,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  printSummary(summary, options.mode, reportPath);
}

main().catch((error) => {
  console.error('\nFalha no inventário de imagens:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
