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

async function listProductObjects(supabase, storeId, productId) {
  const directory = `${storeId}/${productId}`;
  const { data, error } = await supabase.storage.from(bucket).list(directory, { limit: 100 });
  if (error) throw error;
  return (data || []).filter((item) => item.name && item.name !== '.emptyFolderPlaceholder');
}

async function main() {
  loadLocalEnv();
  const productId = getArg('--product-id');
  const confirmation = getArg('--confirm-product-id');
  const execute = process.argv.includes('--execute');

  if (!productId) throw new Error('Informe --product-id <uuid>.');
  if (!execute) throw new Error('Execução bloqueada. Informe --execute para remover o arquivo antigo validado.');
  if (confirmation !== productId) throw new Error('--confirm-product-id deve ser idêntico a --product-id.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl) throw new Error('Defina SUPABASE_URL ou VITE_SUPABASE_URL localmente.');
  if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY localmente, sem prefixo VITE_.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('id, store_id, name, images')
    .eq('id', productId)
    .single();
  if (productError) throw productError;

  const currentImages = Array.isArray(product.images) ? product.images : [];
  if (currentImages.length !== 1) throw new Error(`Esperada exatamente 1 imagem atual. Encontradas: ${currentImages.length}.`);

  const currentPath = normalizeObjectPath(currentImages[0]);
  const expectedCurrentPath = `${product.store_id}/${product.id}/image-01.webp`;
  if (currentPath !== expectedCurrentPath) {
    throw new Error(`O produto não aponta para o caminho determinístico esperado. Atual: ${currentPath || 'indefinido'}.`);
  }

  const objects = await listProductObjects(supabase, product.store_id, product.id);
  const oldCandidates = objects
    .map((item) => `${product.store_id}/${product.id}/${item.name}`)
    .filter((objectPath) => objectPath !== expectedCurrentPath);

  if (oldCandidates.length === 0) {
    console.log('\nNenhum arquivo antigo encontrado para este produto. Nada foi removido.\n');
    return;
  }
  if (oldCandidates.length !== 1) {
    throw new Error(`A limpeza piloto exige exatamente 1 arquivo antigo. Encontrados: ${oldCandidates.length}. Revise manualmente os caminhos.`);
  }

  const oldPath = oldCandidates[0];
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `product-image-cleanup-${product.id}-${timestamp()}.json`);

  const { error: removeError } = await supabase.storage.from(bucket).remove([oldPath]);
  if (removeError) throw removeError;

  const after = await listProductObjects(supabase, product.store_id, product.id);
  const remainingPaths = after.map((item) => `${product.store_id}/${product.id}/${item.name}`);
  if (remainingPaths.includes(oldPath)) throw new Error('O arquivo antigo ainda aparece no Storage após a remoção.');
  if (!remainingPaths.includes(expectedCurrentPath)) {
    throw new Error('O arquivo atual deixou de existir após a limpeza. Verifique imediatamente o Storage.');
  }

  const report = {
    completedAt: new Date().toISOString(),
    product: { id: product.id, name: product.name, storeId: product.store_id },
    currentPath: expectedCurrentPath,
    deletedOldPath: oldPath,
    remainingPaths,
    databaseImages: currentImages,
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nLimpeza do produto piloto concluída com segurança');
  console.log(`Produto: ${product.name} (${product.id})`);
  console.log(`Arquivo antigo removido: ${oldPath}`);
  console.log(`Arquivo atual preservado: ${expectedCurrentPath}`);
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na limpeza da imagem antiga:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
