import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, FileWarning, RefreshCw, Search } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getShortDocumentReference, getDocumentReferenceTitle } from '@/utils/documentReference';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { StockDiscrepancyService, type StockDiscrepancyOccurrence, type StockDiscrepancyStatus } from '@/services/stockDiscrepancyService';

const STATUS_LABELS: Record<StockDiscrepancyStatus, string> = {
  open: 'Aberta',
  under_review: 'Em análise',
  waiting_stock_count: 'Aguardando contagem física',
  resolved: 'Resolvida',
  cancelled: 'Cancelada',
};

type TreatmentStatus = 'under_review' | 'waiting_stock_count' | 'resolved' | 'cancelled';
type PurchaseIssueStatus = 'waiting_supplier' | 'waiting_financial' | 'waiting_document' | 'resolved' | 'cancelled';
type PurchaseIssueType = 'shortage' | 'damage' | 'wrong_item' | 'excess' | 'other';
type PurchaseIssueDisposition = 'awaiting_replacement' | 'discount' | 'supplier_credit' | 'partial_return' | 'accepted_closed' | 'other';

type PurchaseReceiptIssueQueueItem = {
  issue_id: string;
  issue_code: string;
  purchase_document_id: string;
  document_code: string | null;
  invoice_number: string | null;
  supplier_id: string;
  supplier_name: string;
  product_id: string;
  product_name: string;
  issue_type: PurchaseIssueType;
  issue_scope: string;
  quantity: number;
  disposition: PurchaseIssueDisposition;
  issue_status: PurchaseIssueStatus;
  replacement_pending_quantity: number;
  physical_closed_quantity: number;
  estimated_amount: number;
  notes: string | null;
  opened_by: string;
  opened_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
  resolution_reference: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

const PURCHASE_ISSUE_STATUS_LABELS: Record<PurchaseIssueStatus, string> = {
  waiting_supplier: 'Aguardando reposição',
  waiting_financial: 'Aguardando acerto financeiro',
  waiting_document: 'Aguardando documento / devolução',
  resolved: 'Resolvida',
  cancelled: 'Cancelada',
};

const PURCHASE_ISSUE_TYPE_LABELS: Record<PurchaseIssueType, string> = {
  shortage: 'Falta',
  damage: 'Avaria',
  wrong_item: 'Item incorreto',
  excess: 'Excesso',
  other: 'Outro',
};

const PURCHASE_ISSUE_DISPOSITION_LABELS: Record<PurchaseIssueDisposition, string> = {
  awaiting_replacement: 'Fornecedor vai repor',
  discount: 'Abatimento / desconto',
  supplier_credit: 'Crédito / bonificação',
  partial_return: 'Devolução parcial',
  accepted_closed: 'Diferença aceita e encerrada',
  other: 'Outra tratativa',
};

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatQuantity(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return (Number.isFinite(numeric) ? numeric : 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatMoney(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return (Number.isFinite(numeric) ? numeric : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function purchaseIssueBadgeClass(status: PurchaseIssueStatus) {
  if (status === 'resolved') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
  if (status === 'cancelled') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
  if (status === 'waiting_supplier') return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
}

export default function StockDiscrepanciesPage() {
  const { storeId, loading: loadingStore } = useCurrentStore();
  const { hasPermission } = usePermissions(storeId ?? null);
  const canResolve = hasPermission('stock.manage') || hasPermission('stock.adjust');
  const canOpenPurchases = hasPermission('purchases.view') || hasPermission('purchases.confirm') || hasPermission('purchases.cancel');
  const canTreatPurchaseIssues = hasPermission('purchases.confirm');
  const canCancelPurchaseIssues = hasPermission('purchases.cancel');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const focusedOrderId = searchParams.get('orderId');
  const focusedPurchaseIssueCode = searchParams.get('issue');
  const returnTo = searchParams.get('returnTo');
  const requestedStatus = searchParams.get('status') as StockDiscrepancyStatus | 'all' | null;

  const [occurrences, setOccurrences] = useState<StockDiscrepancyOccurrence[]>([]);
  const [allOccurrences, setAllOccurrences] = useState<StockDiscrepancyOccurrence[]>([]);
  const [purchaseIssues, setPurchaseIssues] = useState<PurchaseReceiptIssueQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StockDiscrepancyStatus | 'all'>(() => focusedOrderId ? 'all' : requestedStatus || 'open');
  const [purchaseIssueStatus, setPurchaseIssueStatus] = useState<PurchaseIssueStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const value = new Date();
    value.setDate(value.getDate() - 90);
    return localDate(value);
  });
  const [endDate, setEndDate] = useState(() => localDate(new Date()));
  const [selected, setSelected] = useState<StockDiscrepancyOccurrence | null>(null);
  const [nextStatus, setNextStatus] = useState<TreatmentStatus>('under_review');
  const [resolutionType, setResolutionType] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedPurchaseIssue, setSelectedPurchaseIssue] = useState<PurchaseReceiptIssueQueueItem | null>(null);
  const [purchaseIssueAction, setPurchaseIssueAction] = useState<'treatment' | 'resolve' | 'cancel'>('resolve');
  const [purchaseIssueDisposition, setPurchaseIssueDisposition] = useState<PurchaseIssueDisposition>('partial_return');
  const [purchaseIssueNotes, setPurchaseIssueNotes] = useState('');
  const [purchaseIssueReference, setPurchaseIssueReference] = useState('');
  const [purchaseIssueSaving, setPurchaseIssueSaving] = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const [filtered, all, purchaseIssueResult] = await Promise.all([
        StockDiscrepancyService.list(storeId, status, startDate, endDate),
        StockDiscrepancyService.list(storeId, 'all', startDate, endDate),
        supabase.rpc('list_purchase_receipt_issues_safe', {
          p_store_id: storeId,
          p_status: purchaseIssueStatus,
          p_start_date: startDate || null,
          p_end_date: endDate || null,
          p_limit: 500,
        }),
      ]);
      if (purchaseIssueResult.error) throw purchaseIssueResult.error;
      setOccurrences(filtered);
      setAllOccurrences(all);
      setPurchaseIssues((purchaseIssueResult.data ?? []) as PurchaseReceiptIssueQueueItem[]);
    } catch (error) {
      console.error('Erro ao carregar divergências operacionais:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as divergências.');
    } finally {
      setLoading(false);
    }
  }, [storeId, status, purchaseIssueStatus, startDate, endDate]);

  useRefreshFrame(load);

  useEffect(() => {
    if (!loadingStore && storeId) void load();
  }, [loadingStore, storeId, load]);

  useEffect(() => {
    if (focusedOrderId) setStatus('all');
  }, [focusedOrderId]);

  useEffect(() => {
    if (!focusedPurchaseIssueCode) return;
    const issue = purchaseIssues.find((item) => item.issue_code === focusedPurchaseIssueCode);
    if (!issue) return;
    setSearch(focusedPurchaseIssueCode);
    setSelectedPurchaseIssue(issue);
    setPurchaseIssueAction(issue.issue_status === 'waiting_supplier' ? 'treatment' : 'resolve');
    setPurchaseIssueDisposition(issue.disposition);
    setPurchaseIssueNotes('');
    setPurchaseIssueReference(issue.resolution_reference || '');
  }, [focusedPurchaseIssueCode, purchaseIssues]);

  const counts = useMemo(() => ({
    open: allOccurrences.filter((item) => item.status === 'open').length,
    inTreatment: allOccurrences.filter((item) => item.status === 'under_review' || item.status === 'waiting_stock_count').length,
    resolved: allOccurrences.filter((item) => item.status === 'resolved').length,
  }), [allOccurrences]);

  const purchaseIssueCounts = useMemo(() => ({
    active: purchaseIssues.filter((item) => !['resolved', 'cancelled'].includes(item.issue_status)).length,
    supplier: purchaseIssues.filter((item) => item.issue_status === 'waiting_supplier').length,
    financial: purchaseIssues.filter((item) => item.issue_status === 'waiting_financial').length,
    document: purchaseIssues.filter((item) => item.issue_status === 'waiting_document').length,
  }), [purchaseIssues]);

  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visibleOccurrences = occurrences.filter((occurrence) => {
    if (focusedOrderId && occurrence.order_id !== focusedOrderId) return false;
    if (!term) return true;
    const products = occurrence.items.map((item) => item.product_name || '').join(' ');
    return [
      occurrence.order_code || '',
      occurrence.location_name || '',
      occurrence.operator_name || '',
      products,
    ].some((value) => value.toLocaleLowerCase('pt-BR').includes(term));
  });

  const visiblePurchaseIssues = purchaseIssues.filter((issue) => {
    if (!term) return true;
    return [
      issue.issue_code,
      issue.document_code || '',
      issue.invoice_number || '',
      issue.supplier_name || '',
      issue.product_name || '',
      issue.notes || '',
      issue.resolution_notes || '',
      issue.resolution_reference || '',
    ].some((value) => value.toLocaleLowerCase('pt-BR').includes(term));
  });

  function beginTreatment(occurrence: StockDiscrepancyOccurrence) {
    setSelected(occurrence);
    setNextStatus(occurrence.status === 'open' ? 'under_review' : 'resolved');
    setResolutionType(occurrence.resolution_type || '');
    setResolutionNotes(occurrence.resolution_notes || '');
  }

  async function saveTreatment() {
    if (!storeId || !selected || !canResolve) return;
    if ((nextStatus === 'resolved' || nextStatus === 'cancelled') && (!resolutionType || !resolutionNotes.trim())) {
      toast.error('Informe o tipo de resolução e descreva o que foi conferido.');
      return;
    }
    try {
      setSaving(true);
      await StockDiscrepancyService.resolve({
        storeId,
        occurrenceId: selected.id,
        status: nextStatus,
        resolutionType,
        resolutionNotes,
      });
      toast.success(nextStatus === 'resolved' ? 'Divergência resolvida e auditada.' : 'Divergência atualizada.');
      setSelected(null);
      await load();
    } catch (error) {
      console.error('Erro ao atualizar divergência:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a divergência.');
    } finally {
      setSaving(false);
    }
  }

  function beginPurchaseIssueTreatment(issue: PurchaseReceiptIssueQueueItem, action?: 'treatment' | 'resolve' | 'cancel') {
    setSelectedPurchaseIssue(issue);
    setPurchaseIssueAction(action || (issue.issue_status === 'waiting_supplier' ? 'treatment' : 'resolve'));
    setPurchaseIssueDisposition(issue.disposition);
    setPurchaseIssueNotes('');
    setPurchaseIssueReference(issue.resolution_reference || '');
  }

  async function savePurchaseIssueTreatment() {
    if (!selectedPurchaseIssue || !canTreatPurchaseIssues || purchaseIssueSaving) return;
    const notes = purchaseIssueNotes.trim();
    const reference = purchaseIssueReference.trim();
    if ((purchaseIssueAction === 'resolve' || purchaseIssueAction === 'cancel') && notes.length < 3) {
      toast.error(purchaseIssueAction === 'resolve' ? 'Descreva como a pendência foi resolvida.' : 'Informe o motivo do cancelamento.');
      return;
    }
    if (purchaseIssueAction === 'cancel' && !canCancelPurchaseIssues) {
      toast.error('Você não tem permissão para cancelar esta ressalva.');
      return;
    }
    try {
      setPurchaseIssueSaving(true);
      if (purchaseIssueAction === 'treatment') {
        const { error } = await supabase.rpc('update_purchase_receipt_issue_treatment', {
          p_issue_id: selectedPurchaseIssue.issue_id,
          p_disposition: purchaseIssueDisposition,
          p_notes: notes || null,
          p_resolution_reference: reference || null,
        });
        if (error) throw error;
        toast.success('Tratativa atualizada e auditada.');
      } else if (purchaseIssueAction === 'resolve') {
        const { error } = await supabase.rpc('resolve_purchase_receipt_issue', {
          p_issue_id: selectedPurchaseIssue.issue_id,
          p_resolution_notes: notes,
          p_resolution_reference: reference || null,
        });
        if (error) throw error;
        toast.success('Pendência resolvida e preservada no histórico.');
      } else {
        const { error } = await supabase.rpc('cancel_purchase_receipt_issue', {
          p_issue_id: selectedPurchaseIssue.issue_id,
          p_reason: notes,
        });
        if (error) throw error;
        toast.success('Ressalva cancelada sem apagar o histórico.');
      }
      setSelectedPurchaseIssue(null);
      await load();
    } catch (error) {
      console.error('Erro ao tratar pendência de recebimento:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a pendência.');
    } finally {
      setPurchaseIssueSaving(false);
    }
  }

  function goBack() {
    if (returnTo) navigate(returnTo);
    else navigate(-1);
  }

  if (loadingStore) return <LoadingSpinner />;

  return (
    <PageContainer title="Divergências de estoque" withoutHeader>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button type="button" onClick={goBack} className="mb-3 inline-flex items-center gap-2 text-sm font-black text-teal-700 dark:text-teal-300">
              <ArrowLeft size={16} /> Voltar
            </button>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">Auditoria operacional</p>
            <h1 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">Divergências de estoque</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Centraliza divergências físicas de vendas e ressalvas de recebimento de compras. Cada fluxo mantém seu próprio estado e histórico de tratamento.
            </p>
            {focusedOrderId && <p className="mt-2 text-xs font-black text-teal-700 dark:text-teal-300">Exibindo somente a divergência vinculada à venda selecionada.</p>}
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 dark:border-gray-700 dark:text-gray-200">
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">Vendas no filtro</p>
            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{visibleOccurrences.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Abertas</p>
            <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">{counts.open}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Em tratamento</p>
            <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">{counts.inTreatment}</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">Resolvidas</p>
            <p className="mt-2 text-2xl font-black text-emerald-900 dark:text-emerald-100">{counts.resolved}</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-2 xl:grid-cols-6">
          <label className="relative xl:col-span-2">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Venda, compra, produto, fornecedor, local ou operador" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value as StockDiscrepancyStatus | 'all')} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" title="Estado das divergências de venda/estoque">
            <option value="all">Vendas: todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>Vendas: {label}</option>)}
          </select>
          <select value={purchaseIssueStatus} onChange={(event) => setPurchaseIssueStatus(event.target.value as PurchaseIssueStatus | 'all')} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" title="Estado das ressalvas de recebimento">
            <option value="all">Compras: todos os estados</option>
            {Object.entries(PURCHASE_ISSUE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>Compras: {label}</option>)}
          </select>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </div>

        <section className="space-y-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-400">Vendas e saldo físico</p>
            <h2 className="mt-1 text-lg font-black text-gray-900 dark:text-white">Divergências físicas de vendas</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">“Aguardando contagem física” continua em tratamento; somente Resolvida ou Cancelada encerra a ocorrência.</p>
          </div>

          {loading ? <LoadingSpinner /> : visibleOccurrences.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-gray-300 p-8 text-center text-sm font-bold text-gray-500 dark:border-gray-700">
              Nenhuma divergência de venda encontrada neste filtro.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleOccurrences.map((occurrence) => (
                <article key={occurrence.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${occurrence.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : occurrence.status === 'cancelled' ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'}`}>
                          {occurrence.status === 'resolved' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />} {STATUS_LABELS[occurrence.status]}
                        </span>
                        <span className="text-xs font-bold text-gray-400">{new Date(occurrence.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <h3 className="mt-3 cursor-help text-lg font-black text-gray-900 dark:text-white" title={getDocumentReferenceTitle(occurrence.order_code || occurrence.order_id)}>
                        {getShortDocumentReference(occurrence.order_code || occurrence.order_id, { fallbackLabel: 'Venda' })}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Local: {occurrence.location_name || 'Não identificado'} · Operador: {occurrence.operator_name || 'Não identificado'}</p>
                      {occurrence.resolution_notes && <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 dark:bg-gray-950 dark:text-gray-300">Última anotação: {occurrence.resolution_notes}</p>}
                      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {occurrence.items.map((item, index) => (
                          <div key={item.product_id || index} className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60">
                            <p className="font-black text-gray-900 dark:text-white">{item.product_name || 'Produto'}</p>
                            <p className="mt-1 text-xs font-bold text-gray-500">Solicitado {Number(item.requested_quantity ?? item.requested ?? 0)} · disponível {Number(item.available_quantity ?? item.available ?? 0)} · divergência {Number(item.shortage_quantity ?? item.shortage ?? 0)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    {canResolve && !['resolved', 'cancelled'].includes(occurrence.status) && <button type="button" onClick={() => beginTreatment(occurrence)} className="h-fit shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white">Tratar divergência</button>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {!focusedOrderId && (
          <section className="space-y-3 border-t border-gray-200 pt-5 dark:border-gray-800">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Compras e fornecedores</p>
                <h2 className="mt-1 text-lg font-black text-gray-900 dark:text-white">Pendências de recebimento</h2>
                <p className="mt-1 max-w-3xl text-xs text-gray-500 dark:text-gray-400">Fila operacional para tratar reposições, abatimentos, créditos e devoluções. Registre referência/protocolo, observação e conclusão sem reabrir a obrigação física já encerrada.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Ativas: {purchaseIssueCounts.active}</span>
                <span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-800 dark:bg-blue-950 dark:text-blue-200">Reposição: {purchaseIssueCounts.supplier}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">Financeiro: {purchaseIssueCounts.financial}</span>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Documento: {purchaseIssueCounts.document}</span>
              </div>
            </div>

            {loading ? <LoadingSpinner /> : visiblePurchaseIssues.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-gray-300 p-8 text-center text-sm font-bold text-gray-500 dark:border-gray-700">
                Nenhuma ressalva de recebimento encontrada neste filtro.
              </div>
            ) : (
              <div className="space-y-3">
                {visiblePurchaseIssues.map((issue) => (
                  <article key={issue.issue_id} className="rounded-3xl border border-amber-100 bg-white p-5 shadow-xs dark:border-amber-900/50 dark:bg-gray-900">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${purchaseIssueBadgeClass(issue.issue_status)}`}>
                            {issue.issue_status === 'resolved' ? <CheckCircle2 size={13} /> : <FileWarning size={13} />} {PURCHASE_ISSUE_STATUS_LABELS[issue.issue_status]}
                          </span>
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-black text-gray-700 dark:bg-gray-800 dark:text-gray-200">{PURCHASE_ISSUE_TYPE_LABELS[issue.issue_type]}</span>
                          <span className="text-xs font-bold text-gray-400">{new Date(issue.opened_at).toLocaleString('pt-BR')}</span>
                        </div>

                        <div className="mt-3 flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-3">
                          <h3 className="text-lg font-black text-gray-900 dark:text-white">{issue.issue_code}</h3>
                          <span className="text-sm font-black text-teal-700 dark:text-teal-300">{issue.document_code || getShortDocumentReference(issue.purchase_document_id, { fallbackLabel: 'Compra' })}</span>
                          {issue.invoice_number && <span className="text-xs font-bold text-gray-500">NF/Documento: {issue.invoice_number}</span>}
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Fornecedor: <strong>{issue.supplier_name || 'Não identificado'}</strong></p>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60">
                            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Produto</p>
                            <p className="mt-1 font-black text-gray-900 dark:text-white">{issue.product_name || 'Produto'}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60">
                            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Quantidade afetada</p>
                            <p className="mt-1 font-black text-gray-900 dark:text-white">{formatQuantity(issue.quantity)} un.</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60">
                            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Tratativa</p>
                            <p className="mt-1 font-black text-gray-900 dark:text-white">{PURCHASE_ISSUE_DISPOSITION_LABELS[issue.disposition]}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60">
                            <p className="text-xs font-black uppercase tracking-wider text-gray-400">Impacto estimado</p>
                            <p className="mt-1 font-black text-gray-900 dark:text-white">{formatMoney(issue.estimated_amount)}</p>
                          </div>
                        </div>

                        {(Number(issue.replacement_pending_quantity) > 0 || Number(issue.physical_closed_quantity) > 0) && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                            {Number(issue.replacement_pending_quantity) > 0 && <span className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">Reposição física pendente: {formatQuantity(issue.replacement_pending_quantity)}</span>}
                            {Number(issue.physical_closed_quantity) > 0 && <span className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">Obrigação física encerrada: {formatQuantity(issue.physical_closed_quantity)}</span>}
                          </div>
                        )}

                        {issue.notes && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Ocorrência: {issue.notes}</p>}
                        {issue.resolution_notes && <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">Solução: {issue.resolution_notes}{issue.resolution_reference ? ` · Ref.: ${issue.resolution_reference}` : ''}</p>}
                        {issue.cancellation_reason && <p className="mt-2 rounded-xl bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 dark:bg-gray-950 dark:text-gray-300">Cancelada: {issue.cancellation_reason}</p>}
                      </div>

                      <div className="flex h-fit shrink-0 flex-wrap gap-2">
                        {canTreatPurchaseIssues && !['resolved', 'cancelled'].includes(issue.issue_status) && (
                          <button type="button" onClick={() => beginPurchaseIssueTreatment(issue)} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white hover:bg-teal-700">
                            Tratar pendência
                          </button>
                        )}
                        {canOpenPurchases && (
                          <button type="button" onClick={() => navigate(`/admin/stock/purchase-documents?open=${encodeURIComponent(issue.purchase_document_id)}`)} className="rounded-xl border border-teal-300 bg-white px-4 py-2 text-sm font-black text-teal-700 hover:bg-teal-50 dark:border-teal-700 dark:bg-gray-950 dark:text-teal-200 dark:hover:bg-teal-950/30">
                            Abrir compra
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {selectedPurchaseIssue && (
        <div className="fixed inset-0 z-[105] flex items-end justify-center bg-black/55 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-600 dark:text-amber-300">Pendência de recebimento</p>
                <h2 className="mt-1 text-xl font-black text-gray-900 dark:text-white">{selectedPurchaseIssue.issue_code}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selectedPurchaseIssue.document_code || getShortDocumentReference(selectedPurchaseIssue.purchase_document_id, { fallbackLabel: 'Compra' })} · {selectedPurchaseIssue.supplier_name}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${purchaseIssueBadgeClass(selectedPurchaseIssue.issue_status)}`}>{PURCHASE_ISSUE_STATUS_LABELS[selectedPurchaseIssue.issue_status]}</span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60"><p className="text-xs font-black uppercase tracking-wider text-gray-400">Produto</p><p className="mt-1 font-black text-gray-900 dark:text-white">{selectedPurchaseIssue.product_name}</p></div>
              <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60"><p className="text-xs font-black uppercase tracking-wider text-gray-400">Quantidade</p><p className="mt-1 font-black text-gray-900 dark:text-white">{formatQuantity(selectedPurchaseIssue.quantity)} un.</p></div>
              <div className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60"><p className="text-xs font-black uppercase tracking-wider text-gray-400">Impacto</p><p className="mt-1 font-black text-gray-900 dark:text-white">{formatMoney(selectedPurchaseIssue.estimated_amount)}</p></div>
            </div>

            {Number(selectedPurchaseIssue.physical_closed_quantity) > 0 && (
              <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                Obrigação física encerrada em {formatQuantity(selectedPurchaseIssue.physical_closed_quantity)} un. Esta tratativa não reabre quantidade para recebimento.
              </p>
            )}

            <div className="mt-5 space-y-4">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-200">Ação
                <select value={purchaseIssueAction} onChange={(event) => setPurchaseIssueAction(event.target.value as 'treatment' | 'resolve' | 'cancel')} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                  <option value="treatment">Alterar tratativa</option>
                  {selectedPurchaseIssue.issue_status !== 'waiting_supplier' && <option value="resolve">Registrar solução e concluir</option>}
                  {canCancelPurchaseIssues && <option value="cancel">Cancelar ressalva</option>}
                </select>
              </label>

              {purchaseIssueAction === 'treatment' && (
                <label className="block text-sm font-black text-gray-700 dark:text-gray-200">Tratativa
                  <select value={purchaseIssueDisposition} onChange={(event) => setPurchaseIssueDisposition(event.target.value as PurchaseIssueDisposition)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                    <option value="awaiting_replacement">Fornecedor vai repor</option>
                    <option value="discount">Abatimento / desconto</option>
                    <option value="supplier_credit">Crédito / bonificação</option>
                    <option value="partial_return">Devolução parcial</option>
                    <option value="accepted_closed">Aceitar diferença e encerrar</option>
                    <option value="other">Outra tratativa</option>
                  </select>
                </label>
              )}

              <label className="block text-sm font-black text-gray-700 dark:text-gray-200">{purchaseIssueAction === 'cancel' ? 'Motivo do cancelamento' : purchaseIssueAction === 'resolve' ? 'Como a pendência foi resolvida?' : 'Observação da tratativa'}
                <textarea value={purchaseIssueNotes} onChange={(event) => setPurchaseIssueNotes(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder={purchaseIssueAction === 'resolve' ? 'Ex.: devolução entregue ao fornecedor e documento recebido.' : 'Registre o andamento da tratativa.'} />
              </label>

              {purchaseIssueAction !== 'cancel' && (
                <label className="block text-sm font-black text-gray-700 dark:text-gray-200">Referência / protocolo / documento <span className="font-semibold text-gray-400">(opcional)</span>
                  <input value={purchaseIssueReference} onChange={(event) => setPurchaseIssueReference(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder="Ex.: protocolo, NF de devolução, crédito ou acordo" />
                </label>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => navigate(`/admin/stock/purchase-documents?open=${encodeURIComponent(selectedPurchaseIssue.purchase_document_id)}`)} className="rounded-xl border border-teal-300 px-4 py-2 text-sm font-black text-teal-700 dark:border-teal-700 dark:text-teal-200">Abrir compra</button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => setSelectedPurchaseIssue(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black dark:border-gray-700 dark:text-white">Fechar</button>
                <button type="button" onClick={() => void savePurchaseIssueTreatment()} disabled={purchaseIssueSaving} className={`rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-60 ${purchaseIssueAction === 'cancel' ? 'bg-rose-600' : 'bg-teal-600'}`}>{purchaseIssueSaving ? 'Salvando…' : purchaseIssueAction === 'resolve' ? 'Concluir pendência' : purchaseIssueAction === 'cancel' ? 'Cancelar ressalva' : 'Salvar tratativa'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:rounded-3xl">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">Tratar divergência</h2>
            <p className="mt-1 text-sm text-gray-500" title={getDocumentReferenceTitle(selected.order_code || selected.order_id)}>{getShortDocumentReference(selected.order_code || selected.order_id, { fallbackLabel: 'Venda' })} · {selected.location_name || 'local não identificado'}</p>
            {selected.status !== 'open' && <p className="mt-3 rounded-xl bg-blue-50 p-3 text-xs font-bold text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">Esta divergência já está em tratamento. O próximo estado sugerido é <strong>Resolvida</strong>; altere somente se ainda precisar de nova contagem.</p>}
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-200">Próximo estado
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as TreatmentStatus)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                  <option value="under_review">Em análise</option>
                  <option value="waiting_stock_count">Aguardando contagem física</option>
                  <option value="resolved">Resolvida</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </label>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-200">Tipo de resolução
                <select value={resolutionType} onChange={(event) => setResolutionType(event.target.value)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                  <option value="">Selecione</option>
                  <option value="physical_item_found">Item físico localizado</option>
                  <option value="inventory_count_corrected">Contagem de estoque corrigida</option>
                  <option value="loss_or_waste_registered">Perda/quebra registrada</option>
                  <option value="registration_error">Erro de cadastro ou local</option>
                  <option value="other">Outro</option>
                </select>
              </label>
              <label className="block text-sm font-black text-gray-700 dark:text-gray-200">O que foi conferido?
                <textarea value={resolutionNotes} onChange={(event) => setResolutionNotes(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white" placeholder="Descreva contagem, localização do item, perda ou correção realizada." />
              </label>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-black dark:border-gray-700 dark:text-white">Cancelar</button>
              <button type="button" onClick={() => void saveTreatment()} disabled={saving} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar tratamento'}</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
