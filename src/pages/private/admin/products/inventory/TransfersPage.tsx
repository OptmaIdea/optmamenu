import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Search, X, Boxes, ChevronDown, ChevronUp } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import TransferListTable from './components/TransferListTable';
import { useStockTransfers } from './hooks/useStockTransfers';
import { downloadCsv } from '@/utils/export/csv';
import { formatDateTimePtBr, formatNumberPtBr } from '@/utils/export/formatters';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { InventoryQuickNav } from './components/InventoryQuickNav';
import { toast } from 'sonner';
import { stockService } from '@/services/stockService';
import { supabase } from '@/lib/supabase';
import { useStockTransferSuggestions } from './hooks/useStockTransferSuggestions';
import { useInventoryTransit } from './hooks/useInventoryTransit';
import type { StockTransferSuggestion } from './types/transferSuggestion.types';

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'pending', label: 'Pendente' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'shipped', label: 'Enviada' },
  { value: 'received', label: 'Recebida' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'divergent', label: 'Divergente' },
];

const getTransferStatusLabel = (status: string | null | undefined) => {
  switch (status) {
    case 'draft':
      return 'Rascunho';
    case 'approved':
      return 'Aprovada';
    case 'shipped':
      return 'Enviada';
    case 'received':
      return 'Recebida';
    case 'cancelled':
      return 'Cancelada';
    case 'divergent':
      return 'Divergente';
    default:
      return status ?? '';
  }
};

