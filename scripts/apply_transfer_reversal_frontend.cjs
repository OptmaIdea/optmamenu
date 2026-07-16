#!/usr/bin/env node
/*
 * Liga o front ao fluxo de estorno de transferência recebida.
 *
 * Uso:
 *   node scripts/apply_transfer_reversal_frontend.cjs
 *
 * Altera:
 * - src/services/stockService.ts
 * - src/pages/private/admin/products/inventory/TransferDetailPage.tsx
 */

const fs = require('fs');
const path = require('path');

const servicePath = path.join(process.cwd(), 'src/services/stockService.ts');
const detailPath = path.join(process.cwd(), 'src/pages/private/admin/products/inventory/TransferDetailPage.tsx');

function fail(message) {
  console.error(`\n[transfer-reversal-frontend] ${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[transfer-reversal-frontend] Aviso: ${message}`);
}

function read(filePath) {
  if (!fs.existsSync(filePath)) fail(`Arquivo não encontrado: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
}

function write(filePath, source) {
  fs.writeFileSync(filePath, source, 'utf8');
}

function replaceOnce(source, search, replacement, label, alreadyAppliedNeedle = replacement) {
  if (source.includes(alreadyAppliedNeedle)) return { source, changed: false };
  if (!source.includes(search)) {
    warn(`trecho não encontrado para: ${label}; pode já estar aplicado ou variar nesta versão.`);
    return { source, changed: false };
  }
  return { source: source.replace(search, replacement), changed: true };
}

let service = read(servicePath);
let detail = read(detailPath);
let changedService = false;
let changedDetail = false;

// 1) stockService: tipo de retorno.
{
  const result = replaceOnce(
    service,
    `export type CancelStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  cancelled_at: string;
};`,
    `export type CancelStockTransferResult = {
  transfer_id: string;
  transfer_code: string;
  status: string;
  cancelled_at: string;
};

export type ReverseReceivedStockTransferResult = {
  transfer_id: string;
  transfer_code: string | null;
  status: string;
  reversed_at: string;
  total_reversed: number;
};`,
    'tipo ReverseReceivedStockTransferResult',
    'export type ReverseReceivedStockTransferResult = {'
  );
  service = result.source;
  changedService = changedService || result.changed;
}

// 2) stockService: método da RPC.
{
  const result = replaceOnce(
    service,
    `  async cancelStockTransfer(input: {
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
  },`,
    `  async cancelStockTransfer(input: {
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
  },

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
    if (!rows[0]) throw new Error('A transferência não foi estornada.');
    return rows[0];
  },`,
    'método reverseReceivedStockTransfer',
    'reverseReceivedStockTransfer(input:'
  );
  service = result.source;
  changedService = changedService || result.changed;
}

// 3) Detalhe: ícone.
{
  const result = replaceOnce(
    detail,
    `import { ArrowLeft, CheckCircle2, Send, XCircle } from 'lucide-react';`,
    `import { ArrowLeft, CheckCircle2, RotateCcw, Send, XCircle } from 'lucide-react';`,
    'import RotateCcw',
    'RotateCcw'
  );
  detail = result.source;
  changedDetail = changedDetail || result.changed;
}

// 4) Detalhe: handler do estorno, logo após cancelamento.
{
  const result = replaceOnce(
    detail,
    `    const handleReceiveTransfer = async () => {`,
    `    const handleReverseReceivedTransfer = async () => {
        if (!transfer?.id) return;

        if (!canCancelTransfers) {
            toast.error('Você não tem permissão para estornar transferências recebidas.');
            return;
        }

        const reason = window.prompt('Informe o motivo do estorno do recebimento:');
        if (!reason?.trim()) {
            toast.warning('Informe o motivo do estorno.');
            return;
        }

        const confirmed = window.confirm(
            'Estornar o recebimento desta transferência? O sistema vai retirar o saldo do destino e devolver para a origem, mantendo o histórico.'
        );
        if (!confirmed) return;

        try {
            setActionLoading(true);
            const result = await stockService.reverseReceivedStockTransfer({
                transferId: transfer.id,
                reason: reason.trim(),
            });
            toast.success(\`Transferência \${result.transfer_code ?? transfer.transfer_code ?? ''} estornada com sucesso.\`);
            await Promise.all([refresh(), refetchTransferTimeline()]);
        } catch (error: any) {
            console.error('Erro ao estornar transferência recebida:', error);
            toast.error(error?.message ?? 'Não foi possível estornar a transferência recebida.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReceiveTransfer = async () => {`,
    'handler handleReverseReceivedTransfer',
    'const handleReverseReceivedTransfer = async () => {'
  );
  detail = result.source;
  changedDetail = changedDetail || result.changed;
}

// 5) Detalhe: botão no portal para status received.
{
  const result = replaceOnce(
    detail,
    `                    {transfer.status === 'shipped' && canConfirmTransfers && (
                        <button
                            type="button"
                            onClick={() => setShowReceiveForm((v) => !v)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
                        >
                            <CheckCircle2 size={13} />
                            <span>Receber</span>
                        </button>
                    )}

                    <button`,
    `                    {transfer.status === 'shipped' && canConfirmTransfers && (
                        <button
                            type="button"
                            onClick={() => setShowReceiveForm((v) => !v)}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
                        >
                            <CheckCircle2 size={13} />
                            <span>Receber</span>
                        </button>
                    )}

                    {transfer.status === 'received' && canCancelTransfers && (
                        <button
                            type="button"
                            onClick={handleReverseReceivedTransfer}
                            disabled={actionLoading}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                        >
                            <RotateCcw size={13} />
                            <span>Estornar recebimento</span>
                        </button>
                    )}

                    <button`,
    'botão Estornar recebimento',
    'Estornar recebimento'
  );
  detail = result.source;
  changedDetail = changedDetail || result.changed;
}

// 6) Aviso de leitura em transferência recebida sem permissão.
{
  const result = replaceOnce(
    detail,
    `            <TransferItemsTable items={items} />`,
    `            {transfer.status === 'received' && !canCancelTransfers && (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    Você pode visualizar esta transferência recebida, mas não tem permissão para estornar o recebimento.
                </p>
            )}

            <TransferItemsTable items={items} />`,
    'aviso sem permissão para estornar',
    'não tem permissão para estornar o recebimento'
  );
  detail = result.source;
  changedDetail = changedDetail || result.changed;
}

if (changedService) write(servicePath, service);
if (changedDetail) write(detailPath, detail);

if (changedService || changedDetail) {
  console.log('[transfer-reversal-frontend] Front de estorno de transferência atualizado.');
} else {
  console.log('[transfer-reversal-frontend] Nenhuma alteração necessária; ajustes já parecem aplicados.');
}
