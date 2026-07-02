import { useEffect, useMemo, useState } from 'react';
import { Calculator, CheckCircle2, RefreshCw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { CashbookService, type CashbookDayClosingPreview } from '@/services/cashbookService';
import { formatCurrencyPtBr } from '@/utils/export/formatters';

const DENOMINATIONS = [
  0.05,
  0.1,
  0.25,
  0.5,
  1,
  2,
  5,
  10,
  20,
  50,
  100,
  200,
] as const;

type DenominationValue = (typeof DENOMINATIONS)[number];

type DenominationCounts = Record<string, number>;

interface DayClosingPanelProps {
  storeId: string | null;
  canClose?: boolean;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeNumber(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function differenceClass(value: number) {
  if (Math.abs(value) < 0.005) return 'text-emerald-600 dark:text-emerald-300';
  if (value > 0) return 'text-blue-600 dark:text-blue-300';
  return 'text-rose-600 dark:text-rose-300';
}

export default function DayClosingPanel({ storeId, canClose = false }: DayClosingPanelProps) {
  const [closingDate, setClosingDate] = useState(todayIsoDate());
  const [preview, setPreview] = useState<CashbookDayClosingPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'closed' | null>(null);
  const [counts, setCounts] = useState<DenominationCounts>({});
  const [confirmedPix, setConfirmedPix] = useState('');
  const [confirmedDebit, setConfirmedDebit] = useState('');
  const [confirmedCredit, setConfirmedCredit] = useState('');
  const [confirmedOther, setConfirmedOther] = useState('');
  const [notes, setNotes] = useState('');

  const countedCashTotal = useMemo(() => {
    return DENOMINATIONS.reduce((sum, denomination) => {
      const quantity = Number(counts[String(denomination)] || 0);
      return sum + quantity * denomination;
    }, 0);
  }, [counts]);

  const confirmedPixTotal = normalizeNumber(confirmedPix);
  const confirmedDebitTotal = normalizeNumber(confirmedDebit);
  const confirmedCreditTotal = normalizeNumber(confirmedCredit);
  const confirmedOtherTotal = normalizeNumber(confirmedOther);

  const expected = preview?.expected;
  const confirmedTotal = countedCashTotal + confirmedPixTotal + confirmedDebitTotal + confirmedCreditTotal + confirmedOtherTotal;
  const expectedTotal = expected?.total || 0;

  const differences = {
    cash: countedCashTotal - (expected?.cash || 0),
    pix: confirmedPixTotal - (expected?.pix || 0),
    debit: confirmedDebitTotal - (expected?.debit_card || 0),
    credit: confirmedCreditTotal - (expected?.credit_card || 0),
    other: confirmedOtherTotal - (expected?.other || 0),
    total: confirmedTotal - expectedTotal,
  };

  async function loadPreview() {
    if (!storeId) return;

    try {
      setLoadingPreview(true);
      const result = await CashbookService.getDayClosingPreview(storeId, closingDate);
      setPreview(result);

      if (result.existing_closing) {
        setCounts(result.existing_closing.counted_denominations || {});
        setConfirmedPix(String(result.existing_closing.confirmed_pix_total || ''));
        setConfirmedDebit(String(result.existing_closing.confirmed_debit_card_total || ''));
        setConfirmedCredit(String(result.existing_closing.confirmed_credit_card_total || ''));
        setConfirmedOther(String(result.existing_closing.confirmed_other_total || ''));
        setNotes(result.existing_closing.notes || '');
      }
    } catch (error) {
      console.error('Erro ao carregar prévia de fechamento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar prévia do fechamento.');
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, closingDate]);

  function updateCount(denomination: DenominationValue, value: string) {
    const quantity = Math.max(0, Math.floor(Number(value || 0)));
    setCounts((current) => ({ ...current, [String(denomination)]: quantity }));
  }

  async function save(status: 'draft' | 'closed') {
    if (!storeId) return;

    if (!canClose) {
      toast.error('Você não tem permissão para salvar o fechamento do caixa.');
      return;
    }

    if (status === 'closed' && Math.abs(differences.total) >= 0.01 && !notes.trim()) {
      toast.error('Informe uma observação para fechar caixa com divergência.');
      return;
    }

    const confirmationText =
      status === 'closed'
        ? 'Fechar o caixa do dia com os valores conferidos?'
        : 'Salvar rascunho do fechamento do caixa?';

    if (!window.confirm(confirmationText)) return;

    try {
      setSaving(status);
      await CashbookService.saveDayClosing({
        store_id: storeId,
        closing_date: closingDate,
        counted_denominations: counts,
        counted_cash_total: countedCashTotal,
        confirmed_pix_total: confirmedPixTotal,
        confirmed_debit_card_total: confirmedDebitTotal,
        confirmed_credit_card_total: confirmedCreditTotal,
        confirmed_other_total: confirmedOtherTotal,
        notes: notes || null,
        status,
        metadata: {
          source: 'cashbook_day_closing_panel',
          expected_snapshot: preview?.expected || null,
          pending_snapshot: preview?.pending || null,
          cancelled_snapshot: preview?.cancelled || null,
        },
      });

      toast.success(status === 'closed' ? 'Caixa fechado com sucesso.' : 'Rascunho salvo.');
      await loadPreview();
    } catch (error) {
      console.error('Erro ao salvar fechamento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar fechamento.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="rounded-3xl border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900/50 dark:bg-teal-950/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
            <Calculator size={18} />
            <h2 className="text-sm font-black uppercase tracking-widest">Fechamento do caixa do dia</h2>
          </div>
          <p className="mt-1 text-sm text-teal-800/80 dark:text-teal-200/80">
            Confira dinheiro físico, Pix e cartões antes de fechar o expediente.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Data</span>
            <input
              type="date"
              value={closingDate}
              onChange={(event) => setClosingDate(event.target.value)}
              className="rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-teal-900/60 dark:bg-gray-950 dark:text-gray-100"
            />
          </label>
          <button
            type="button"
            onClick={loadPreview}
            disabled={loadingPreview}
            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-black text-teal-700 transition hover:bg-teal-50 disabled:opacity-60 dark:border-teal-900/60 dark:bg-gray-900 dark:text-teal-300 dark:hover:bg-teal-950/40 sm:mt-5"
          >
            <RefreshCw size={16} className={loadingPreview ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Dinheiro esperado', expected?.cash || 0],
          ['Pix esperado', expected?.pix || 0],
          ['Débito esperado', expected?.debit_card || 0],
          ['Crédito esperado', expected?.credit_card || 0],
          ['Total esperado', expectedTotal],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4 shadow-xs dark:bg-gray-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
            <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(Number(value))}</p>
          </div>
        ))}
      </div>

      {(preview?.pending.count || preview?.cancelled.count) ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="text-[10px] font-black uppercase tracking-widest">Pendentes no dia</p>
            <p className="mt-1 text-lg font-black">{preview?.pending.count || 0} item(ns) · {formatCurrencyPtBr(preview?.pending.total || 0)}</p>
            <p className="mt-1 text-xs font-bold opacity-80">Não entram no realizado do fechamento.</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">
            <p className="text-[10px] font-black uppercase tracking-widest">Cancelados no dia</p>
            <p className="mt-1 text-lg font-black">{preview?.cancelled.count || 0} item(ns) · {formatCurrencyPtBr(preview?.cancelled.total || 0)}</p>
            <p className="mt-1 text-xs font-bold opacity-80">Apenas informativo, não compõe saldo.</p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Conferência de dinheiro</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                  <th className="py-2">Nota/moeda</th>
                  <th className="py-2">Qtde</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {DENOMINATIONS.map((denomination) => {
                  const quantity = Number(counts[String(denomination)] || 0);
                  const lineTotal = quantity * denomination;

                  return (
                    <tr key={denomination} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-2 font-black text-gray-700 dark:text-gray-200">{formatCurrencyPtBr(denomination)}</td>
                      <td className="py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={quantity || ''}
                          onChange={(event) => updateCount(denomination, event.target.value)}
                          className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                      </td>
                      <td className="py-2 text-right font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                  <td colSpan={2} className="py-3 text-sm font-black text-gray-500 dark:text-gray-400">Total em caixa dinheiro</td>
                  <td className="py-3 text-right text-lg font-black text-teal-700 dark:text-teal-300">{formatCurrencyPtBr(countedCashTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Conferência externa</h3>
            <div className="mt-4 grid gap-3">
              {[
                ['Total em Pix', confirmedPix, setConfirmedPix, 'Conferir nos bancos/extratos'],
                ['Total em cartões de débito', confirmedDebit, setConfirmedDebit, 'Conferir nas máquinas'],
                ['Total em cartões de crédito', confirmedCredit, setConfirmedCredit, 'Conferir nas máquinas'],
                ['Outros recebimentos', confirmedOther, setConfirmedOther, 'Quando houver'],
              ].map(([label, value, setter, hint]) => (
                <label key={String(label)} className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{String(label)}</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={String(value)}
                    onChange={(event) => (setter as (next: string) => void)(event.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                  <span className="text-xs font-semibold text-gray-400">{String(hint)}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Diferenças</h3>
            <div className="mt-4 space-y-2 text-sm font-bold">
              {[
                ['Dinheiro', differences.cash],
                ['Pix', differences.pix],
                ['Débito', differences.debit],
                ['Crédito', differences.credit],
                ['Outros', differences.other],
                ['Total', differences.total],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-950">
                  <span className="text-gray-500 dark:text-gray-400">{String(label)}</span>
                  <span className={`font-black ${differenceClass(Number(value))}`}>{formatCurrencyPtBr(Number(value))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <label className="mt-5 block space-y-1">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Observação</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          placeholder="Informe observações sobre divergências, conferência das máquinas ou banco."
          className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
        />
      </label>

      {preview?.existing_closing && (
        <p className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          Já existe fechamento para esta data com status {preview.existing_closing.status}. Salvar novamente atualizará o registro da mesma data.
        </p>
      )}

      {!canClose && (
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          Você pode visualizar a prévia, mas não tem permissão para salvar ou fechar o caixa.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => save('draft')}
          disabled={!canClose || saving !== null || loadingPreview}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-black text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-teal-900/60 dark:bg-gray-900 dark:text-teal-300 dark:hover:bg-teal-950/40"
        >
          {saving === 'draft' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar rascunho
        </button>
        <button
          type="button"
          onClick={() => save('closed')}
          disabled={!canClose || saving !== null || loadingPreview}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving === 'closed' ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
          Fechar caixa
        </button>
      </div>
    </section>
  );
}
