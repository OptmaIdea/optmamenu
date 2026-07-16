#!/usr/bin/env node
/*
 * Repara o stockService para expor reverseReceivedStockTransfer dentro do objeto stockService.
 *
 * Uso:
 *   node scripts/repair_stock_service_transfer_reversal.cjs
 */

const fs = require('fs');
const path = require('path');

const targetPath = path.join(process.cwd(), 'src/services/stockService.ts');

function fail(message) {
  console.error(`\n[stock-service-transfer-reversal] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(targetPath)) {
  fail(`Arquivo não encontrado: ${targetPath}`);
}

let source = fs.readFileSync(targetPath, 'utf8').replace(/\r\n/g, '\n');
let changed = false;

if (!source.includes('export type ReverseReceivedStockTransferResult')) {
  const anchor = `export type CancelStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  cancelled_at: string;
};`;

  const insertion = `${anchor}

export type ReverseReceivedStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  reversed_at: string;
  total_reversed: number;
};`;

  if (!source.includes(anchor)) {
    fail('Não encontrei o bloco CancelStockTransferResult para inserir o tipo de estorno.');
  }

  source = source.replace(anchor, insertion);
  changed = true;
}

if (!source.includes('async reverseReceivedStockTransfer(')) {
  const anchor = `  async cancelStockTransfer(input: {
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

  const replacement = `${anchor}

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

  if (!source.includes(anchor)) {
    fail('Não encontrei o bloco cancelStockTransfer dentro do objeto stockService.');
  }

  source = source.replace(anchor, replacement);
  changed = true;
}

if (changed) {
  fs.writeFileSync(targetPath, source, 'utf8');
  console.log('[stock-service-transfer-reversal] stockService.ts reparado com reverseReceivedStockTransfer.');
} else {
  console.log('[stock-service-transfer-reversal] Nenhuma alteração necessária; reverseReceivedStockTransfer já parece existir.');
}
