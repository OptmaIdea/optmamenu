#!/usr/bin/env node
/*
 * Reparo direto para estorno de transferência recebida.
 *
 * Em vez de depender de stockService.reverseReceivedStockTransfer no objeto exportado,
 * este script cria/garante uma função exportada independente em stockService.ts
 * e altera TransferDetailPage.tsx para importá-la diretamente.
 *
 * Uso:
 *   node scripts/apply_transfer_reversal_direct_import.cjs
 */

const fs = require('fs');
const path = require('path');

const servicePath = path.join(process.cwd(), 'src/services/stockService.ts');
const detailPath = path.join(process.cwd(), 'src/pages/private/admin/products/inventory/TransferDetailPage.tsx');

function fail(message) {
  console.error(`\n[transfer-reversal-direct-import] ${message}\n`);
  process.exit(1);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

let service = read(servicePath);
let detail = read(detailPath);
let changed = false;

const cancelResultType = `export type CancelStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  cancelled_at: string;
};`;

if (!service.includes('export type ReverseReceivedStockTransferResult')) {
  if (!service.includes(cancelResultType)) {
    fail('Não encontrei CancelStockTransferResult em stockService.ts.');
  }

  service = service.replace(
    cancelResultType,
    `${cancelResultType}

export type ReverseReceivedStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  reversed_at: string;
  total_reversed: number;
};`
  );
  changed = true;
}

if (!service.includes('export async function reverseReceivedStockTransfer(')) {
  const serviceAnchor = `export const stockService = {`;
  if (!service.includes(serviceAnchor)) {
    fail('Não encontrei export const stockService = { em stockService.ts.');
  }

  const directFunction = `export async function reverseReceivedStockTransfer(input: {
  transferId: string;
  reason: string;
}): Promise<ReverseReceivedStockTransferResult> {
  const { data, error } = await supabase.rpc('reverse_received_stock_transfer', {
    p_transfer_id: input.transferId,
    p_reason: input.reason,
  });
  if (error) throw error;
  const rows = normalizeRows<ReverseReceivedStockTransferResult>(data);
  if (!rows[0]) throw new Error('A transferência recebida não foi estornada.');
  return rows[0];
}

`;

  service = service.replace(serviceAnchor, `${directFunction}${serviceAnchor}`);
  changed = true;
}

const oldImport = `import { stockService } from '@/services/stockService';`;
const newImport = `import { stockService, reverseReceivedStockTransfer } from '@/services/stockService';`;

if (detail.includes(oldImport)) {
  detail = detail.replace(oldImport, newImport);
  changed = true;
} else if (!detail.includes(`reverseReceivedStockTransfer } from '@/services/stockService'`) && !detail.includes(`reverseReceivedStockTransfer } from "@/services/stockService"`)) {
  fail('Não encontrei o import de stockService em TransferDetailPage.tsx para adicionar reverseReceivedStockTransfer.');
}

detail = detail.replace(
  /stockService\.reverseReceivedStockTransfer\(/g,
  'reverseReceivedStockTransfer('
);

if (detail.includes('reverseReceivedStockTransfer(')) {
  changed = true;
}

if (changed) {
  write(servicePath, service);
  write(detailPath, detail);
  console.log('[transfer-reversal-direct-import] Estorno ajustado com import direto.');
} else {
  console.log('[transfer-reversal-direct-import] Nenhuma alteração necessária; import direto já parece aplicado.');
}
