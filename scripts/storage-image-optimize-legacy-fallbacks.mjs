#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const reportRoot = path.join(projectRoot, 'reports', 'storage-images');

const targets = [
  {
    key: 'product',
    bucket: 'products',
    objectPath: 'imagem-nao-disponvel-fallback-gelinhares.png',
    maxWidth: 800,
    maxHeight: 800,
  },
  {
    key: 'reward',
    bucket: 'reward-images',
    objectPath: '0abba741-0f77-4783-8cf8-58811cf7343b/logo-gelinhares.png',
    maxWidth: 800,
    maxHeight: 800,
  },
];

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

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main() {
  loadLocalEnv();

  const execute = process.argv.includes('--execute');
  const confirmationIndex = process.argv.indexOf('--confirm');
  const confirmation = confirmationIndex >= 0 ? process.argv[confirmationIndex + 1] : null;

  if (!execute) throw new Error('Execução bloqueada. Informe --execute.');
  if (confirmation !== 'OPTIMIZE_LEGACY_FALLBACKS') throw new Error('Confirmação inválida.');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Defina SUPABASE_URL/VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY localmente.');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runDir = path.join(reportRoot, `legacy-fallbacks-${timestamp()}`);
  fs.mkdirSync(runDir, { recursive: true });

  const report = {
    startedAt: new Date().toISOString(),
    mode: 'optimize-legacy-fallbacks',
    writeOperationsPerformed: false,
    results: [],
  };

  for (const target of targets) {
    const { data: originalBlob, error: downloadError } = await supabase.storage
      .from(target.bucket)
      .download(target.objectPath);
    if (downloadError || !originalBlob) {
      throw downloadError || new Error(`${target.key}: arquivo original não encontrado.`);
    }

    const originalBuffer = Buffer.from(await originalBlob.arrayBuffer());
    const metadata = await sharp(originalBuffer).metadata();
    const backupPath = path.join(runDir, `${target.key}-original.png`);
    fs.writeFileSync(backupPath, originalBuffer);

    const optimizedBuffer = await sharp(originalBuffer)
      .rotate()
      .resize({
        width: target.maxWidth,
        height: target.maxHeight,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9, palette: true, quality: 90 })
      .toBuffer();

    if (optimizedBuffer.length >= originalBuffer.length) {
      report.results.push({
        key: target.key,
        bucket: target.bucket,
        objectPath: target.objectPath,
        status: 'skipped-no-saving',
        originalSizeBytes: originalBuffer.length,
        optimizedSizeBytes: optimizedBuffer.length,
        backupPath,
      });
      continue;
    }

    const { error: uploadError } = await supabase.storage.from(target.bucket).upload(
      target.objectPath,
      optimizedBuffer,
      {
        upsert: true,
        contentType: 'image/png',
        cacheControl: '3600',
      },
    );
    if (uploadError) throw uploadError;

    const { data: verificationBlob, error: verificationError } = await supabase.storage
      .from(target.bucket)
      .download(target.objectPath);
    if (verificationError || !verificationBlob) {
      throw verificationError || new Error(`${target.key}: falha ao reler o arquivo otimizado.`);
    }

    const verifiedBuffer = Buffer.from(await verificationBlob.arrayBuffer());
    if (verifiedBuffer.length !== optimizedBuffer.length) {
      throw new Error(`${target.key}: tamanho pós-upload divergente.`);
    }

    report.writeOperationsPerformed = true;
    report.results.push({
      key: target.key,
      bucket: target.bucket,
      objectPath: target.objectPath,
      status: 'optimized-in-place',
      originalSizeBytes: originalBuffer.length,
      optimizedSizeBytes: optimizedBuffer.length,
      savingBytes: originalBuffer.length - optimizedBuffer.length,
      savingPercent: Number((((originalBuffer.length - optimizedBuffer.length) / originalBuffer.length) * 100).toFixed(1)),
      originalWidth: metadata.width || null,
      originalHeight: metadata.height || null,
      backupPath,
    });
  }

  report.completedAt = new Date().toISOString();
  report.summary = {
    targets: report.results.length,
    optimized: report.results.filter((item) => item.status === 'optimized-in-place').length,
    skipped: report.results.filter((item) => item.status !== 'optimized-in-place').length,
    savingBytes: report.results.reduce((sum, item) => sum + (item.savingBytes || 0), 0),
  };

  const reportPath = path.join(runDir, 'result.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\nFallbacks legados otimizados com segurança');
  console.log(`Arquivos otimizados: ${report.summary.optimized}`);
  console.log(`Economia total: ${report.summary.savingBytes} bytes`);
  console.log(`Relatório: ${reportPath}\n`);
}

main().catch((error) => {
  console.error('\nFalha na otimização dos fallbacks legados:');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
