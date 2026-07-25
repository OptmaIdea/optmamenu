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

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
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

async function getEntity(supabase, type, entityId) {
  if (type === 'logo') {
    const { data, error } = await supabase.from('stores').select('id, name, logo_url').eq('id', entityId).single();
    if (error) throw error;
    if (!data.logo_url) throw new Error(`${data.name}: logo_url vazio.`);
    return {
      table: 'stores', field: 'logo_url', bucket: 'logos', id: data.id, name: data.name,
      storeId: data.id, currentUrl: data.logo_url, targetPath: `${data.id}/logo.webp`, quality: 90,
    };
  }

  if (type === 'reward') {
    const { data: reward, error } = await supabase.from('fidelity_rewards').select('id, title, image_url, program_id').eq('id', entityId).single();
    if (error) throw error;
    if (!reward.image_url) throw new Error(`${reward.title}: image_url vazio.`);
    const { data: program, error: programError } = await supabase.from('fidelity_programs').select('id, store_id').eq('id', reward.program_id).single();
    if (programError) throw programError;
    return {
      table: 'fidelity_rewards', field: 'image_url', bucket: 'reward-images', id: reward.id, name: reward.title,
      storeId: program.store_id, currentUrl: reward.image_url,
      targetPath: `${program.store_id}/${reward.id}/reward.webp`, quality: 82,
    };
  }

  throw new Error('Tipo inválido. Use --type logo ou --type reward.');
}

async function main() {
  loadLocalEnv();
  const type = getArg('--type');
  const entityId = getArg('--entity-id');
  const confirmation = getArg('--confirm');
  const execute = process.argv.includes('--execute');

  if (!['logo', 'reward'].includes(type)) throw new Error('Informe --type logo ou --type reward.');
  if (!entityId) throw new Error('Informe --entity-id.');
  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== entityId) throw new Error('Confirmação inválida. Repita o UUID em --confirm.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY localmente.');
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const entity = await getEntity(supabase, type, entityId);
  const oldPath = normalizeObjectPath(entity.currentUrl, entity.bucket);
  if (!oldPath) throw new Error(`${entity.name}: não foi possível extrair o caminho atual.`);
  if (oldPath === entity.targetPath) throw new Error(`${entity.name}: ativo já usa o caminho determinístico.`);

  const runId = timestamp();
  const reportDir = path.join(reportRoot, `${type}-asset-${entityId}-${runId}`);
  fs.mkdirSync(reportDir, { recursive: true });
  const backupPath = path.join(reportDir, 'backup.json');
  const resultPath = path.join(reportDir, 'result.json');
  fs.writeFileSync(backupPath, JSON.stringify({ createdAt: new Date().toISOString(), type, entity, oldPath }, null, 2), 'utf8');

  const { data: sourceBlob, error: downloadError } = await supabase.storage.from(entity.bucket).download(oldPath);
  if (downloadError) throw downloadError;
  const sourceBuffer = Buffer.from(await sourceBlob.arrayBuffer());
  const metadata = await sharp(sourceBuffer).metadata();
  const optimizedBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: entity.quality })
    .toBuffer();

  const { error: uploadError } = await supabase.storage.from(entity.bucket).upload(entity.targetPath, optimizedBuffer, {
    upsert: true, contentType: 'image/webp', cacheControl: '31536000',
  });
  if (uploadError) throw uploadError;

  const targetDir = path.posix.dirname(entity.targetPath);
  const targetName = path.posix.basename(entity.targetPath);
  const { data: listed, error: listError } = await supabase.storage.from(entity.bucket).list(targetDir, { limit: 100, search: targetName });
  if (listError) throw listError;
  const uploaded = (listed || []).find((item) => item.name === targetName);
  if (!uploaded) throw new Error(`${entity.name}: upload não confirmado no Storage.`);

  const publicUrl = supabase.storage.from(entity.bucket).getPublicUrl(entity.targetPath).data.publicUrl;
  const newUrl = `${publicUrl}?v=${Date.now()}`;
  const { error: updateError } = await supabase.from(entity.table).update({ [entity.field]: newUrl }).eq('id', entity.id);
  if (updateError) throw updateError;

  const { data: verified, error: verifyError } = await supabase.from(entity.table).select(`id, ${entity.field}`).eq('id', entity.id).single();
  if (verifyError) throw verifyError;
  if (verified[entity.field] !== newUrl) throw new Error(`${entity.name}: URL não confirmada após atualização.`);

  const result = {
    completedAt: new Date().toISOString(), type, entityId: entity.id, name: entity.name, bucket: entity.bucket,
    oldPath, newPath: entity.targetPath, oldObjectDeleted: false,
    oldSizeBytes: sourceBuffer.length, newSizeBytes: optimizedBuffer.length,
    originalWidth: metadata.width ?? null, originalHeight: metadata.height ?? null,
    savingBytes: sourceBuffer.length - optimizedBuffer.length,
    savingPercent: Number((((sourceBuffer.length - optimizedBuffer.length) / sourceBuffer.length) * 100).toFixed(1)),
    backupPath,
  };
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`\nMigração concluída: ${entity.name}`);
  console.log(`Antes: ${(sourceBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`Depois: ${(optimizedBuffer.length / 1024).toFixed(1)} KB`);
  console.log(`Economia: ${result.savingPercent}%`);
  console.log('Arquivo antigo preservado: sim');
  console.log(`Resultado: ${resultPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na migração do ativo:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
