import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Search, X, Boxes, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageContainer from '@/components/common/PageContainer';
import TransferListTable from './components/TransferListTable';
import { useStockTransfers } from './hooks/useStockTransfers';
import { downloadCsv } from '@/utils/export/csv';
import { formatNumberPtBr } from '@/utils/export/formatters';
import { formatDateTimeForExportPtBr, toAppDate, getLocalDateInputValue } from '@/utils/dateTime';
import EmptyState from '@/components/common/empty-state/EmptyState';
import { toast } from 'sonner';
import { stockService } from '@/services/stockService';
import type { InventoryPositionRow } from '@/services/stockService';
import { supabase } from '@/lib/supabase';
import { useStockTransferSuggestions } from './hooks/useStockTransferSuggestions';
import { useInventoryTransit } from './hooks/useInventoryTransit';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
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

type ManualBatchTransferItem = {
  productId: string;
  quantity: number;
};

const createEmptyManualBatchItem = (): ManualBatchTransferItem => ({
  productId: '',
  quantity: 1,
});

export default function TransfersPage() {
  const { rows, loading, refresh } = useStockTransfers();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'));
  }, []);

  const { storeId, loading: loadingStore } = useCurrentStore();

  // Permissões
  const { hasPermission } = usePermissions(storeId ?? null);
  const canCreateTransfers = hasPermission('transfers.create');
  // const canConfirmTransfers = hasPermission('transfers.confirm');
  // const canCancelTransfers = hasPermission('transfers.cancel');

  const {
    suggestions: allSuggestions,
    loading: suggestionsLoading,
    error: suggestionsError,
    refresh: refreshSuggestions,
  } = useStockTransferSuggestions();

  // Obtém storeId a partir da loja atual ou da primeira transferência disponível.
  const storeIdForTransit = storeId ?? rows[0]?.store_id ?? undefined;
  const { rows: transitRows } = useInventoryTransit(storeIdForTransit);

  const [showSuggestionsPanel, setShowSuggestionsPanel] = useState(false);
  const [selectedSuggestionKeys, setSelectedSuggestionKeys] = useState<Set<string>>(new Set());
  const [suggestionQuantities, setSuggestionQuantities] = useState<Record<string, number>>({});
  const [creatingBatchDraft, setCreatingBatchDraft] = useState(false);

  const [showManualBatchModal, setShowManualBatchModal] = useState(false);
  const [loadingManualInventory, setLoadingManualInventory] = useState(false);
  const [creatingManualBatchDraft, setCreatingManualBatchDraft] = useState(false);
  const [manualInventoryRows, setManualInventoryRows] = useState<InventoryPositionRow[]>([]);
  const [manualSourceLocationId, setManualSourceLocationId] = useState('');
  const [manualDestinationLocationId, setManualDestinationLocationId] = useState('');
  const [manualBatchItems, setManualBatchItems] = useState<ManualBatchTransferItem[]>([
    createEmptyManualBatchItem(),
  ]);
  const [manualBatchNotes, setManualBatchNotes] = useState('');

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
        acc[getSuggestionKey(suggestion)] = Number(suggestion.suggested_qty ?? suggestion.destination_need ?? 1);
        return acc;
      }, {});
    });
  }, [suggestions]);


  const manualLocationOptions = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();

    manualInventoryRows.forEach((row) => {
      if (!row.location_active) return;

      map.set(row.location_id, {
        id: row.location_id,
        code: row.location_code,
        name: row.location_name,
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [manualInventoryRows]);

  const manualProductOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; available: number }>();

    manualInventoryRows.forEach((row) => {
      if (!row.product_active) return;

      const current = map.get(row.product_id);
      const available = Number(row.available ?? 0);

      map.set(row.product_id, {
        id: row.product_id,
        name: row.product_name,
        available: (current?.available ?? 0) + available,
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [manualInventoryRows]);

  const getManualSourceProductAvailable = (productId: string) => {
    if (!productId || !manualSourceLocationId) return null;

    const row = manualInventoryRows.find(
      (item) => item.location_id === manualSourceLocationId && item.product_id === productId
    );

    return Number(row?.available ?? 0);
  };

  const openManualBatchModal = async () => {
    setShowManualBatchModal(true);

    if (!storeId) return;

    try {
      setLoadingManualInventory(true);
      const inventory = await stockService.getInventoryPositionByStore(storeId);
      setManualInventoryRows(inventory);

      const activeLocations = Array.from(
        new Map(
          inventory
            .filter((row) => row.location_active)
            .map((row) => [row.location_id, row] as const)
        ).values()
      );

      const nextSourceLocationId = manualSourceLocationId || activeLocations[0]?.location_id || '';

      if (!manualSourceLocationId && nextSourceLocationId) {
        setManualSourceLocationId(nextSourceLocationId);
      }

      if (!manualDestinationLocationId) {
        const defaultDestination = activeLocations.find(
          (location) => location.location_id !== nextSourceLocationId
        );
        if (defaultDestination) setManualDestinationLocationId(defaultDestination.location_id);
      }
    } catch (error) {
      console.error('Erro ao carregar dados para transferência manual:', error);
      toast.error('Não foi possível carregar produtos e locais para transferência manual.');
    } finally {
      setLoadingManualInventory(false);
    }
  };

  const closeManualBatchModal = () => {
    if (creatingManualBatchDraft) return;
    setShowManualBatchModal(false);
  };

  const updateManualBatchItem = (
    index: number,
    updates: Partial<ManualBatchTransferItem>
  ) => {
    setManualBatchItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...updates } : item
      )
    );
  };

  const addManualBatchItem = () => {
    setManualBatchItems((current) => [...current, createEmptyManualBatchItem()]);
  };

  const removeManualBatchItem = (index: number) => {
    setManualBatchItems((current) =>
      current.length <= 1
        ? [createEmptyManualBatchItem()]
        : current.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const handleCreateManualBatchDraft = async () => {
    if (!canCreateTransfers) {
      toast.error('Você não tem permissão para criar transferências.');
      return;
    }

    if (!storeId) {
      toast.error('Loja atual não identificada. Atualize a página e tente novamente.');
      return;
    }

    if (!manualSourceLocationId || !manualDestinationLocationId) {
      toast.warning('Informe origem e destino da transferência.');
      return;
    }

    if (manualSourceLocationId === manualDestinationLocationId) {
      toast.warning('Origem e destino precisam ser locais diferentes.');
      return;
    }

    const normalizedItems = manualBatchItems
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

    if (!normalizedItems.length) {
      toast.warning('Adicione ao menos um produto com quantidade válida.');
      return;
    }

    const duplicatedProductId = normalizedItems.find((item, index) =>
      normalizedItems.some((other, otherIndex) => other.productId === item.productId && otherIndex !== index)
    )?.productId;

    if (duplicatedProductId) {
      toast.warning('Há produtos repetidos na transferência. Mantenha uma única linha por produto.');
      return;
    }

    const unavailableItem = normalizedItems.find((item) => {
      const available = getManualSourceProductAvailable(item.productId);
      return available !== null && item.quantity > available;
    });

    if (unavailableItem) {
      const productName = manualProductOptions.find((product) => product.id === unavailableItem.productId)?.name;
      toast.warning(
        `Quantidade maior que o disponível na origem${productName ? ` para ${productName}` : ''}.`
      );
      return;
    }

    try {
      setCreatingManualBatchDraft(true);

      const result = await stockService.createStockTransferDraftBatch({
        sourceLocationId: manualSourceLocationId,
        destinationLocationId: manualDestinationLocationId,
        items: normalizedItems,
        notes:
          manualBatchNotes.trim() ||
          'Rascunho manual em lote criado pela tela de transferências.',
      });

      toast.success(
        `Rascunho ${result.transfer_code} criado com ${result.items_count} item(ns).`
      );

      setShowManualBatchModal(false);
      setManualBatchItems([createEmptyManualBatchItem()]);
      setManualBatchNotes('');
      await refresh();
      await refreshSuggestions();
      navigate(`/admin/transfers/${result.transfer_id}`);
    } catch (error) {
      console.error('Erro ao criar transferência manual em lote:', error);
      toast.error('Não foi possível criar a transferência manual em lote.');
    } finally {
      setCreatingManualBatchDraft(false);
    }
  };

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
      [key]: Number.isFinite(quantity) && quantity > 0 ? quantity : 0,
    }));
  };

  const normalizeSuggestionQty = (suggestion: StockTransferSuggestion) => {
    const key = getSuggestionKey(suggestion);
    const fallback = Number(suggestion.suggested_qty ?? suggestion.destination_need ?? 1);
    const current = Number(suggestionQuantities[key] ?? fallback);
    if (!Number.isFinite(current) || current <= 0) {
      setSuggestionQuantities((state) => ({
        ...state,
        [key]: Number.isFinite(fallback) && fallback > 0 ? fallback : 1,
      }));
    }
  };

  const handleCreateBatchDraft = async (group: {
    sourceLocationId: string;
    destinationLocationId: string;
    items: StockTransferSuggestion[];
  }) => {
    if (!canCreateTransfers) {
      toast.error('Você não tem permissão para criar transferências.');
      return;
    }

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

    if (!canCreateTransfers) {
      toast.error('Você não tem permissão para criar transferências.');
      return;
    }

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
      result = result.filter((r) => (toAppDate(r.requested_at)?.getTime() ?? 0) >= new Date(`${dateFrom}T00:00:00`).getTime());
    }

    if (dateTo) {
      result = result.filter((r) => (toAppDate(r.requested_at)?.getTime() ?? 0) <= new Date(`${dateTo}T23:59:59`).getTime());
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
      filename: `transferencias_${getLocalDateInputValue()}.csv`,
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
        row.requested_at_display ?? formatDateTimeForExportPtBr(row.requested_at),
        row.shipped_at_display ?? formatDateTimeForExportPtBr(row.shipped_at),
        row.received_at_display ?? formatDateTimeForExportPtBr(row.received_at),
        formatNumberPtBr(row.items_count ?? 0),
        formatNumberPtBr(row.total_requested_qty ?? 0),
        formatNumberPtBr(row.total_shipped_qty ?? 0),
        formatNumberPtBr(row.total_received_qty ?? 0),
        row.notes ?? '',
      ]),
    });
  };

  if (loading || loadingStore) return <LoadingSpinner />;

  const total = rows.length;
  const divergent = rows.filter((r) => r.status === 'divergent').length;
  const shipped = rows.filter((r) => r.status === 'shipped').length;
  const received = rows.filter((r) => r.status === 'received').length;

  const hasAnyData = rows.length > 0;

  if (!loading && !hasAnyData) {
    return (
      <PageContainer
        title="Transferências"
        subtitle="Gestão de transferências entre locais de estoque."
        category="Produtos"
        icon={<ArrowRightLeft size={28} className="text-[#19A999]" />}
        flat
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
          {canCreateTransfers && (
            <button
              type="button"
              onClick={openManualBatchModal}
              disabled={!storeId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-3 py-2 text-sm font-semibold text-white hover:bg-[#1b8f80] disabled:opacity-60"
            >
              <Plus size={15} />
              Nova transferência manual
            </button>
          )}
        </div>
        <EmptyState
          icon={<ArrowRightLeft className="h-5 w-5" />}
          title="Nenhuma transferência cadastrada ainda"
          description="Quando você criar transferências entre locais, elas aparecerão aqui com status, datas e quantidades."
        />
      </PageContainer>
    );
  }

  return (
    <>
      {portalContainer && createPortal(
        <div className="flex items-center gap-2">
          {canCreateTransfers && (
            <button
              type="button"
              onClick={openManualBatchModal}
              disabled={!storeId}
              className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#19A999] hover:bg-[#14887B] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0 disabled:opacity-60"
            >
              <Plus size={13} />
              <span>Nova Transferência Manual</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <span>Exportar CSV</span>
          </button>
        </div>,
        portalContainer
      )}

      <PageContainer
        title="Transferências"
        subtitle="Gestão de transferências entre locais de estoque."
        category="Produtos"
        icon={<ArrowRightLeft size={28} className="text-[#19A999]" />}
        onRefresh={refresh}
        flat
      >

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
                    value={draftQty || ''}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                    onBlur={() => {
                      if (!Number.isFinite(Number(draftQty)) || Number(draftQty) <= 0) {
                        setDraftQty(prefillTransfer.suggestedQty);
                      }
                    }}
                    onChange={(event) => {
                      const value = event.target.value === '' ? 0 : Number(event.target.value);
                      setDraftQty(Number.isFinite(value) && value > 0 ? value : 0);
                    }}
                    disabled={!canCreateTransfers || creatingDraft}
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
                disabled={!canCreateTransfers || creatingDraft}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
              {!canCreateTransfers && (
                <p className="rounded-xl border border-emerald-200 bg-white/70 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-900/50 dark:bg-gray-900/50 dark:text-emerald-200">
                  Você pode visualizar as sugestões, mas não tem permissão para criar rascunhos de transferência.
                </p>
              )}
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
                        disabled={!canCreateTransfers || creatingBatchDraft || selectedCount === 0}
                        className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                                disabled={!canCreateTransfers || creatingBatchDraft}
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
                                    disabled={!canCreateTransfers || creatingBatchDraft || !selected}
                                    className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-700 dark:bg-gray-950"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por código, origem, destino ou observação"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
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
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
            aria-label="Data inicial"
          />

          <input
            type="date"
            title="Data final (formato dd/mm/aaaa)"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
            aria-label="Data final"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
          >
            {sourceOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            className="py-2 px-3 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#19A999]/40"
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



      {showManualBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900">
            <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 dark:border-gray-800 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Nova transferência manual em lote
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Monte um rascunho com um ou vários produtos, sem depender de sugestão gerencial.
                </p>
              </div>

              <button
                type="button"
                onClick={closeManualBatchModal}
                disabled={creatingManualBatchDraft}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-60 dark:hover:bg-gray-800"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            {loadingManualInventory ? (
              <div className="flex min-h-48 items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Origem</label>
                    <select
                      value={manualSourceLocationId}
                      onChange={(event) => setManualSourceLocationId(event.target.value)}
                      disabled={!canCreateTransfers || creatingManualBatchDraft}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="">Selecione a origem</option>
                      {manualLocationOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} {location.code ? `(${location.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Destino</label>
                    <select
                      value={manualDestinationLocationId}
                      onChange={(event) => setManualDestinationLocationId(event.target.value)}
                      disabled={!canCreateTransfers || creatingManualBatchDraft}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="">Selecione o destino</option>
                      {manualLocationOptions.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name} {location.code ? `(${location.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-950/40">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Itens</h3>
                      <p className="text-xs text-gray-500">O rascunho não movimenta estoque. O estoque só muda no envio e recebimento.</p>
                    </div>

                    <button
                      type="button"
                      onClick={addManualBatchItem}
                      disabled={!canCreateTransfers || creatingManualBatchDraft}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <Plus size={14} />
                      Adicionar item
                    </button>
                  </div>

                  <div className="space-y-3">
                    {manualBatchItems.map((item, index) => {
                      const available = getManualSourceProductAvailable(item.productId);

                      return (
                        <div
                          key={`${index}-${item.productId || 'empty'}`}
                          className="grid grid-cols-1 gap-2 rounded-xl bg-white p-3 dark:bg-gray-900 md:grid-cols-[minmax(0,1fr)_140px_120px_44px] md:items-end"
                        >
                          <div>
                            <label className="text-xs font-medium text-gray-500">Produto</label>
                            <select
                              value={item.productId}
                              onChange={(event) => updateManualBatchItem(index, { productId: event.target.value })}
                              disabled={!canCreateTransfers || creatingManualBatchDraft}
                              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            >
                              <option value="">Selecione um produto</option>
                              {manualProductOptions.map((product) => (
                                <option key={product.id} value={product.id}>{product.name}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-500">Quantidade</label>
                            <input
                              type="number"
                              min={1}
                              value={item.quantity || ''}
                              onFocus={(event) => event.currentTarget.select()}
                              onClick={(event) => event.currentTarget.select()}
                              onBlur={() => {
                                if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) {
                                  updateManualBatchItem(index, { quantity: 1 });
                                }
                              }}
                              onChange={(event) => {
                                const value = event.target.value === '' ? 0 : Number(event.target.value);
                                updateManualBatchItem(index, { quantity: Number.isFinite(value) && value > 0 ? value : 0 });
                              }}
                              disabled={!canCreateTransfers || creatingManualBatchDraft}
                              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            />
                          </div>

                          <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:bg-gray-950">
                            <div>Disponível origem</div>
                            <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {available === null ? '—' : formatNumberPtBr(available)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeManualBatchItem(index)}
                            disabled={!canCreateTransfers || creatingManualBatchDraft}
                            className="inline-flex h-10 items-center justify-center rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                            aria-label="Remover item"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Observação</label>
                  <textarea
                    value={manualBatchNotes}
                    onChange={(event) => setManualBatchNotes(event.target.value)}
                    disabled={!canCreateTransfers || creatingManualBatchDraft}
                    rows={3}
                    placeholder="Ex.: transferência preventiva para abastecimento da loja."
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-[#19A999]/40 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 dark:border-gray-800 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeManualBatchModal}
                    disabled={creatingManualBatchDraft}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleCreateManualBatchDraft}
                    disabled={!canCreateTransfers || creatingManualBatchDraft || loadingManualInventory}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b8f80] disabled:opacity-60"
                  >
                    <CheckCircle2 size={15} />
                    {creatingManualBatchDraft ? 'Criando...' : 'Criar rascunho'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <TransferListTable rows={filteredRows} onClearFilters={hasFilters ? clearFilters : undefined} />
      </PageContainer>
    </>
  );
}
