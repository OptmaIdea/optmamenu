#!/usr/bin/env node
/*
 * Reparo V2 do stockService para garantir que reverseReceivedStockTransfer
 * esteja dentro do objeto exportado stockService, não apenas declarado no arquivo.
 *
 * Uso:
 *   node scripts/repair_stock_service_transfer_reversal_v2.cjs
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'src/services/stockService.ts');

function fail(message) {
  console.error(`\n[stock-service-transfer-reversal-v2] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  fail(`Arquivo não encontrado: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

const cancelResultType = `export type CancelStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  cancelled_at: string;
};`;

if (!source.includes('export type ReverseReceivedStockTransferResult')) {
  if (!source.includes(cancelResultType)) {
    fail('Não encontrei CancelStockTransferResult para inserir ReverseReceivedStockTransferResult.');
  }

  source = source.replace(
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

const serviceStart = source.indexOf('export const stockService = {');
if (serviceStart === -1) {
  fail('Não encontrei export const stockService = {.');
}

const getPurchaseAnchor = `

  async getPurchaseSuggestionsByStore(`;
const getPurchaseIndex = source.indexOf(getPurchaseAnchor, serviceStart);
if (getPurchaseIndex === -1) {
  fail('Não encontrei o ponto de inserção antes de getPurchaseSuggestionsByStore.');
}

const serviceSliceBeforePurchases = source.slice(serviceStart, getPurchaseIndex);
const methodInsideService = serviceSliceBeforePurchases.includes('reverseReceivedStockTransfer');

if (!methodInsideService) {
  const cancelMethod = `  async cancelStockTransfer(input: {
    transferId: string;
    reason: string;
  }): Promise<CancelStockTransferResult> {
    const { data, error } = await supabase.rpc('cancel_stock_transfer', {
      p_transfer_id: input.transferId,
      p_cancel_reason: input.reason,
    });
    if (error) throw error;
    const rows = normalizeRows<CancelStockTransferResult>(data);
    if (!rows[0]) throw new Error('A transferência não foi cancelada.');
    return rows[0];
  },`;

  const insertMethod = `${cancelMethod}

  async reverseReceivedStockTransfer(input: {
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
  },`;

  const cancelIndex = source.indexOf(cancelMethod, serviceStart);
  if (cancelIndex !== -1 && cancelIndex < getPurchaseIndex) {
    source = source.slice(0, cancelIndex) + insertMethod + source.slice(cancelIndex + cancelMethod.length);
  } else {
    source = source.slice(0, getPurchaseIndex) + `

  async reverseReceivedStockTransfer(input: {
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
  },` + source.slice(getPurchaseIndex);
  }

  changed = true;
}

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[stock-service-transfer-reversal-v2] stockService.ts reparado; método garantido dentro de stockService.');
} else {
  console.log('[stock-service-transfer-reversal-v2] Nenhuma alteração necessária; método já está dentro de stockService.');
}
