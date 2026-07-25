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
const allowedIds = new Set([
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
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
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
  return (data || []).filter((item) => item.name).map((item) => `${directory}/${item.name}`);
}

async function main() {
  loadLocalEnv();
  const ids = (getArg('--product-ids') || '').split(',').map((v) => v.trim()).filter(Boolean);
  const execute = process.argv.includes('--execute');
  const confirmation = getArg('--confirm');
  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== 'CLEANUP_MULTI_IMAGE_PRODUCTS') throw new Error('Confirmação inválida.');
  if (ids.length !== 2 || ids.some((id) => !allowedIds.has(id)) || new Set(ids).size !== 2) {
    throw new Error('Informe exatamente os dois UUIDs permitidos em --product-ids.');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY localmente.');
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `multi-image-products-cleanup-${timestamp()}.json`);
  const report = { startedAt: new Date().toISOString(), parameters: { ids, execute: true, preserveDatabaseOrder: true }, results: [] };

  for (const productId of ids) {
    const { data: product, error } = await supabase.from('products').select('id, store_id, name, images').eq('id', productId).single();
    if (error) throw error;
    const images = Array.isArray(product.images) ? product.images : [];
    if (images.length < 2) throw new Error(`${product.name}: esperado produto com múltiplas imagens.`);

    const currentPathsInDatabaseOrder = images.map(normalizeObjectPath);
    if (currentPathsInDatabaseOrder.some((value) => !value)) throw new Error(`${product.name}: URL inválida no array images.`);
    if (new Set(currentPathsInDatabaseOrder).size !== currentPathsInDatabaseOrder.length) {
      throw new Error(`${product.name}: há caminhos duplicados no array images.`);
    }

    const expectedDeterministicPaths = images.map((_, index) =>
      `${product.store_id}/${product.id}/image-${String(index + 1).padStart(2, '0')}.webp`,
    );
    const expectedSet = new Set(expectedDeterministicPaths);
    if (
      currentPathsInDatabaseOrder.length !== expectedDeterministicPaths.length ||
      currentPathsInDatabaseOrder.some((objectPath) => !expectedSet.has(objectPath))
    ) {
      throw new Error(`${product.name}: conjunto de caminhos determinísticos não confirmado.`);
    }

    const before = await listProductObjects(supabase, product.store_id, product.id);
    for (const expectedPath of expectedDeterministicPaths) {
      if (!before.includes(expectedPath)) throw new Error(`${product.name}: arquivo atual ausente: ${expectedPath}`);
    }

    const oldPaths = before.filter((objectPath) => !expectedSet.has(objectPath));
    if (oldPaths.length) {
      const { error: removeError } = await supabase.storage.from(bucket).remove(oldPaths);
      if (removeError) throw removeError;
    }

    const after = await listProductObjects(supabase, product.store_id, product.id);
    if (after.length !== expectedDeterministicPaths.length || expectedDeterministicPaths.some((objectPath) => !after.includes(objectPath))) {
      throw new Error(`${product.name}: verificação pós-limpeza falhou.`);
    }

    report.results.push({
      status: 'cleaned',
      productId,
      name: product.name,
      databaseOrderPreserved: currentPathsInDatabaseOrder,
      preservedPaths: expectedDeterministicPaths,
      deletedPaths: oldPaths,
      remainingPaths: after,
    });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  }

  report.completed = true;
  report.completedAt = new Date().toISOString();
  report.summary = {
    productsChecked: report.results.length,
    oldObjectsDeleted: report.results.reduce((sum, item) => sum + item.deletedPaths.length, 0),
  };
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log('\nLimpeza de múltiplas imagens concluída com segurança');
  console.log(`Produtos verificados: ${report.summary.productsChecked}`);
  console.log(`Arquivos antigos removidos: ${report.summary.oldObjectsDeleted}`);
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na limpeza de múltiplas imagens:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
