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

const allowedTypes = new Set(['logo', 'reward']);

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

function normalizeObjectPath(value, bucket) {
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

async function objectExists(supabase, bucket, objectPath) {
  const parts = objectPath.split('/');
  const filename = parts.pop();
  const directory = parts.join('/');
  const { data, error } = await supabase.storage.from(bucket).list(directory, { limit: 100, search: filename });
  if (error) throw error;
  return (data || []).some((item) => item.name === filename);
}

async function main() {
  loadLocalEnv();

  const type = getArg('--type');
  const entityId = getArg('--entity-id');
  const oldPathArg = getArg('--old-path');
  const execute = process.argv.includes('--execute');
  const confirmation = getArg('--confirm');

  if (!allowedTypes.has(type)) throw new Error('Informe --type logo ou --type reward.');
  if (!entityId) throw new Error('Informe --entity-id.');
  if (!oldPathArg) throw new Error('Informe --old-path com o caminho antigo exato.');
  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== entityId) throw new Error('Confirmação inválida. Use --confirm igual ao entity-id.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY localmente.');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const config = type === 'logo'
    ? { bucket: 'logos', table: 'stores', field: 'logo_url', newPath: `${entityId}/logo.webp`, select: 'id, name, logo_url' }
    : { bucket: 'reward-images', table: 'fidelity_rewards', field: 'image_url', newPath: null, select: 'id, title, image_url, program_id' };

  const { data: entity, error } = await supabase.from(config.table).select(config.select).eq('id', entityId).single();
  if (error) throw error;

  let expectedNewPath = config.newPath;
  let entityName = entity.name || entity.title || entityId;

  if (type === 'reward') {
    const { data: program, error: programError } = await supabase
      .from('fidelity_programs')
      .select('id, store_id')
      .eq('id', entity.program_id)
      .single();
    if (programError) throw programError;
    expectedNewPath = `${program.store_id}/${entityId}/reward.webp`;
  }

  const currentPath = normalizeObjectPath(entity[config.field], config.bucket);
  if (currentPath !== expectedNewPath) {
    throw new Error(`${entityName}: banco não aponta para o caminho determinístico esperado (${expectedNewPath}).`);
  }

  if (!(await objectExists(supabase, config.bucket, expectedNewPath))) {
    throw new Error(`${entityName}: novo objeto não encontrado no Storage: ${expectedNewPath}`);
  }

  const normalizedOldPath = normalizeObjectPath(oldPathArg, config.bucket);
  if (!normalizedOldPath) throw new Error('Caminho antigo inválido.');
  if (normalizedOldPath === expectedNewPath) throw new Error('O caminho antigo não pode ser igual ao caminho atual.');

  const oldExists = await objectExists(supabase, config.bucket, normalizedOldPath);
  if (oldExists) {
    const { error: removeError } = await supabase.storage.from(config.bucket).remove([normalizedOldPath]);
    if (removeError) throw removeError;
  }

  if (!(await objectExists(supabase, config.bucket, expectedNewPath))) {
    throw new Error(`${entityName}: verificação pós-limpeza falhou; novo objeto ausente.`);
  }

  const oldStillExists = await objectExists(supabase, config.bucket, normalizedOldPath);
  if (oldStillExists) throw new Error(`${entityName}: arquivo antigo ainda existe após a remoção.`);

  fs.mkdirSync(reportDir, { recursive: true });
  const report = {
    completedAt: new Date().toISOString(),
    type,
    entityId,
    name: entityName,
    bucket: config.bucket,
    currentPath: expectedNewPath,
    deletedPath: normalizedOldPath,
    oldObjectExistedBefore: oldExists,
    oldObjectExistsAfter: oldStillExists,
  };
  const reportPath = path.join(reportDir, `asset-cleanup-${type}-${entityId}-${timestamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nLimpeza de ativo concluída com segurança');
  console.log(`Tipo: ${type}`);
  console.log(`Entidade: ${entityName}`);
  console.log(`Arquivo atual preservado: ${expectedNewPath}`);
  console.log(`Arquivo antigo removido: ${normalizedOldPath}`);
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na limpeza do ativo:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