export default function TransfersPage() {
  const { rows, loading, refresh } = useStockTransfers();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    suggestions: allSuggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    refresh: refreshSuggestions,
  } = useStockTransferSuggestions();

  // Obtém storeId a partir da primeira transferência disponível (ou undefined)
  const storeIdForTransit = rows[0]?.store_id ?? undefined;
  const { rows: transitRows } = useInventoryTransit(storeIdForTransit);

  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(new Set());
  const [suggestionQuantities, setSuggestionQuantities] = useState<Record<string, number>>({});
  const [creatingBatchDraft, setCreatingBatchDraft] = useState(false);

  const getSuggestionKey = (suggestion: StockTransferSuggestion) => {
    return `${suggestion.source_location_id}:${suggestion.destination_location_id}:${suggestion.product_id}`;
  };

  const transitByDestinationProduct = useMemo(() => {
    const map = new Map<string, number>();
    transitRows.forEach((row) => {
      const key = `${row.location_id}:${row.product_id}`;
      map.set(key, Number(row.in_transit_in ?? 0));
    });
    return map;
  }, [transitRows]);

  const suggestions = useMemo(() => {
    return allSuggestions.filter((suggestion) => {
      const key = `${suggestion.destination_location_id}:${suggestion.product_id}`;
      const incoming = transitByDestinationProduct.get(key) ?? 0;
      const needed = Number(suggestion.suggested_qty ?? suggestion.destination_need ?? 0);
      return incoming < needed;
    });
  }, [allSuggestions, transitByDestinationProduct]);

  const suggestionGroups = useMemo(() => {
    const groups = new Map<string, StockTransferSuggestion[]>();

    suggestions.forEach((suggestion) => {
      const groupKey = `${suggestion.source_location_id}:${suggestion.destination_location_id}`;
      const current = groups.get(groupKey) ?? [];
      current.push(suggestion);
      groups.set(groupKey, current);
    });

    return Array.from(groups.entries()).map(([key, items]) => ({
      key,
      sourceLocationId: items[0]?.source_location_id,
      sourceLocationName: items[0]?.source_location_name,
      destinationLocationId: items[0]?.destination_location_id,
      destinationLocationName: items[0]?.destination_location_name,
      items,
    }));
  }, [suggestions]);

  useEffect(() => {
    if (!suggestions.length) return;

    setSelectedSuggestionKeys((current) => {
      if (current.size > 0) return current;

      return new Set(suggestions.map(getSuggestionKey));
    });

    setSuggestionQuantities((current) => {
      if (Object.keys(current).length > 0) return current;

      return suggestions.reduce<Record<string, number>>((acc, suggestion) => {
        acc[getSuggestionKey(suggestion)] = Number(suggestion.suggested_qty ?? 1);
        return acc;
      }, {});
    });
  }, [suggestions]);

  const toggleSuggestion = (suggestion: StockTransferSuggestion) => {
    const key = getSuggestionKey(suggestion);

    setSelectedSuggestionKeys((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const toggleGroupSelection = (items: StockTransferSuggestion[]) => {
    const keysInGroup = items.map(getSuggestionKey);
    
    setSelectedSuggestionKeys((current) => {
      const next = new Set(current);
      const allSelected = keysInGroup.every((k) => next.has(k));

      if (allSelected) {
        keysInGroup.forEach((k) => next.delete(k));
      } else {
        keysInGroup.forEach((k) => next.add(k));
      }

      return next;
    });
  };

  const updateSuggestionQty = (suggestion: StockTransferSuggestion, quantity: number) => {
    const key = getSuggestionKey(suggestion);

    setSuggestionQuantities((current) => ({
      ...current,
      [key]: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    }));
  };

  const handleCreateBatchDraft = async (group: {
    sourceLocationId: string;
    destinationLocationId: string;
    items: StockTransferSuggestion[];
  }) => {
    const selectedItems = group.items
      .filter((suggestion) => selectedSuggestionKeys.has(getSuggestionKey(suggestion)))
      .map((suggestion) => ({
        productId: suggestion.product_id,
        quantity: suggestionQuantities[getSuggestionKey(suggestion)] ?? Number(suggestion.suggested_qty ?? 1),
      }))
      .filter((item) => item.quantity > 0);

    if (!selectedItems.length) {
      toast.warning('Selecione ao menos um produto para criar o rascunho.');
      return;
    }

    try {
      setCreatingBatchDraft(true);

      const result = await stockService.createStockTransferDraftBatch({
        sourceLocationId: group.sourceLocationId,
        destinationLocationId: group.destinationLocationId,
        items: selectedItems,
        notes: 'Rascunho em lote criado a partir das sugestões gerenciais de transferência.',
      });

      toast.success(
        `Rascunho ${result.transfer_code} criado com ${result.items_count} item(ns).`
      );

      await refresh();
      await refreshSuggestions();

      navigate(`/admin/transfers/${result.transfer_id}`);
    } catch (error) {
      console.error('Erro ao criar rascunho em lote:', error);
      toast.error('Não foi possível criar o rascunho em lote.');
    } finally {
      setCreatingBatchDraft(false);
    }
  };

  const prefillTransfer = useMemo(() => {
    const productId = searchParams.get('product_id');
    const sourceLocationId = searchParams.get('source_location_id');
    const destinationLocationId = searchParams.get('destination_location_id');
    const suggestedQty = Number(searchParams.get('suggested_qty') ?? 0);

    if (!productId || !sourceLocationId || !destinationLocationId) {
      return null;
    }

    return {
      productId,
      sourceLocationId,
      destinationLocationId,
      suggestedQty: Number.isFinite(suggestedQty) && suggestedQty > 0 ? suggestedQty : 1,
    };
  }, [searchParams]);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [destinationFilter, setDestinationFilter] = useState('all');

  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftQty, setDraftQty] = useState<number>(prefillTransfer?.suggestedQty ?? 1);
  const [prefillPreview, setPrefillPreview] = useState<any | null>(null);

  useEffect(() => {
    if (!prefillTransfer) {
      setPrefillPreview(null);
      return;
    }

    setDraftQty(prefillTransfer.suggestedQty);

    const loadPreview = async () => {
      const { data, error } = await supabase.rpc('get_transfer_prefill_preview', {
        p_product_id: prefillTransfer.productId,
        p_source_location_id: prefillTransfer.sourceLocationId,
        p_destination_location_id: prefillTransfer.destinationLocationId,
      });

      if (error) {
        console.error('Erro ao carregar preview da sugestão:', error);
        setPrefillPreview(null);
        return;
      }

      setPrefillPreview(data?.[0] ?? null);
    };

    loadPreview();
  }, [prefillTransfer]);

  const clearPrefillParams = () => {
    setSearchParams({});
  };

  const handleCreateDraftFromPrefill = async () => {
    if (!prefillTransfer) return;

    try {
      setCreatingDraft(true);

      const result = await stockService.createStockTransferDraftFromSuggestion({
        productId: prefillTransfer.productId,
        sourceLocationId: prefillTransfer.sourceLocationId,
        destinationLocationId: prefillTransfer.destinationLocationId,
        quantity: draftQty,
        notes: 'Rascunho criado a partir da sugestão gerencial de estoque.',
      });

      toast.success(`Rascunho ${result.transfer_code} criado com sucesso.`);

      clearPrefillParams();
      await refresh();

      navigate(`/admin/transfers/${result.transfer_id}`);
    } catch (error) {
      console.error('Erro ao criar rascunho de transferência:', error);
      toast.error('Não foi possível criar o rascunho da transferência.');
    } finally {
      setCreatingDraft(false);
    }
  };

  const sourceOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Todas as origens' }];
    for (const r of rows) {
      if (!seen.has(r.source_location_id)) {
        seen.add(r.source_location_id);
        opts.push({ value: r.source_location_id, label: r.source_location_name });
      }
    }
    return opts;
  }, [rows]);

  const destinationOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: 'all', label: 'Todos os destinos' }];
    for (const r of rows) {
      if (!seen.has(r.destination_location_id)) {
        seen.add(r.destination_location_id);
        opts.push({ value: r.destination_location_id, label: r.destination_location_name });
      }
    }
    return opts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    const q = search.trim().toLowerCase();

    if (q) {
      result = result.filter(
        (r) =>
          (r.transfer_code ?? '').toLowerCase().includes(q) ||
          (r.notes ?? '').toLowerCase().includes(q) ||
          r.source_location_name.toLowerCase().includes(q) ||
          r.destination_location_name.toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      result = result.filter((r) => new Date(r.requested_at) >= new Date(`${dateFrom}T00:00:00`));
    }

    if (dateTo) {
      result = result.filter((r) => new Date(r.requested_at) <= new Date(`${dateTo}T23:59:59`));
    }

    if (statusFilter !== 'all') {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (sourceFilter !== 'all') {
      result = result.filter((r) => r.source_location_id === sourceFilter);
    }

    if (destinationFilter !== 'all') {
      result = result.filter((r) => r.destination_location_id === destinationFilter);
    }

    return result;
  }, [rows, search, dateFrom, dateTo, statusFilter, sourceFilter, destinationFilter]);

  const hasFilters =
    search.trim() !== '' ||
    dateFrom !== '' ||
    dateTo !== '' ||
    statusFilter !== 'all' ||
    sourceFilter !== 'all' ||
    destinationFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setStatusFilter('all');
    setSourceFilter('all');
    setDestinationFilter('all');
  };

  const handleExportCsv = () => {
    downloadCsv({
      filename: `transferencias_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Código',
        'Origem',
        'Destino',
        'Status',
        'Solicitada em',
        'Enviada em',
        'Recebida em',
        'Itens',
        'Quantidade solicitada',
        'Quantidade enviada',
        'Quantidade recebida',
        'Observações',
      ],
      rows: filteredRows.map((row) => [
        row.transfer_code ?? '',
        row.source_location_name ?? '',
        row.destination_location_name ?? '',
        getTransferStatusLabel(row.status),
        formatDateTimePtBr(row.requested_at),
        formatDateTimePtBr(row.shipped_at),
        formatDateTimePtBr(row.received_at),
        formatNumberPtBr(row.items_count ?? 0),
        formatNumberPtBr(row.total_requested_qty ?? 0),
        formatNumberPtBr(row.total_shipped_qty ?? 0),
        formatNumberPtBr(row.total_received_qty ?? 0),
        row.notes ?? '',
      ]),
    });
  };

  if (loading) return <LoadingSpinner />;

  const total = rows.length;
  const divergent = rows.filter((r) => r.status === 'divergent').length;
  const shipped = rows.filter((r) => r.status === 'shipped').length;
  const received = rows.filter((r) => r.status === 'received').length;

  const hasAnyData = rows.length > 0;

  if (!loading && !hasAnyData) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transferências</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gestão de transferências entre locais de estoque.
            </p>
          </div>
        </div>
        <EmptyState
          icon={<ArrowRightLeft className="h-5 w-5" />}
          title="Nenhuma transferência cadastrada ainda"
          description="Quando você criar transferências entre locais, elas aparecerão aqui com status, datas e quantidades."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transferências</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gestão de transferências entre locais de estoque.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InventoryQuickNav />
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition whitespace-nowrap shrink-0"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {prefillTransfer && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-blue-300">
                <ArrowRightLeft size={16} />
                Sugestão de transferência recebida
              </div>

              <p className="mt-1 text-sm text-blue-700/80 dark:text-blue-300/80">
                A camada gerencial identificou uma possível transferência interna.
                Revise os dados antes de criar o rascunho.
              </p>

              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-900/40">
                  <p className="text-gray-500 dark:text-gray-400">Produto</p>
                  <p className="mt-1 font-semibold text-gray-800 dark:text-gray-100">
                    {prefillPreview?.product_name ?? prefillTransfer.productId}
                  </p>
                </div>

                <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-900/40">
                  <p className="text-gray-500 dark:text-gray-400">Origem</p>
                  <p className="mt-1 font-semibold text-gray-800 dark:text-gray-100">
                    {prefillPreview?.source_location_name ?? prefillTransfer.sourceLocationId}
                  </p>
                  {prefillPreview && (
                    <p className="text-[11px] text-gray-500">
                      Disp.: {formatNumberPtBr(prefillPreview.source_available ?? 0)}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-900/40">
                  <p className="text-gray-500 dark:text-gray-400">Destino</p>
                  <p className="mt-1 font-semibold text-gray-800 dark:text-gray-100">
                    {prefillPreview?.destination_location_name ?? prefillTransfer.destinationLocationId}
                  </p>
                  {prefillPreview && (
                    <p className="text-[11px] text-gray-500">
                      Disp.: {formatNumberPtBr(prefillPreview.destination_available ?? 0)}
                    </p>
                  )}
                </div>

                <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-900/40">
                  <p className="text-gray-500 dark:text-gray-400">Quantidade</p>
                  <input
                    type="number"
                    min={1}
                    value={draftQty}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setDraftQty(Number.isFinite(value) && value > 0 ? value : 1);
                    }}
                    className="mt-1 w-full rounded-lg border border-blue-100 bg-white px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-200 dark:border-blue-900 dark:bg-gray-950"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                <span>
                  Este rascunho ainda não movimenta estoque. A movimentação só deve ocorrer
                  nos fluxos de envio/recebimento já existentes.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              <button
                type="button"
                onClick={clearPrefillParams}
                disabled={creatingDraft}
                className="inline-flex items-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60 dark:border-blue-800 dark:bg-gray-900 dark:text-blue-300"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleCreateDraftFromPrefill}
                disabled={creatingDraft}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                <CheckCircle2 size={15} />
                {creatingDraft ? 'Criando...' : 'Criar rascunho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Boxes size={16} />
                Sugestões de transferência disponíveis
              </div>

              <p className="mt-1 text-sm text-emerald-700/80 dark:text-emerald-300/80">
                Monte uma remessa com vários produtos sugeridos pela camada gerencial.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowSuggestionsPanel((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {showSuggestionsPanel ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showSuggestionsPanel ? 'Ocultar sugestões' : 'Ver sugestões'}
            </button>
          </div>

          {showSuggestionsPanel && (
            <div className="mt-4 space-y-4">
              {suggestionsLoading && (
                <div className="rounded-xl bg-white/70 p-3 text-sm text-gray-500 dark:bg-gray-900/40">
                  Carregando sugestões...
                </div>
              )}

              {suggestionsError && (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/20 dark:text-red-300">
                  {suggestionsError}
                </div>
              )}

              {suggestionGroups.map((group) => {
                const selectedCount = group.items.filter((suggestion) =>
                  selectedSuggestionKeys.has(getSuggestionKey(suggestion))
                ).length;
                const allSelected = selectedCount === group.items.length && group.items.length > 0;

                return (
                  <div
                    key={group.key}
                    className="rounded-2xl border border-emerald-100 bg-white/80 p-3 dark:border-emerald-900/40 dark:bg-gray-900/40"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {group.sourceLocationName} → {group.destinationLocationName}
                        </p>

                        <p className="text-xs text-gray-500">
                          {selectedCount} de {group.items.length} produto(s) selecionado(s)
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleCreateBatchDraft({
                            sourceLocationId: group.sourceLocationId,
                            destinationLocationId: group.destinationLocationId,
                            items: group.items,
                          })
                        }
                        disabled={creatingBatchDraft || selectedCount === 0}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        {creatingBatchDraft ? 'Criando...' : 'Criar rascunho com selecionados'}
                      </button>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-500">
                            <th className="py-2 pr-3">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() => toggleGroupSelection(group.items)}
                                title={allSelected ? "Desmarcar todos" : "Marcar todos"}
                                className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            </th>
                            <th className="py-2 pr-3">Produto</th>
                            <th className="py-2 pr-3">Origem disponível</th>
                            <th className="py-2 pr-3">Destino disponível</th>
                            <th className="py-2 pr-3">Necessidade</th>
                            <th className="py-2 pr-3">Qtd.</th>
                            <th className="py-2 pr-3">Risco</th>
                          </tr>
                        </thead>

                        <tbody>
                          {group.items.map((suggestion) => {
                            const key = getSuggestionKey(suggestion);
                            const selected = selectedSuggestionKeys.has(key);

                            return (
                              <tr
                                key={key}
                                className="border-t border-gray-100 dark:border-gray-700"
                              >
                                <td className="py-2 pr-3">
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={() => toggleSuggestion(suggestion)}
                                    className="h-4 w-4 rounded border-gray-300 text-emerald-600"
                                  />
                                </td>

                                <td className="py-2 pr-3">
                                  <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {suggestion.product_name}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {suggestion.warning_message}
                                  </div>
                                </td>

                                <td className="py-2 pr-3">
                                  {formatNumberPtBr(suggestion.source_available ?? 0)}
                                </td>

                                <td className="py-2 pr-3">
                                  {formatNumberPtBr(suggestion.destination_available ?? 0)}
                                </td>

                                <td className="py-2 pr-3">
                                  {formatNumberPtBr(suggestion.destination_need ?? 0)}
                                </td>

                                <td className="py-2 pr-3">
                                  <input
                                    type="number"
                                    min={1}
                                    value={
                                      suggestionQuantities[key] ??
                                      Number(suggestion.suggested_qty ?? 1)
                                    }
                                    onChange={(event) =>
                                      updateSuggestionQty(
                                        suggestion,
                                        Number(event.target.value)
                                      )
                                    }
                                    disabled={!selected}
                                    className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
                                  />
                                </td>

                                <td className="py-2 pr-3">
                                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    {suggestion.risk_level === 'medium'
                                      ? 'Médio'
                                      : suggestion.risk_level === 'high'
                                        ? 'Alto'
                                        : 'Baixo'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: total },
          { label: 'Enviadas', value: shipped },
          { label: 'Recebidas', value: received },
          { label: 'Divergentes', value: divergent, alert: divergent > 0 },
        ].map(({ label, value, alert }) => (
          <div key={label} className={`rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border ${alert ? 'border-amber-300 dark:border-amber-700' : 'border-gray-100 dark:border-gray-700'}`}>
            <div className="text-sm text-gray-500">{label}</div>
            <div className={`text-2xl font-bold ${alert ? 'text-amber-600 dark:text-amber-400' : ''}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por código, origem, destino ou observação"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          <input
            type="date"
            title="Data inicial (formato dd/mm/aaaa)"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            aria-label="Data inicial"
          />

          <input
            type="date"
            title="Data final (formato dd/mm/aaaa)"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
            aria-label="Data final"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
          >
            {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#21A896]/40"
          >
            {destinationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="mt-1 flex flex-wrap gap-4 text-[11px] text-gray-400">
          <span>Formato das datas: dd/mm/aaaa</span>
        </div>

        {hasFilters && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition">
              <X size={14} />
              Limpar filtros
            </button>
            <p className="text-xs text-gray-400">
              {filteredRows.length} de {rows.length} transferência{rows.length !== 1 ? 's' : ''} exibida{filteredRows.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      <TransferListTable rows={filteredRows} onClearFilters={hasFilters ? clearFilters : undefined} />
    </div>
  );
}
