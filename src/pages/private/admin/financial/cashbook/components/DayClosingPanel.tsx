import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calculator, CheckCircle2, ChevronDown, ChevronUp, Eye, Plus, RefreshCw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  CashbookService,
  type CashbookClosingStatusResult,
  type CashbookDayClosing,
  type CashbookDayClosingPreview,
} from '@/services/cashbookService';
import {
  CashbookDiscrepancyService,
  type CashbookDiscrepancy,
} from '@/services/cashbookDiscrepancyService';
import { formatCurrencyPtBr } from '@/utils/export/formatters';
import CashbookOccurrenceResolutionBox from './CashbookOccurrenceResolutionBox';

const DENOMINATIONS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 200] as const;
const DEFAULT_LOOKBACK_DAYS = 120;
const DEFAULT_ALLOWED_OPEN_DAYS = 3;

type DenominationValue = (typeof DENOMINATIONS)[number];
type DenominationCounts = Record<string, number>;
type ExternalMethodKey = 'pix' | 'debit' | 'credit' | 'other';
type PanelMode = 'closing' | 'history';
type ExternalDetailItem = { id: string; label: string; amount: string };
type ExternalDetails = Record<ExternalMethodKey, ExternalDetailItem[]>;

interface DayClosingPanelProps {
  storeId: string | null;
  canClose?: boolean;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDatePtBr(date: string | null | undefined) {
  if (!date) return '—';
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function normalizeNumber(value: string | number | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[R$\s]/g, '').replace(/[^0-9,.-]/g, '');
  const normalized = cleaned.includes(',') ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function emptyExternalDetails(): ExternalDetails {
  return { pix: [], debit: [], credit: [], other: [] };
}

function createExternalDetail(): ExternalDetailItem {
  return { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, label: '', amount: '' };
}

function differenceClass(value: number) {
  if (Math.abs(value) < 0.005) return 'text-emerald-600 dark:text-emerald-300';
  if (value > 0) return 'text-blue-600 dark:text-blue-300';
  return 'text-rose-600 dark:text-rose-300';
}

function externalDetailTotal(items: ExternalDetailItem[]) {
  return items.reduce((sum, item) => sum + normalizeNumber(item.amount), 0);
}

function serializeExternalDetails(details: ExternalDetails) {
  return (['pix', 'debit', 'credit', 'other'] as ExternalMethodKey[]).reduce((acc, method) => {
    acc[method] = {
      total: externalDetailTotal(details[method]),
      items: details[method]
        .filter((item) => item.label.trim() || item.amount.trim())
        .map((item) => ({
          label: item.label.trim(),
          amount: item.amount,
          amount_value: normalizeNumber(item.amount),
        })),
    };
    return acc;
  }, {} as Record<ExternalMethodKey, { total: number; items: Array<{ label: string; amount: string; amount_value: number }> }>);
}

function restoreExternalDetails(metadata: Record<string, unknown> | null | undefined): ExternalDetails {
  const details = metadata?.external_conference_details;
  if (!details || typeof details !== 'object') return emptyExternalDetails();
  const restored = emptyExternalDetails();

  (['pix', 'debit', 'credit', 'other'] as ExternalMethodKey[]).forEach((method) => {
    const methodDetails = (details as Record<string, unknown>)[method];
    if (!methodDetails || typeof methodDetails !== 'object') return;
    const items = (methodDetails as Record<string, unknown>).items;
    if (!Array.isArray(items)) return;

    restored[method] = items.map((item) => {
      const itemRecord = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      return {
        id: createExternalDetail().id,
        label: String(itemRecord.label || ''),
        amount: String(itemRecord.amount || itemRecord.amount_value || ''),
      };
    });
  });

  return restored;
}

function getExternalDetailItems(metadata: Record<string, unknown> | null | undefined, method: ExternalMethodKey) {
  const details = metadata?.external_conference_details;
  if (!details || typeof details !== 'object') return [];
  const methodDetails = (details as Record<string, unknown>)[method];
  if (!methodDetails || typeof methodDetails !== 'object') return [];
  const items = (methodDetails as Record<string, unknown>).items;
  return Array.isArray(items) ? items : [];
}

function metadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return value === true || value === 'true';
}

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string, fallback = '') {
  const value = metadata?.[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function getDivergenceInfo(closing: CashbookDayClosing) {
  const metadata = closing.metadata || {};
  const hasDivergence = metadataBoolean(metadata, 'has_divergence') || Math.abs(Number(closing.difference_total || 0)) >= 0.01;
  const type = hasDivergence ? metadataString(metadata, 'divergence_type', closing.difference_total < 0 ? 'shortage' : 'surplus') : 'none';
  const level = hasDivergence ? metadataString(metadata, 'divergence_level', 'relevant') : 'none';
  const occurrenceRequired = metadataBoolean(metadata, 'occurrence_required') || hasDivergence;
  const typeLabel = type === 'shortage' ? 'Falta' : type === 'surplus' ? 'Sobra' : 'Sem divergência';
  const levelLabel = level === 'critical' ? 'Crítica' : level === 'relevant' ? 'Relevante' : level === 'low' ? 'Leve' : 'Nenhuma';
  const className =
    level === 'critical'
      ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200'
      : level === 'relevant'
        ? 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200'
        : level === 'low'
          ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200';
  return { hasDivergence, occurrenceRequired, typeLabel, levelLabel, className };
}

function occurrenceStatusLabel(status: string) {
  const labels: Record<string, string> = {
    open: 'Aberta',
    waiting_external_confirmation: 'Aguardando confirmação externa',
    under_review: 'Em análise',
    resolved: 'Resolvida',
    cancelled: 'Cancelada',
    converted_to_loss: 'Convertida em perda',
    converted_to_adjustment: 'Ajuste autorizado',
  };
  return labels[status] || status;
}

export default function DayClosingPanel({ storeId, canClose = false }: DayClosingPanelProps) {
  const [mode, setMode] = useState<PanelMode>('closing');
  const [showOpenDays, setShowOpenDays] = useState(true);
  const [selectedClosing, setSelectedClosing] = useState<CashbookDayClosing | null>(null);
  const [closingDate, setClosingDate] = useState(todayIsoDate());
  const [preview, setPreview] = useState<CashbookDayClosingPreview | null>(null);
  const [closingStatus, setClosingStatus] = useState<CashbookClosingStatusResult | null>(null);
  const [occurrences, setOccurrences] = useState<CashbookDiscrepancy[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'closed' | null>(null);
  const [counts, setCounts] = useState<DenominationCounts>({});
  const [openingCash, setOpeningCash] = useState('');
  const [confirmedPix, setConfirmedPix] = useState('');
  const [confirmedDebit, setConfirmedDebit] = useState('');
  const [confirmedCredit, setConfirmedCredit] = useState('');
  const [confirmedOther, setConfirmedOther] = useState('');
  const [externalDetails, setExternalDetails] = useState<ExternalDetails>(() => emptyExternalDetails());
  const [notes, setNotes] = useState('');

  const openDays = closingStatus?.open_days || [];
  const overdueDays = openDays.filter((day) => day.is_overdue);
  const recentClosings = closingStatus?.recent_closings || [];
  const selectedOpenDay = openDays.find((day) => day.entry_date === closingDate);
  const selectedOccurrence = selectedClosing ? occurrences.find((item) => item.closing_id === selectedClosing.id) : null;
  const isClosedDate = preview?.existing_closing?.status === 'closed';
  const isDraftDate = preview?.existing_closing?.status === 'draft';

  const countedCashTotal = useMemo(
    () => DENOMINATIONS.reduce((sum, denomination) => sum + Number(counts[String(denomination)] || 0) * denomination, 0),
    [counts]
  );

  const detailTotals = useMemo(
    () => ({
      pix: externalDetailTotal(externalDetails.pix),
      debit: externalDetailTotal(externalDetails.debit),
      credit: externalDetailTotal(externalDetails.credit),
      other: externalDetailTotal(externalDetails.other),
    }),
    [externalDetails]
  );

  const confirmedPixTotal = externalDetails.pix.length ? detailTotals.pix : normalizeNumber(confirmedPix);
  const confirmedDebitTotal = externalDetails.debit.length ? detailTotals.debit : normalizeNumber(confirmedDebit);
  const confirmedCreditTotal = externalDetails.credit.length ? detailTotals.credit : normalizeNumber(confirmedCredit);
  const confirmedOtherTotal = externalDetails.other.length ? detailTotals.other : normalizeNumber(confirmedOther);
  const expected = preview?.expected;
  const openingCashTotal = normalizeNumber(openingCash);
  const cashMovement = Number(expected?.cash_movement ?? expected?.cash ?? 0);
  const expectedCashTotal = Math.max(openingCashTotal + cashMovement, 0);
  const cashUnfundedOutflow = Math.max(-(openingCashTotal + cashMovement), 0);
  const expectedTotal = expectedCashTotal
    + Number(expected?.pix || 0)
    + Number(expected?.debit_card || 0)
    + Number(expected?.credit_card || 0)
    + Number(expected?.other || 0);
  const confirmedTotal = countedCashTotal + confirmedPixTotal + confirmedDebitTotal + confirmedCreditTotal + confirmedOtherTotal;
  const differences = {
    cash: countedCashTotal - expectedCashTotal,
    pix: confirmedPixTotal - (expected?.pix || 0),
    debit: confirmedDebitTotal - (expected?.debit_card || 0),
    credit: confirmedCreditTotal - (expected?.credit_card || 0),
    other: confirmedOtherTotal - (expected?.other || 0),
    total: confirmedTotal - expectedTotal,
  };

  function clearForm() {
    setCounts({});
    setOpeningCash('');
    setConfirmedPix('');
    setConfirmedDebit('');
    setConfirmedCredit('');
    setConfirmedOther('');
    setExternalDetails(emptyExternalDetails());
    setNotes('');
  }

  async function loadOccurrences() {
    if (!storeId) return;
    try {
      const items = await CashbookDiscrepancyService.listByStore(storeId);
      setOccurrences(items);
    } catch (error) {
      console.error('Erro ao carregar ocorrências de fechamento:', error);
    }
  }

  async function loadClosingStatus(preferredDate?: string) {
    if (!storeId) return;
    try {
      setLoadingStatus(true);
      const result = await CashbookService.listDayClosingStatus(storeId, DEFAULT_LOOKBACK_DAYS, DEFAULT_ALLOWED_OPEN_DAYS);
      setClosingStatus(result);
      await loadOccurrences();

      if (preferredDate) {
        setClosingDate(preferredDate);
        return;
      }

      const firstOpenDate = result.open_days[0]?.entry_date;
      const currentStillOpen = result.open_days.some((day) => day.entry_date === closingDate);
      const currentInHistory = result.recent_closings.some((closing) => closing.closing_date === closingDate);
      if (!currentStillOpen && !currentInHistory && firstOpenDate) setClosingDate(firstOpenDate);
    } catch (error) {
      console.error('Erro ao carregar status dos fechamentos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar caixas abertos.');
    } finally {
      setLoadingStatus(false);
    }
  }

  async function loadPreview() {
    if (!storeId) return;
    try {
      setLoadingPreview(true);
      const result = await CashbookService.getDayClosingPreview(storeId, closingDate);
      setPreview(result);
      if (result.existing_closing) {
        const closingMetadata = result.existing_closing.metadata || {};
        const snapshot = (closingMetadata.expected_snapshot || {}) as Record<string, unknown>;
        setOpeningCash(String(closingMetadata.opening_cash_total ?? snapshot.opening_cash_total ?? result.expected.cash_opening_suggested ?? 0));
        setCounts(result.existing_closing.counted_denominations || {});
        setConfirmedPix(String(result.existing_closing.confirmed_pix_total || ''));
        setConfirmedDebit(String(result.existing_closing.confirmed_debit_card_total || ''));
        setConfirmedCredit(String(result.existing_closing.confirmed_credit_card_total || ''));
        setConfirmedOther(String(result.existing_closing.confirmed_other_total || ''));
        setExternalDetails(restoreExternalDetails(result.existing_closing.metadata));
        setNotes(result.existing_closing.notes || '');
      } else {
        clearForm();
        setOpeningCash(String(result.expected.cash_opening_suggested ?? 0));
      }
    } catch (error) {
      console.error('Erro ao carregar prévia de fechamento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar prévia do fechamento.');
    } finally {
      setLoadingPreview(false);
    }
  }

  useEffect(() => {
    void loadClosingStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, closingDate]);

  function updateCount(denomination: DenominationValue, value: string) {
    setCounts((current) => ({ ...current, [String(denomination)]: Math.max(0, Math.floor(Number(value || 0))) }));
  }

  function addExternalDetail(method: ExternalMethodKey) {
    setExternalDetails((current) => ({ ...current, [method]: [...current[method], createExternalDetail()] }));
  }

  function updateExternalDetail(method: ExternalMethodKey, id: string, field: 'label' | 'amount', value: string) {
    setExternalDetails((current) => ({
      ...current,
      [method]: current[method].map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  }

  function removeExternalDetail(method: ExternalMethodKey, id: string) {
    setExternalDetails((current) => ({ ...current, [method]: current[method].filter((item) => item.id !== id) }));
  }

  async function save(status: 'draft' | 'closed') {
    if (!storeId) return;
    if (isClosedDate) return toast.error('Este caixa já foi fechado. Confira os detalhes no histórico.');
    if (!canClose) return toast.error('Você não tem permissão para salvar o fechamento do caixa.');
    if (status === 'closed' && (Math.abs(differences.total) >= 0.01 || cashUnfundedOutflow >= 0.01) && !notes.trim()) {
      return toast.error(cashUnfundedOutflow >= 0.01
        ? 'Informe uma observação: houve uma saída em dinheiro sem fundo suficiente registrado.'
        : 'Informe uma observação para fechar caixa com divergência.');
    }
    if (!window.confirm(status === 'closed' ? 'Fechar o caixa do dia com os valores conferidos?' : 'Salvar rascunho do fechamento do caixa?')) return;

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
          opening_cash_total: openingCashTotal,
          expected_snapshot: {
            ...(preview?.expected || {}),
            opening_cash_total: openingCashTotal,
            cash: expectedCashTotal,
            cash_movement: cashMovement,
            cash_unfunded_outflow: cashUnfundedOutflow,
            total: expectedTotal,
          },
          pending_snapshot: preview?.pending || null,
          cancelled_snapshot: preview?.cancelled || null,
          external_conference_details: serializeExternalDetails(externalDetails),
          external_conference_totals: { pix: confirmedPixTotal, debit: confirmedDebitTotal, credit: confirmedCreditTotal, other: confirmedOtherTotal },
        },
      });
      toast.success(status === 'closed' ? 'Caixa fechado com sucesso.' : 'Rascunho salvo.');
      if (status === 'closed') {
        clearForm();
        await loadClosingStatus();
      } else {
        await loadClosingStatus(closingDate);
        await loadPreview();
      }
    } catch (error) {
      console.error('Erro ao salvar fechamento:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar fechamento.');
    } finally {
      setSaving(null);
    }
  }

  function renderDivergenceBadge(closing: CashbookDayClosing) {
    const info = getDivergenceInfo(closing);
    return (
      <div className={`inline-flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${info.className}`}>
        {info.hasDivergence ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
        <span>{info.hasDivergence ? `Divergência ${info.levelLabel}` : 'Sem divergência'}</span>
        {info.hasDivergence && <span>· {info.typeLabel}</span>}
        {info.occurrenceRequired && <span>· Ocorrência obrigatória</span>}
      </div>
    );
  }

  function renderOccurrenceCard(occurrence: CashbookDiscrepancy | null | undefined) {
    if (!occurrence) {
      return null;
    }

    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest">Ocorrência de divergência</p>
            <p className="mt-1 text-base font-black">{occurrenceStatusLabel(occurrence.status)}</p>
          </div>
          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-black uppercase text-amber-800 dark:bg-gray-900/70 dark:text-amber-200">
            {occurrence.divergence_level === 'low' ? 'Leve' : occurrence.divergence_level === 'critical' ? 'Crítica' : 'Relevante'}
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-black uppercase opacity-70">Esperado</p>
            <p>{formatCurrencyPtBr(occurrence.expected_total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase opacity-70">Conferido</p>
            <p>{formatCurrencyPtBr(occurrence.confirmed_total)}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase opacity-70">Diferença</p>
            <p>{formatCurrencyPtBr(occurrence.difference_total)}</p>
          </div>
        </div>
        {occurrence.opening_notes && <p className="mt-3">Abertura: {occurrence.opening_notes}</p>}
        {occurrence.resolution_notes && <p className="mt-2">Resolução: {occurrence.resolution_notes}</p>}
        <p className="mt-3 text-xs opacity-75">
          Criada em {new Date(occurrence.created_at).toLocaleString('pt-BR')}
          {occurrence.resolved_at ? ` · resolvida em ${new Date(occurrence.resolved_at).toLocaleString('pt-BR')}` : ''}
        </p>
      </div>
    );
  }

  function renderExternalDetailsSummary(closing: CashbookDayClosing) {
    const rows = (['pix', 'debit', 'credit', 'other'] as ExternalMethodKey[]).flatMap((method) => {
      const methodLabel = method === 'pix' ? 'Pix' : method === 'debit' ? 'Débito' : method === 'credit' ? 'Crédito' : 'Outros';
      return getExternalDetailItems(closing.metadata, method).map((item, index) => {
        const itemRecord = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          key: `${method}-${index}`,
          method: methodLabel,
          label: String(itemRecord.label || 'Sem descrição'),
          amount: normalizeNumber(String(itemRecord.amount || itemRecord.amount_value || '0')),
        };
      });
    });

    if (rows.length === 0) return <p className="text-xs font-semibold text-gray-400">Sem detalhamento externo registrado.</p>;

    return (
      <div className="mt-3 space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-3 text-sm font-bold text-gray-500 dark:text-gray-400">
            <span>{row.method} · {row.label}</span>
            <span>{formatCurrencyPtBr(row.amount)}</span>
          </div>
        ))}
      </div>
    );
  }

  function renderClosingSummary(closing: CashbookDayClosing, occurrence?: CashbookDiscrepancy | null) {
    return (
      <div className="space-y-4">
        {renderDivergenceBadge(closing)}
        {renderOccurrenceCard(occurrence)}
        {occurrence && (
          <CashbookOccurrenceResolutionBox
            storeId={storeId}
            occurrence={occurrence}
            canResolve={canClose}
            onUpdated={(updated) => {
              setOccurrences((current) =>
                current.map((item) => (item.id === updated.id ? updated : item))
              );
            }}
          />
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4 dark:bg-gray-900">
            <p className="text-[10px] font-black uppercase text-gray-400">Esperado</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(closing.expected_total)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 dark:bg-gray-900">
            <p className="text-[10px] font-black uppercase text-gray-400">Conferido</p>
            <p className="text-xl font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(closing.confirmed_total)}</p>
          </div>
          <div className="rounded-2xl bg-white p-4 dark:bg-gray-900">
            <p className="text-[10px] font-black uppercase text-gray-400">Diferença</p>
            <p className={`text-xl font-black ${differenceClass(closing.difference_total)}`}>{formatCurrencyPtBr(closing.difference_total)}</p>
          </div>
        </div>
        {closing.notes && <p className="rounded-2xl bg-white p-3 text-sm font-bold text-gray-600 dark:bg-gray-900 dark:text-gray-300">Obs.: {closing.notes}</p>}
        {renderExternalDetailsSummary(closing)}
      </div>
    );
  }

  function renderExternalCard(method: ExternalMethodKey, label: string, hint: string, value: string, setter: (value: string) => void, total: number, expectedValue: number) {
    const details = externalDetails[method];
    const usingDetails = details.length > 0;
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</p>
            <p className="text-xs font-semibold text-gray-400">{hint}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setter('');
              setExternalDetails((current) => ({ ...current, [method]: [] }));
            }}
            disabled={!canClose || (!value && !usingDetails)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700"
          >
            <X size={14} />
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            inputMode="decimal"
            value={usingDetails ? formatCurrencyPtBr(total) : value}
            onChange={(event) => setter(event.target.value)}
            placeholder="0,00"
            disabled={!canClose || usingDetails}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 disabled:opacity-70 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
          />
          <button
            type="button"
            onClick={() => addExternalDetail(method)}
            disabled={!canClose}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-3 py-2 text-xs font-black text-teal-700 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-teal-900/60 dark:bg-gray-900 dark:text-teal-300"
          >
            <Plus size={14} />
            Detalhar
          </button>
        </div>
        {usingDetails && (
          <div className="mt-3 space-y-2">
            {details.map((item) => (
              <div key={item.id} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <input
                  type="text"
                  value={item.label}
                  onChange={(event) => updateExternalDetail(method, item.id, 'label', event.target.value)}
                  disabled={!canClose}
                  placeholder="Ex.: Infinite, Bradesco pessoal"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={item.amount}
                  onChange={(event) => updateExternalDetail(method, item.id, 'amount', event.target.value)}
                  disabled={!canClose}
                  placeholder="0,00"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => removeExternalDetail(method, item.id)}
                  disabled={!canClose}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm font-black dark:bg-gray-900">
              <span className="text-gray-500 dark:text-gray-400">Total detalhado</span>
              <span className="text-teal-700 dark:text-teal-300">{formatCurrencyPtBr(total)}</span>
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-xs font-bold">
          <span className="text-gray-400">Esperado: {formatCurrencyPtBr(expectedValue)}</span>
          <span className={differenceClass(total - expectedValue)}>Dif.: {formatCurrencyPtBr(total - expectedValue)}</span>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-teal-200 bg-teal-50/70 p-5 shadow-sm dark:border-teal-900/50 dark:bg-teal-950/20">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-300">
            <Calculator size={18} />
            <h2 className="text-sm font-black uppercase tracking-widest">Fechamento do caixa do dia</h2>
          </div>
          <p className="mt-1 text-sm text-teal-800/80 dark:text-teal-200/80">O caixa do dia fica em primeiro plano; caixas abertos e histórico ficam abaixo.</p>
        </div>
        <button
          type="button"
          onClick={() => loadClosingStatus(closingDate)}
          disabled={loadingStatus || loadingPreview}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-black text-teal-700 transition hover:bg-teal-50 disabled:opacity-60 dark:border-teal-900/60 dark:bg-gray-900 dark:text-teal-300"
        >
          <RefreshCw size={16} className={loadingStatus || loadingPreview ? 'animate-spin' : ''} />
          Atualizar caixas
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-xs dark:bg-gray-900">
        <button type="button" onClick={() => setMode('closing')} className={`rounded-xl px-4 py-2 text-sm font-black ${mode === 'closing' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}`}>Caixa do dia</button>
        <button type="button" onClick={() => setMode('history')} className={`rounded-xl px-4 py-2 text-sm font-black ${mode === 'history' ? 'bg-teal-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}`}>Histórico de fechamentos</button>
      </div>

      {mode === 'closing' && (
        <>
          {overdueDays.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-black uppercase tracking-widest">Caixas atrasados</p>
                  <p className="mt-1 text-sm font-bold">Existem {overdueDays.length} caixa(s) aberto(s) há mais de {closingStatus?.allowed_open_days || DEFAULT_ALLOWED_OPEN_DAYS} dia(s).</p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Caixa em conferência</h3>
                <p className="mt-1 text-xs font-semibold text-gray-400">
                  {isClosedDate ? 'Este caixa já foi fechado. Consulte o histórico para auditoria.' : selectedOpenDay ? `Data selecionada: ${formatDatePtBr(selectedOpenDay.entry_date)}` : `Data selecionada: ${formatDatePtBr(closingDate)}`}
                </p>
              </div>
              {isDraftDate && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">Rascunho salvo</span>}
              {isClosedDate && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">Fechado</span>}
            </div>
            {isClosedDate && preview?.existing_closing ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                {renderClosingSummary(preview.existing_closing, occurrences.find((item) => item.closing_id === preview.existing_closing?.id))}
              </div>
            ) : null}
          </div>

          <div className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
            <button type="button" onClick={() => setShowOpenDays((current) => !current)} className="flex w-full items-center justify-between gap-3 text-left">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Caixas abertos</h3>
                <p className="mt-1 text-xs font-semibold text-gray-400">{openDays.length} caixa(s) aberto(s), {overdueDays.length} atrasado(s).</p>
              </div>
              {showOpenDays ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {showOpenDays && (
              <div className="mt-4 space-y-2">
                {openDays.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm font-bold text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhum caixa aberto encontrado.</div>
                ) : (
                  openDays.map((day) => (
                    <button
                      key={day.entry_date}
                      type="button"
                      onClick={() => setClosingDate(day.entry_date)}
                      className={`w-full rounded-2xl border p-3 text-left transition ${closingDate === day.entry_date ? 'border-teal-400 bg-teal-50 shadow-sm dark:border-teal-700 dark:bg-teal-950/30' : day.is_overdue ? 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20' : 'border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/60'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-gray-900 dark:text-white">{formatDatePtBr(day.entry_date)}</p>
                          <p className="text-xs font-semibold text-gray-400">{day.entries_count} lançamento(s) · aberto há {day.age_days} dia(s)</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-teal-700 dark:text-teal-300">{formatCurrencyPtBr(day.realized_total)}</p>
                          {day.is_overdue && <p className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-300">Atrasado</p>}
                        </div>
                      </div>
                      {day.pending_count > 0 && <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-amber-700 dark:bg-gray-900 dark:text-amber-300">{day.pending_count} pendente(s) · {formatCurrencyPtBr(day.pending_total)} fora do realizado</p>}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {(preview?.pending.count || preview?.cancelled.count) ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="text-[10px] font-black uppercase tracking-widest">Pendentes no dia</p>
                <p className="mt-1 text-lg font-black">{preview?.pending.count || 0} item(ns) · {formatCurrencyPtBr(preview?.pending.total || 0)}</p>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">
                <p className="text-[10px] font-black uppercase tracking-widest">Cancelados no dia</p>
                <p className="mt-1 text-lg font-black">{preview?.cancelled.count || 0} item(ns) · {formatCurrencyPtBr(preview?.cancelled.total || 0)}</p>
              </div>
            </div>
          ) : null}

          {!isClosedDate && (
            <>
              <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Conferência de dinheiro</h3>
                  <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                    <label className="block text-xs font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      Fundo de abertura / troco inicial
                    </label>
                    <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={openingCash}
                        onChange={(event) => setOpeningCash(event.target.value)}
                        disabled={!canClose}
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-500 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white sm:max-w-[180px]"
                        placeholder="0,00"
                      />
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        Sugestão pelo último caixa fechado: {formatCurrencyPtBr(Number(expected?.cash_opening_suggested || 0))}. Ajuste se o valor físico deixado na gaveta foi outro.
                      </p>
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl bg-white p-3 dark:bg-gray-900">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Abertura</p>
                        <p className="mt-1 font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(openingCashTotal)}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3 dark:bg-gray-900">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Movimento em dinheiro</p>
                        <p className={`mt-1 font-black ${cashMovement < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{formatCurrencyPtBr(cashMovement)}</p>
                      </div>
                      <div className="rounded-xl bg-white p-3 dark:bg-gray-900">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Esperado na gaveta</p>
                        <p className="mt-1 font-black text-teal-700 dark:text-teal-300">{formatCurrencyPtBr(expectedCashTotal)}</p>
                      </div>
                    </div>
                    {cashUnfundedOutflow >= 0.01 && (
                      <div className="mt-3 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>As saídas em dinheiro excedem o fundo informado em {formatCurrencyPtBr(cashUnfundedOutflow)}. O fechamento poderá ser salvo, mas abrirá uma ocorrência para auditoria.</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[460px] text-sm">
                      <thead>
                        <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                          <th className="py-2">Nota/moeda</th>
                          <th className="py-2">Qtde</th>
                          <th className="py-2 text-right">Total</th>
                          <th className="py-2 text-right">Limpar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {DENOMINATIONS.map((denomination) => {
                          const quantity = Number(counts[String(denomination)] || 0);
                          return (
                            <tr key={denomination} className="border-t border-gray-100 dark:border-gray-800">
                              <td className="py-2 font-black text-gray-700 dark:text-gray-200">{formatCurrencyPtBr(denomination)}</td>
                              <td className="py-2">
                                <input type="number" min="0" step="1" value={quantity || ''} onChange={(event) => updateCount(denomination, event.target.value)} disabled={!canClose} className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
                              </td>
                              <td className="py-2 text-right font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(quantity * denomination)}</td>
                              <td className="py-2 text-right">
                                <button type="button" onClick={() => setCounts((current) => ({ ...current, [String(denomination)]: 0 }))} disabled={!canClose || !quantity} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 disabled:opacity-30"><X size={14} /></button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                          <td colSpan={2} className="py-3 text-sm font-black text-gray-500 dark:text-gray-400">Total em caixa dinheiro</td>
                          <td className="py-3 text-right text-lg font-black text-teal-700 dark:text-teal-300">{formatCurrencyPtBr(countedCashTotal)}</td>
                          <td className="py-3 text-right">
                            <button type="button" onClick={() => setCounts({})} disabled={!canClose || countedCashTotal <= 0} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 disabled:opacity-30"><X size={14} /></button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Conferência externa</h3>
                    <div className="mt-4 grid gap-4">
                      {renderExternalCard('pix', 'Total em Pix', 'Conferir nos bancos/extratos', confirmedPix, setConfirmedPix, confirmedPixTotal, expected?.pix || 0)}
                      {renderExternalCard('debit', 'Total em cartões de débito', 'Conferir nas máquinas', confirmedDebit, setConfirmedDebit, confirmedDebitTotal, expected?.debit_card || 0)}
                      {renderExternalCard('credit', 'Total em cartões de crédito', 'Conferir nas máquinas', confirmedCredit, setConfirmedCredit, confirmedCreditTotal, expected?.credit_card || 0)}
                      {renderExternalCard('other', 'Outros recebimentos', 'Quando houver', confirmedOther, setConfirmedOther, confirmedOtherTotal, expected?.other || 0)}
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
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} disabled={!canClose} rows={3} placeholder="Informe observações sobre divergências, conferência das máquinas ou banco." className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-800 outline-none focus:border-teal-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
              </label>
            </>
          )}

          {!canClose && <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">Você pode visualizar a prévia, mas não tem permissão para salvar ou fechar o caixa.</p>}
          {!isClosedDate && (
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => save('draft')} disabled={!canClose || saving !== null || loadingPreview} className="inline-flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-sm font-black text-teal-700 disabled:opacity-60 dark:border-teal-900/60 dark:bg-gray-900 dark:text-teal-300">{saving === 'draft' ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}Salvar rascunho</button>
              <button type="button" onClick={() => save('closed')} disabled={!canClose || saving !== null || loadingPreview} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{saving === 'closed' ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}Fechar caixa</button>
            </div>
          )}
        </>
      )}

      {mode === 'history' && (
        <div className="mt-5 rounded-3xl border border-gray-100 bg-white p-4 shadow-xs dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">Histórico de fechamentos</h3>
          <p className="mt-1 text-xs font-semibold text-gray-400">Consulte caixas fechados, diferenças, observações e detalhes usados na conferência.</p>
          <div className="mt-4 space-y-3">
            {recentClosings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm font-bold text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhum fechamento registrado ainda.</div>
            ) : (
              recentClosings.map((closing) => (
                <div key={closing.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/60">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-black text-gray-900 dark:text-white">{formatDatePtBr(closing.closing_date)}</p>
                        {renderDivergenceBadge(closing)}
                        {occurrences.some((item) => item.closing_id === closing.id && item.status === 'open') && <span className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">Ocorrência aberta</span>}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-gray-400">{closing.closed_at ? `Fechado em ${new Date(closing.closed_at).toLocaleString('pt-BR')}` : 'Sem horário de fechamento'}</p>
                      {closing.notes && <p className="mt-2 text-xs font-bold text-gray-600 dark:text-gray-300">Obs.: {closing.notes}</p>}
                    </div>
                    <div className="grid gap-2 text-right sm:grid-cols-3">
                      <div><p className="text-[10px] font-black uppercase text-gray-400">Esperado</p><p className="font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(closing.expected_total)}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-gray-400">Conferido</p><p className="font-black text-gray-900 dark:text-white">{formatCurrencyPtBr(closing.confirmed_total)}</p></div>
                      <div><p className="text-[10px] font-black uppercase text-gray-400">Diferença</p><p className={`font-black ${differenceClass(closing.difference_total)}`}>{formatCurrencyPtBr(closing.difference_total)}</p></div>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedClosing(closing)} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-black text-gray-600 hover:border-teal-200 hover:text-teal-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                    <Eye size={14} />Ver detalhes
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {selectedClosing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl dark:bg-gray-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">Detalhes do fechamento</h3>
                <p className="text-sm font-bold text-gray-400">{formatDatePtBr(selectedClosing.closing_date)} · {selectedClosing.closed_at ? new Date(selectedClosing.closed_at).toLocaleString('pt-BR') : 'sem horário'}</p>
              </div>
              <button type="button" onClick={() => setSelectedClosing(null)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900">
                <X size={18} />
              </button>
            </div>
            <div className="mt-5">{renderClosingSummary(selectedClosing, selectedOccurrence)}</div>
          </div>
        </div>
      )}
    </section>
  );
}
