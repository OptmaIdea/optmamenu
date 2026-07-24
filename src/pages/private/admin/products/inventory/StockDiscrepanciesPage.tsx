// @ts-nocheck -- diagnóstico temporário; remover antes do merge
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import { useRefreshFrame } from '@/hooks/useRefreshFrame';
import { StockDiscrepancyService, type StockDiscrepancyOccurrence, type StockDiscrepancyStatus } from '@/services/stockDiscrepancyService';

const STATUS_LABELS: Record<StockDiscrepancyStatus, string> = {
  open: 'Aberta',
  under_review: 'Em análise',
  waiting_stock_count: 'Aguardando contagem',
  resolved: 'Resolvida',
  cancelled: 'Cancelada',
};

type TreatmentStatus = 'under_review' | 'waiting_stock_count' | 'resolved' | 'cancelled';

function localDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function StockDiscrepanciesPage() {
  const { storeId, loading: loadingStore } = useCurrentStore();
  const { hasPermission } = usePermissions(storeId ?? null);
  const canResolve = hasPermission('stock.manage') || hasPermission('stock.adjust');
  const [occurrences, setOccurrences] = useState<StockDiscrepancyOccurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StockDiscrepancyStatus | 'all'>('open');
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

  const load = useCallback(async () => {
    if (!storeId) return;
    try {
      setLoading(true);
      const data = await StockDiscrepancyService.list(storeId, status, startDate, endDate);
      setOccurrences(data);
    } catch (error) {
      console.error('Erro ao carregar divergências de estoque:', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as divergências.');
    } finally {
      setLoading(false);
    }
  }, [storeId, status, startDate, endDate]);

  useRefreshFrame(load);

  useEffect(() => {
    if (!loadingStore && storeId) void load();
  }, [loadingStore, storeId, load]);

  const term = search.trim().toLocaleLowerCase('pt-BR');
  const visibleOccurrences = occurrences.filter((occurrence) => {
    if (!term) return true;
    const products = occurrence.items.map((item) => item.product_name || '').join(' ');
    return [
      occurrence.order_code || '',
      occurrence.location_name || '',
      occurrence.operator_name || '',
      products,
    ].some((value) => value.toLocaleLowerCase('pt-BR').includes(term));
  });

  function beginTreatment(occurrence: StockDiscrepancyOccurrence) {
    setSelected(occurrence);
    setNextStatus(occurrence.status === 'waiting_stock_count' ? 'waiting_stock_count' : 'under_review');
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

  if (loadingStore) return <LoadingSpinner />;

  return (
    <PageContainer>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">Auditoria operacional</p>
            <h1 className="mt-1 text-2xl font-black text-gray-900 dark:text-white">Divergências de estoque</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Vendas concluídas sem saldo suficiente permanecem aqui até a conferência física e o registro da causa.
            </p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-black text-gray-700 dark:border-gray-700 dark:text-gray-200">
            <RefreshCw size={16} /> Atualizar
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-black uppercase tracking-widest text-gray-400">No filtro</p>
            <p className="mt-2 text-2xl font-black text-gray-900 dark:text-white">{occurrences.length}</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <p className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">Abertas</p>
            <p className="mt-2 text-2xl font-black text-amber-900 dark:text-amber-100">{occurrences.filter((item) => item.status === 'open').length}</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
            <p className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">Em tratamento</p>
            <p className="mt-2 text-2xl font-black text-blue-900 dark:text-blue-100">{occurrences.filter((item) => item.status === 'under_review' || item.status === 'waiting_stock_count').length}</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative xl:col-span-2">
            <Search size={16} className="absolute left-3 top-3 text-gray-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Venda, produto, local ou operador" className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          </label>
          <select value={status} onChange={(event) => setStatus(event.target.value as StockDiscrepancyStatus | 'all')} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white">
            <option value="all">Todos os estados</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white" />
        </div>

        {loading ? <LoadingSpinner /> : visibleOccurrences.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 p-12 text-center text-sm font-bold text-gray-500 dark:border-gray-700">
            Nenhuma divergência encontrada neste filtro.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleOccurrences.map((occurrence) => (
              <article key={occurrence.id} className="rounded-3xl border border-gray-100 bg-white p-5 shadow-xs dark:border-gray-800 dark:bg-gray-900">
                <div className="flex flex-col gap-4 xl:flex-row xl:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                        <AlertTriangle size={13} /> {STATUS_LABELS[occurrence.status]}
                      </span>
                      <span className="text-xs font-bold text-gray-400">{new Date(occurrence.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <h2 className="mt-3 text-lg font-black text-gray-900 dark:text-white">
                      Venda {occurrence.order_code || occurrence.order_id?.slice(0, 8) || '—'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Local: {occurrence.location_name || 'Não identificado'} · Operador: {occurrence.operator_name || 'Não identificado'}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {occurrence.items.map((item, index) => (
                        <div key={item.product_id || index} className="rounded-2xl bg-gray-50 p-3 dark:bg-gray-950/60">
                          <p className="font-black text-gray-900 dark:text-white">{item.product_name || 'Produto'}</p>
                          <p className="mt-1 text-xs font-bold text-gray-500">
                            Solicitado {Number(item.requested_quantity ?? item.requested ?? 0)}
                            {' · '}disponível {Number(item.available_quantity ?? item.available ?? 0)}
                            {' · '}divergência {Number(item.shortage_quantity ?? item.shortage ?? 0)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {canResolve && <button type="button" onClick={() => beginTreatment(occurrence)} className="h-fit shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white">Tratar divergência</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-gray-900 sm:rounded-3xl">
            <h2 className="text-xl font-black text-gray-900 dark:text-white">Tratar divergência</h2>
            <p className="mt-1 text-sm text-gray-500">Venda {selected.order_code || selected.order_id?.slice(0, 8) || '—'} · {selected.location_name || 'local não identificado'}</p>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-black text-gray-700 dark:text-gray-200">Próximo estado
                <select value={nextStatus} onChange={(event) => setNextStatus(event.target.value as TreatmentStatus)} className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-950 dark:text-white">
                  <option value="under_review">Em análise</option>
                  <option value="waiting_stock_count">Aguardando contagem</option>
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
