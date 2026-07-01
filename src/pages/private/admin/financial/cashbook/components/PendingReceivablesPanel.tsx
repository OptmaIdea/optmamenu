import { useMemo, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CashbookService, type CashbookEntry } from '@/services/cashbookService';
import { formatCurrencyPtBr } from '@/utils/export/formatters';

type PaymentOption = {
  code: string;
  label: string;
};

interface PendingReceivablesPanelProps {
  storeId: string | null;
  entries: CashbookEntry[];
  canConfirm?: boolean;
  onConfirmed?: () => Promise<void> | void;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  { code: 'pix', label: 'Pix' },
  { code: 'cash', label: 'Dinheiro' },
  { code: 'debit_card', label: 'Cartão de débito' },
  { code: 'credit_card', label: 'Cartão de crédito' },
  { code: 'card', label: 'Cartão' },
];

function isPendingReceivable(entry: CashbookEntry) {
  const isCancelled = entry.status === 'cancelled' || entry.status === 'canceled';
  const isPendingPayment =
    entry.payment_method_code === 'pending' ||
    entry.payment_method?.toLowerCase() === 'pending' ||
    entry.affects_balance === false;

  return entry.type === 'sale' && entry.direction === 'in' && !isCancelled && isPendingPayment && Boolean(entry.order_id);
}

function getCustomerName(entry: CashbookEntry) {
  return entry.order?.customer_name || String(entry.metadata?.customer_name || '') || 'Cliente não informado';
}

function getOrderLabel(entry: CashbookEntry) {
  const metadataOrderCode = typeof entry.metadata?.order_code === 'string' ? entry.metadata.order_code : null;
  if (metadataOrderCode) return metadataOrderCode;
  if (entry.description?.includes('PED-')) return entry.description.replace('Venda concluída pelo pedido ', '');
  return entry.order_id || 'Pedido sem código';
}

export default function PendingReceivablesPanel({
  storeId,
  entries,
  canConfirm = false,
  onConfirmed,
}: PendingReceivablesPanelProps) {
  const [selectedPaymentByEntry, setSelectedPaymentByEntry] = useState<Record<string, string>>({});
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const pendingEntries = useMemo(() => {
    return entries
      .filter(isPendingReceivable)
      .sort((a, b) => new Date(b.occurred_at || b.created_at).getTime() - new Date(a.occurred_at || a.created_at).getTime());
  }, [entries]);

  const pendingTotal = useMemo(() => {
    return pendingEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  }, [pendingEntries]);

  async function confirmReceipt(entry: CashbookEntry) {
    if (!storeId || !entry.order_id) return;

    if (!canConfirm) {
      toast.error('Você não tem permissão para confirmar recebimentos pendentes.');
      return;
    }

    const paymentMethodCode = selectedPaymentByEntry[entry.id] || '';
    if (!paymentMethodCode) {
      toast.error('Selecione a forma real de pagamento.');
      return;
    }

    const confirmed = window.confirm(
      `Confirmar recebimento de ${formatCurrencyPtBr(entry.amount)} em ${PAYMENT_OPTIONS.find((option) => option.code === paymentMethodCode)?.label || paymentMethodCode}?`
    );

    if (!confirmed) return;

    try {
      setConfirmingId(entry.id);
      await CashbookService.confirmPendingPayment({
        store_id: storeId,
        order_id: entry.order_id,
        payment_method_code: paymentMethodCode,
        received_at: new Date().toISOString(),
        notes: 'Recebimento confirmado pelo Livro Diário de Caixa.',
        metadata: {
          source: 'cashbook_pending_receivables_panel',
          cashbook_entry_id: entry.id,
        },
      });

      toast.success('Recebimento confirmado.');
      setSelectedPaymentByEntry((current) => {
        const next = { ...current };
        delete next[entry.id];
        return next;
      });
      await onConfirmed?.();
    } catch (error) {
      console.error('Erro ao confirmar recebimento pendente:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao confirmar recebimento.');
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <section className="rounded-3xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <Clock size={18} />
            <h2 className="text-sm font-black uppercase tracking-widest">Pendentes de recebimento</h2>
          </div>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-200/80">
            Vendas registradas como pendentes não compõem o saldo até a confirmação do recebimento.
          </p>
        </div>

        <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-xs dark:bg-gray-900">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total pendente</p>
          <p className="text-xl font-black text-amber-700 dark:text-amber-300">{formatCurrencyPtBr(pendingTotal)}</p>
        </div>
      </div>

      {pendingEntries.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-white/70 p-6 text-center text-sm font-bold text-amber-700 dark:border-amber-900/50 dark:bg-gray-900/50 dark:text-amber-200">
          Nenhum recebimento pendente no momento.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pendingEntries.map((entry) => {
            const selectedPayment = selectedPaymentByEntry[entry.id] || '';
            const isConfirming = confirmingId === entry.id;

            return (
              <div
                key={entry.id}
                className="rounded-2xl border border-amber-100 bg-white p-4 shadow-xs dark:border-amber-900/40 dark:bg-gray-900"
              >
                <div className="grid gap-3 md:grid-cols-[1fr_150px_220px_auto] md:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-gray-400">{getOrderLabel(entry)}</p>
                    <p className="mt-1 font-black text-gray-900 dark:text-white">{getCustomerName(entry)}</p>
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400">
                      {new Date(entry.occurred_at || entry.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Valor</p>
                    <p className="text-lg font-black text-amber-700 dark:text-amber-300">{formatCurrencyPtBr(entry.amount)}</p>
                  </div>

                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Forma recebida</span>
                    <select
                      value={selectedPayment}
                      onChange={(event) =>
                        setSelectedPaymentByEntry((current) => ({ ...current, [entry.id]: event.target.value }))
                      }
                      disabled={!canConfirm || isConfirming}
                      className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none transition focus:border-amber-500 disabled:opacity-60 dark:border-amber-900/60 dark:bg-gray-950 dark:text-gray-100"
                    >
                      <option value="">Selecione</option>
                      {PAYMENT_OPTIONS.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    onClick={() => confirmReceipt(entry)}
                    disabled={!canConfirm || isConfirming || !selectedPayment}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isConfirming ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Confirmar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canConfirm && pendingEntries.length > 0 && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-gray-900/50 dark:text-amber-200">
          Você pode visualizar os recebíveis pendentes, mas não tem permissão para oficializar recebimentos.
        </p>
      )}
    </section>
  );
}
