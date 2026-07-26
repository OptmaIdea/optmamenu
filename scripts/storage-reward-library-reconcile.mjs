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
const bucket = 'reward-images';
const confirmation = 'DELETE_REWARD_LIBRARY_ORPHANS';

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

function parseArgs() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const confirmIndex = args.indexOf('--confirm');
  const confirm = confirmIndex >= 0 ? args[confirmIndex + 1] : '';
  const storeIndex = args.indexOf('--store-id');
  const storeId = storeIndex >= 0 ? args[storeIndex + 1] : '';
  if (!storeId) throw new Error('Informe --store-id <uuid-da-loja>.');
  if (execute && confirm !== confirmation) throw new Error(`Para executar, use --confirm ${confirmation}.`);
  return { execute, storeId };
}

function requireEnvironment() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl) throw new Error('Defina SUPABASE_URL ou VITE_SUPABASE_URL no ambiente local.');
  if (!serviceRoleKey) throw new Error('Defina SUPABASE_SERVICE_ROLE_KEY localmente. Nunca use prefixo VITE_ nessa chave.');
  return { supabaseUrl, serviceRoleKey };
}

function objectPathFromUrl(value) {
  if (!value || typeof value !== 'string') return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const decoded = decodeURIComponent(value);
  const index = decoded.indexOf(marker);
  if (index < 0) return null;
  return decoded.slice(index + marker.length).split('?')[0].replace(/^\/+/, '');
}

async function listRecursive(storage, prefix = '') {
  const result = [];
  let offset = 0;
  while (true) {
    const { data, error } = await storage.list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      const itemPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id) result.push({ path: itemPath, size: Number(item.metadata?.size || 0), metadata: item.metadata || {} });
      else result.push(...await listRecursive(storage, itemPath));
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return result;
}

async function main() {
  loadLocalEnv();
  const args = parseArgs();
  const env = requireEnvironment();
  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const storage = supabase.storage.from(bucket);

  const [{ data: assets, error: assetsError }, { data: programs, error: programsError }] = await Promise.all([
    supabase.from('reward_media_assets').select('id, store_id, name, storage_path, public_url, archived_at').eq('store_id', args.storeId),
    supabase.from('fidelity_programs').select('id').eq('store_id', args.storeId),
  ]);
  if (assetsError) throw assetsError;
  if (programsError) throw programsError;

  const programIds = (programs || []).map((item) => item.id);
  let rewards = [];
  if (programIds.length > 0) {
    const { data, error } = await supabase.from('fidelity_rewards').select('id, title, image_url, media_asset_id, product_id').in('program_id', programIds);
    if (error) throw error;
    rewards = data || [];
  }

  const referenced = new Map();
  for (const asset of assets || []) {
    if (asset.archived_at) continue;
    if (asset.storage_path) referenced.set(asset.storage_path, { source: 'reward_media_assets', id: asset.id, name: asset.name });
    const urlPath = objectPathFromUrl(asset.public_url);
    if (urlPath) referenced.set(urlPath, { source: 'reward_media_assets.public_url', id: asset.id, name: asset.name });
  }
  for (const reward of rewards) {
    const rewardPath = objectPathFromUrl(reward.image_url);
    if (rewardPath) referenced.set(rewardPath, { source: 'fidelity_rewards.image_url', id: reward.id, name: reward.title });
  }

  const objects = await listRecursive(storage, args.storeId);
  const classified = objects.map((object) => ({
    ...object,
    reference: referenced.get(object.path) || null,
    status: referenced.has(object.path) ? 'referenced' : 'orphan',
  }));
  const orphans = classified.filter((item) => item.status === 'orphan');

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.execute ? 'execute' : 'dry-run',
    store_id: args.storeId,
    bucket,
    totals: {
      objects: classified.length,
      referenced: classified.length - orphans.length,
      orphans: orphans.length,
      orphan_bytes: orphans.reduce((sum, item) => sum + item.size, 0),
    },
    objects: classified,
    deletions: [],
  };

  console.log(`\nBiblioteca de recompensas — ${args.execute ? 'EXECUÇÃO' : 'DRY-RUN'}`);
  console.log(`Objetos: ${report.totals.objects} | Referenciados: ${report.totals.referenced} | Órfãos: ${report.totals.orphans}`);
  for (const orphan of orphans) console.log(`- ORPHAN ${orphan.path} (${orphan.size} bytes)`);

  if (args.execute) {
    for (const orphan of orphans) {
      const { data, error } = await storage.remove([orphan.path]);
      if (error) throw new Error(`Falha ao remover ${orphan.path}: ${error.message}`);
      const removed = Array.isArray(data) && data.length > 0;
      const parent = orphan.path.includes('/') ? orphan.path.slice(0, orphan.path.lastIndexOf('/')) : '';
      const filename = orphan.path.split('/').pop();
      const { data: remaining, error: verifyError } = await storage.list(parent, { limit: 100, search: filename });
      if (verifyError) throw new Error(`Falha ao verificar ${orphan.path}: ${verifyError.message}`);
      if ((remaining || []).some((item) => item.name === filename)) throw new Error(`O objeto ${orphan.path} continua no bucket após a exclusão.`);
      report.deletions.push({ path: orphan.path, size: orphan.size, storage_response_confirmed: removed, verified_absent: true });
      console.log(`✓ removido ${orphan.path}`);
    }
  }

  fs.mkdirSync(reportDir, { recursive: true });
  const filename = `reward-library-reconcile-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const reportPath = path.join(reportDir, filename);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nRelatório: ${reportPath}`);
  if (!args.execute && orphans.length > 0) {
    console.log(`\nPara executar: npm run storage:rewards:reconcile -- --store-id ${args.storeId} --execute --confirm ${confirmation}`);
  }
}

main().catch((error) => {
  console.error('\nERRO:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
