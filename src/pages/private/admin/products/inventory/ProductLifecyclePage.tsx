import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useProductLifecycle } from './hooks/useProductLifecycle';
import { useProductStockMovements } from './hooks/useProductStockMovements';
import { useProductInventoryAudit } from './hooks/useProductInventoryAudit';
import { useProductLocationInventory } from './hooks/useProductLocationInventory';
import { useProductStockManagement } from './hooks/useProductStockManagement';
import { ProductStockManagementCards } from './components/ProductStockManagementCards';
import { useProductSupplierLifecycle } from './hooks/useProductSupplierLifecycle';
import { ProductSupplierCostPanel } from './components/ProductSupplierCostPanel';
import { useProductTransitSummary } from './hooks/useProductTransitSummary';
import { ProductTransitPanel } from './components/ProductTransitPanel';
import { InventoryQuickNav } from './components/InventoryQuickNav';
import { downloadCsv } from '@/utils/export/csv';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import { formatDateTimePtBr } from '@/utils/dateTime';
import EmptyState from '@/components/common/empty-state/EmptyState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import { ArrowLeft, History, MapPinned } from 'lucide-react';
import {
  getMovementDirectionLabel,
  getMovementDestinationLabel,
  getMovementHumanDescription,
  getMovementOperationLabel,
  getMovementOriginLabel,
  getMovementReferenceLabel,
  getMovementStockPath,
  getMovementToneClass,
  getTransferDivergenceReasonLabel,
  isPurchaseDocumentCancelMovement,
  getTransferDivergenceResolutionLabel,
  shortReference,
} from './utils/productMovementNarrative';

type LifecycleTab = 'summary' | 'locations' | 'movements' | 'audit';

type MovementOperationFilter =
  | 'all'
  | 'purchase'
  | 'purchase_cancel'
  | 'transfer'
  | 'transfer_divergence'
  | 'adjustment'
  | 'entry'
  | 'exit';

type MovementSortOption = 'newest' | 'oldest' | 'quantity_desc' | 'quantity_asc';

const movementOperationFilterOptions: Array<{ value: MovementOperationFilter; label: string }> = [
  { value: 'all', label: 'Todos os tipos' },
  { value: 'purchase', label: 'Compras confirmadas' },
  { value: 'purchase_cancel', label: 'Compras canceladas' },
  { value: 'transfer', label: 'Transferências' },
  { value: 'transfer_divergence', label: 'Divergências de transferência' },
  { value: 'adjustment', label: 'Ajustes e baixas' },
  { value: 'entry', label: 'Entradas' },
  { value: 'exit', label: 'Saídas' },
];

const movementSortOptions: Array<{ value: MovementSortOption; label: string }> = [
  { value: 'newest', label: 'Mais recentes primeiro' },
  { value: 'oldest', label: 'Mais antigas primeiro' },
  { value: 'quantity_desc', label: 'Maior quantidade' },
  { value: 'quantity_asc', label: 'Menor quantidade' },
];

const auditActionLabelMap: Record<string, string> = {
  reservation: 'Reserva',
  cancellation: 'Cancelamento',
};

const stockStatusLabelMap: Record<string, string> = {
  out: 'Sem estoque',
  low: 'Baixo',
  ok: 'OK',
  over: 'Acima do máximo',
};

const stockStatusClassMap: Record<string, string> = {
  out: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  over: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

export default function ProductLifecyclePage() {
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      const activeStoreId = getActiveStoreId();

      if (!activeStoreId) {
          setProduct(null);
          console.warn('Nenhuma loja ativa selecionada.');
          return;
      }

      const { data: productData, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('id', id)
          .eq('store_id', activeStoreId)
          .maybeSingle();

      if (fetchError) {
          console.error('Erro ao carregar produto da vida do produto:', fetchError);
          return;
      }

      if (!productData) {
          setProduct(null);
          return;
      }

      setProduct(productData);
    };

    fetchProduct();
  }, [id]);

  const [activeTab, setActiveTab] = useState<LifecycleTab>('summary');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementOperationFilter, setMovementOperationFilter] =
    useState<MovementOperationFilter>('all');
  const [movementLocationFilter, setMovementLocationFilter] = useState('all');
  const [movementSort, setMovementSort] = useState<MovementSortOption>('newest');

  const {
    row,
    transferDivergences,
    loading: loadingLifecycle,
  } = useProductLifecycle(id);
  const { rows: movementRows, loading: loadingMovements } = useProductStockMovements(id);
  const { rows: auditRows, loading: loadingAudit } = useProductInventoryAudit(id);
  const { rows: locationRows, loading: loadingLocations } = useProductLocationInventory(id);
  const {
    globalSummary,
    locationRows: managementRows,
    loading: loadingManagement,
    error: managementError,
  } = useProductStockManagement(id);

  const {
    suppliers: productSuppliers,
    costHistory: productCostHistory,
    loading: productSupplierLoading,
    error: productSupplierError,
  } = useProductSupplierLifecycle(id);

  const {
    rows: productTransitRows,
    loading: productTransitLoading,
    error: productTransitError,
  } = useProductTransitSummary(id);

  const loading = loadingLifecycle || loadingMovements || loadingAudit || loadingLocations;

  const tabs = useMemo(
    () => [
      { key: 'summary' as const, label: 'Resumo' },
      { key: 'locations' as const, label: 'Estoque por local' },
      { key: 'movements' as const, label: 'Movimentações' },
      { key: 'audit' as const, label: 'Auditoria' },
    ],
    []
  );

  const getTransferDivergenceDate = (item: (typeof transferDivergences)[number]) => (
    item.received_at ?? item.created_at ?? ''
  );

  const getMovementSortRank = (movement: (typeof movementRows)[number]) => {
    const source = String(movement.source ?? '').toLowerCase();
    const type = String(movement.type ?? '').toLowerCase();

    if (source === 'stock_transfer' && type === 'exit') return 10;
    if (source === 'stock_transfer' && type === 'entry') return 30;

    return 20;
  };


  const movementLocationOptions = useMemo(() => {
    const locations = new Map<string, string>();

    movementRows.forEach((movement) => {
      [movement.location_name, movement.from_location_name, movement.to_location_name]
        .filter((value): value is string => Boolean(value && value.trim().length > 0))
        .forEach((value) => locations.set(value, value));
    });

    transferDivergences.forEach((item) => {
      [item.source_location_name, item.destination_location_name]
        .filter((value): value is string => Boolean(value && value.trim().length > 0))
        .forEach((value) => locations.set(value, value));
    });

    return Array.from(locations.values()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [movementRows, transferDivergences]);

  const filteredMovementRows = useMemo(() => {
    const normalizedSearch = movementSearch.trim().toLowerCase();

    const matchesOperationFilter = (movement: (typeof movementRows)[number]) => {
      const type = String(movement.type ?? '').toLowerCase();
      const source = String(movement.source ?? '').toLowerCase();

      if (movementOperationFilter === 'all') return true;
      if (movementOperationFilter === 'purchase_cancel') return isPurchaseDocumentCancelMovement(movement);
      if (movementOperationFilter === 'purchase') return source === 'purchase_document';
      if (movementOperationFilter === 'transfer') return source === 'stock_transfer';
      if (movementOperationFilter === 'transfer_divergence') return false;
      if (movementOperationFilter === 'entry') return type === 'entry';
      if (movementOperationFilter === 'exit') return type === 'exit';

      if (movementOperationFilter === 'adjustment') {
        return (
          source === 'manual_adjustment' ||
          source === 'physical_count_adjustment' ||
          type === 'clearance'
        );
      }

      return true;
    };

    return [...movementRows]
      .filter((movement) => {
        const locationMatches =
          movementLocationFilter === 'all' ||
          movement.location_name === movementLocationFilter ||
          movement.from_location_name === movementLocationFilter ||
          movement.to_location_name === movementLocationFilter;

        if (!locationMatches || !matchesOperationFilter(movement)) return false;

        if (!normalizedSearch) return true;

        const haystack = [
          getMovementOperationLabel(movement),
          getMovementDirectionLabel(movement),
          getMovementHumanDescription(movement),
          getMovementOriginLabel(movement),
          getMovementDestinationLabel(movement),
          getMovementReferenceLabel(movement),
          movement.location_name,
          movement.from_location_name,
          movement.to_location_name,
          movement.reason,
          movement.transfer_code,
          movement.purchase_document_number,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        if (movementSort === 'oldest') {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        }

        if (movementSort === 'quantity_desc') {
          return Math.abs(Number(b.quantity ?? 0)) - Math.abs(Number(a.quantity ?? 0));
        }

        if (movementSort === 'quantity_asc') {
          return Math.abs(Number(a.quantity ?? 0)) - Math.abs(Number(b.quantity ?? 0));
        }

        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [movementLocationFilter, movementOperationFilter, movementRows, movementSearch, movementSort]);

  const filteredTransferDivergences = useMemo(() => {
    const normalizedSearch = movementSearch.trim().toLowerCase();

    return transferDivergences.filter((item) => {
      if (
        movementOperationFilter !== 'all' &&
        movementOperationFilter !== 'transfer' &&
        movementOperationFilter !== 'transfer_divergence'
      ) {
        return false;
      }

      const locationMatches =
        movementLocationFilter === 'all' ||
        item.source_location_name === movementLocationFilter ||
        item.destination_location_name === movementLocationFilter;

      if (!locationMatches) return false;

      if (!normalizedSearch) return true;

      const haystack = [
        'Divergência na transferência',
        'Divergência de transferência',
        item.transfer_code,
        item.transfer_id,
        item.source_location_name,
        item.destination_location_name,
        getTransferDivergenceResolutionLabel(item.divergence_resolution),
        getTransferDivergenceReasonLabel(item.divergence_reason),
        item.divergence_notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [
    movementLocationFilter,
    movementOperationFilter,
    movementSearch,
    transferDivergences,
  ]);

  const displayMovementItems = useMemo(() => {
    const items = [
      ...filteredMovementRows.map((movement) => ({
        kind: 'movement' as const,
        id: movement.id,
        date: movement.created_at ?? '',
        quantity: Math.abs(Number(movement.quantity ?? 0)),
        rank: getMovementSortRank(movement),
        movement,
      })),
      ...filteredTransferDivergences.map((divergence) => ({
        kind: 'divergence' as const,
        id: divergence.id,
        date: getTransferDivergenceDate(divergence),
        quantity: Math.abs(Number(divergence.divergence_qty ?? 0)),
        rank: 20,
        divergence,
      })),
    ];

    return items.sort((a, b) => {
      if (movementSort === 'quantity_desc') {
        return b.quantity - a.quantity;
      }

      if (movementSort === 'quantity_asc') {
        return a.quantity - b.quantity;
      }

      const aTime = new Date(a.date).getTime();
      const bTime = new Date(b.date).getTime();
      const safeATime = Number.isNaN(aTime) ? 0 : aTime;
      const safeBTime = Number.isNaN(bTime) ? 0 : bTime;

      if (safeATime !== safeBTime) {
        return movementSort === 'oldest'
          ? safeATime - safeBTime
          : safeBTime - safeATime;
      }

      return a.rank - b.rank;
    });
  }, [filteredMovementRows, filteredTransferDivergences, movementSort]);

  const hasMovementFilters =
    movementSearch.trim().length > 0 ||
    movementOperationFilter !== 'all' ||
    movementLocationFilter !== 'all' ||
    movementSort !== 'newest';

  const clearMovementFilters = () => {
    setMovementSearch('');
    setMovementOperationFilter('all');
    setMovementLocationFilter('all');
    setMovementSort('newest');
  };

  const handleExportSummaryCsv = () => {
    if (!row) return;

    downloadCsv({
      filename: `vida_produto_resumo_${row.product_name}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Produto',
        'Preço atual',
        'Estoque total',
        'Reservado',
        'Disponível',
        'Transferências',
        'Mínimo',
        'Máximo',
        'Última entrada',
        'Última saída',
        'Última movimentação',
        'Última transferência',
      ],
      rows: [[
        row.product_name,
        formatCurrencyPtBr(row.price ?? 0),
        formatNumberPtBr(row.total_on_hand ?? 0),
        formatNumberPtBr(row.total_reserved ?? 0),
        formatNumberPtBr(row.total_available ?? 0),
        formatNumberPtBr(row.transfer_count ?? 0),
        formatNumberPtBr(row.min_stock ?? 0),
        formatNumberPtBr(row.max_stock ?? 0),
        row?.last_entry_at ? formatDateTimePtBr(row.last_entry_at) : '—',
        row?.last_exit_at ? formatDateTimePtBr(row.last_exit_at) : '—',
        row?.last_movement_at ? formatDateTimePtBr(row.last_movement_at) : '—',
        row?.last_transfer_at ? formatDateTimePtBr(row.last_transfer_at) : '—',
      ]],
    });
  };

  const handleExportLocationsCsv = () => {
    if (!row) return;

    downloadCsv({
      filename: `vida_produto_locais_${row.product_name}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Produto',
        'Local',
        'Físico',
        'Reservado',
        'Disponível',
        'Status',
      ],
      rows: locationRows.map((item) => [
        row.product_name ?? '',
        item.location_name ?? '',
        formatNumberPtBr(item.on_hand),
        formatNumberPtBr(item.reserved),
        formatNumberPtBr(item.available),
        stockStatusLabelMap[item.stock_status] ?? item.stock_status ?? '',
      ]),
    });
  };

  const handleExportMovementsCsv = () => {
    if (!row) return;

    downloadCsv({
      filename: `vida_produto_movimentacoes_${row.product_name}_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: ['Vida do produto - movimentações e divergências'],
      rows: [
        ['Movimentações físicas'],
        [
          'Data/Hora',
          'Produto',
          'Operação',
          'Direção',
          'Quantidade',
          'Saldo no local',
          'Local afetado',
          'Origem',
          'Destino',
          'Referência',
          'Descrição',
          'Motivo',
        ],
        ...filteredMovementRows.map((movement) => [
          formatDateTimePtBr(movement.created_at),
          row.product_name ?? '',
          getMovementOperationLabel(movement),
          getMovementDirectionLabel(movement),
          formatNumberPtBr(Math.abs(Number(movement.quantity ?? 0))),
          getMovementStockPath(movement),
          movement.location_name ?? '',
          getMovementOriginLabel(movement),
          getMovementDestinationLabel(movement),
          getMovementReferenceLabel(movement),
          getMovementHumanDescription(movement),
          movement.reason ?? '',
        ]),
        [],
        ['Divergências de transferência'],
        [
          'Data',
          'Transferência',
          'Origem',
          'Destino',
          'Enviado',
          'Recebido',
          'Divergência',
          'Resolução',
          'Motivo',
          'Perda',
          'Retorno origem',
          'Falta aceita',
          'Observação',
        ],
        ...filteredTransferDivergences.map((item) => [
          formatDateTimePtBr(item.received_at ?? item.created_at),
          item.transfer_code ?? item.transfer_id ?? '',
          item.source_location_name ?? '',
          item.destination_location_name ?? '',
          formatNumberPtBr(item.shipped_qty ?? 0),
          formatNumberPtBr(item.received_qty ?? 0),
          formatNumberPtBr(item.divergence_qty ?? 0),
          getTransferDivergenceResolutionLabel(item.divergence_resolution),
          getTransferDivergenceReasonLabel(item.divergence_reason),
          formatNumberPtBr(item.loss_qty ?? 0),
          formatNumberPtBr(item.returned_to_origin_qty ?? 0),
          formatNumberPtBr(item.accepted_shortage_qty ?? 0),
          item.divergence_notes ?? '',
        ]),
      ],
    });
  };

  if (loading) return <LoadingSpinner />;

  if (!row && !product) {
    return (
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Produto não encontrado</h1>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-30 rounded-2xl border border-gray-100 bg-white/95 p-4 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-900/95 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#21A896] dark:text-[#37d0bb]">
              Vida do produto
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h1 className="max-w-full truncate text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                {row?.product_name || product?.name}
              </h1>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row?.active ?? product?.active
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}
              >
                {row?.active ?? product?.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span>Visão 360º do item no estoque, movimentações e auditoria.</span>
              <span>Preço atual: {(row?.price ?? product?.price) != null ? formatCurrencyPtBr(row?.price ?? product?.price) : '—'}</span>
              <span>Estoque global: {formatNumberPtBr(row?.total_on_hand ?? 0)}</span>
            </div>
          </div>

          {/* Barra de nav: botão Voltar + atalhos do módulo */}
          <InventoryQuickNav
            extra={
              <Link
                to="/admin/products/lifecycle"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-500 transition-colors hover:border-[#21A896]/40 hover:text-[#21A896] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                title="Voltar para Vida do produto"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Vida do produto</span>
              </Link>
            }
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              Estoque total
              <InfoTooltip text="Quantidade física total do produto somando todos os locais." />
            </div>
            <div className="text-2xl font-bold">{row?.total_on_hand ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              Reservado
              <InfoTooltip text="Quantidade comprometida com pedidos ou operações em andamento." />
            </div>
            <div className="text-2xl font-bold">{row?.total_reserved ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="flex items-center gap-1 text-sm text-gray-500">
              Disponível
              <InfoTooltip text="Quantidade utilizável no momento, considerando o saldo físico menos reservas." />
            </div>
            <div className="text-2xl font-bold">{row?.total_available ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="text-sm text-gray-500">Transferências</div>
            <div className="text-2xl font-bold">{row?.transfer_count ?? 0}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="text-sm text-gray-500">Mínimo</div>
            <div className="text-2xl font-bold">{row?.min_stock ?? product?.min_stock ?? '—'}</div>
          </div>
          <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40">
            <div className="text-sm text-gray-500">Máximo</div>
            <div className="text-2xl font-bold">{row?.max_stock ?? product?.max_stock ?? '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Diagnóstico gerencial ── */}
      <ProductStockManagementCards
        globalSummary={globalSummary}
        locationRows={managementRows}
        loading={loadingManagement}
        error={managementError}
      />

      {/* ── Fornecedores e Custos ── */}
      <ProductSupplierCostPanel
        suppliers={productSuppliers}
        costHistory={productCostHistory}
        loading={productSupplierLoading}
        error={productSupplierError}
      />

      {/* ── Trânsito ── */}
      <ProductTransitPanel
        rows={productTransitRows}
        loading={productTransitLoading}
        error={productTransitError}
      />

      <div className="rounded-2xl bg-white dark:bg-gray-800 p-2 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="w-full lg:w-auto overflow-x-auto">
          <div className="flex min-w-max gap-2 pb-1 lg:pb-0">
            {tabs.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition ${active
                    ? 'bg-[#21A896] text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pr-2">
          {activeTab === 'summary' && (
            <button
              type="button"
              onClick={handleExportSummaryCsv}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Exportar resumo
            </button>
          )}
          {activeTab === 'locations' && (
            <button
              type="button"
              onClick={handleExportLocationsCsv}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Exportar locais
            </button>
          )}
          {activeTab === 'movements' && (
            <button
              type="button"
              onClick={handleExportMovementsCsv}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            >
              Exportar movimentações
            </button>
          )}
        </div>
      </div>


      {activeTab === 'summary' && (
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Resumo operacional</h2>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Última entrada</div>
              <div className="font-semibold">
                {row?.last_entry_at ? (
                  formatDateTimePtBr(row.last_entry_at)
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Última saída</div>
              <div className="font-semibold">
                {row?.last_exit_at ? (
                  formatDateTimePtBr(row.last_exit_at)
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Última movimentação</div>
              <div className="font-semibold">
                {row?.last_movement_at ? (
                  formatDateTimePtBr(row.last_movement_at)
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Última transferência</div>
              <div className="font-semibold">
                {row?.last_transfer_at ? (
                  formatDateTimePtBr(row.last_transfer_at)
                ) : (
                  <span className="flex items-center gap-1 text-gray-400">
                    — <span className="text-xs font-normal">Ainda sem histórico</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'locations' && locationRows.length === 0 && (
        <EmptyState
          icon={<MapPinned className="h-5 w-5" />}
          title="Sem saldo por local para este produto"
          description="Quando este item tiver posição registrada em locais de estoque, os saldos aparecerão aqui."
        />
      )}

      {activeTab === 'locations' && locationRows.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">Estoque por local</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Local</th>
                  <th className="text-left px-4 py-3">Físico</th>
                  <th className="text-left px-4 py-3">Reservado</th>
                  <th className="text-left px-4 py-3">Disponível</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {locationRows.map((item) => (
                  <tr key={`${item.location_id}-${item.product_id}`} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">{item.location_name}</td>
                    <td className="px-4 py-3">{item.on_hand}</td>
                    <td className="px-4 py-3">{item.reserved}</td>
                    <td className="px-4 py-3">{item.available}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${stockStatusClassMap[item.stock_status] ??
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                      >
                        {stockStatusLabelMap[item.stock_status] ?? item.stock_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'movements' && movementRows.length === 0 && transferDivergences.length === 0 && (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title="Nenhuma movimentação encontrada para este produto"
          description="Entradas, saídas, reservas, ajustes e transferências do item aparecerão aqui."
        />
      )}

      {activeTab === 'movements' && (movementRows.length > 0 || transferDivergences.length > 0) && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white">Movimentações físicas</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {displayMovementItems.length} de {movementRows.length + transferDivergences.length} eventos exibidos
                </p>
              </div>

              {hasMovementFilters && (
                <button
                  type="button"
                  onClick={clearMovementFilters}
                  className="self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 md:self-auto"
                >
                  Limpar filtros
                </button>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Buscar
                <input
                  value={movementSearch}
                  onChange={(event) => setMovementSearch(event.target.value)}
                  placeholder="Ref., local, motivo..."
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-teal-900/40"
                />
              </label>

              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Tipo
                <select
                  value={movementOperationFilter}
                  onChange={(event) =>
                    setMovementOperationFilter(event.target.value as MovementOperationFilter)
                  }
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-teal-900/40"
                >
                  {movementOperationFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Local
                <select
                  value={movementLocationFilter}
                  onChange={(event) => setMovementLocationFilter(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-teal-900/40"
                >
                  <option value="all">Todos os locais</option>
                  {movementLocationOptions.map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Ordenar
                <select
                  value={movementSort}
                  onChange={(event) => setMovementSort(event.target.value as MovementSortOption)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:focus:ring-teal-900/40"
                >
                  {movementSortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="space-y-3">
            {displayMovementItems.length === 0 && (movementRows.length > 0 || transferDivergences.length > 0) && (
              <EmptyState
                icon={<History className="h-5 w-5" />}
                title="Nenhuma movimentação encontrada com os filtros atuais"
                description="Ajuste os filtros, a busca ou a ordenação para voltar a visualizar os eventos físicos deste produto."
              />
            )}

            {displayMovementItems.map((item) => {
              if (item.kind === 'divergence') {
                const divergence = item.divergence;

                return (
                  <div
                    key={`divergence-${divergence.id}`}
                    className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold">
                            Divergência na transferência
                          </span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
                            Divergência
                          </span>
                          <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
                            {Number(divergence.divergence_qty ?? 0)} un.
                          </span>
                        </div>

                        <p className="mt-2 text-sm leading-relaxed">
                          {Number(divergence.divergence_qty ?? 0)} un. não chegaram ao destino conforme o enviado.
                        </p>
                      </div>

                      <div className="text-left text-xs md:text-right">
                        <div className="font-semibold">
                          Ref.: {divergence.transfer_code || shortReference(divergence.transfer_id, 'Transferência')}
                        </div>
                        <div className="mt-1 opacity-80">
                          Ocorrência: {formatDateTimePtBr(getTransferDivergenceDate(divergence))}
                        </div>
                        <div className="mt-1 opacity-80">
                          {divergence.source_location_name ?? 'Origem'} → {divergence.destination_location_name ?? 'Destino'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                      <div className="rounded-xl bg-white/70 p-2">
                        <div className="font-semibold opacity-70">Local afetado</div>
                        <div>{divergence.source_location_name ?? 'Origem não identificada'}</div>
                      </div>

                      <div className="rounded-xl bg-white/70 p-2">
                        <div className="font-semibold opacity-70">Resolução</div>
                        <div>{getTransferDivergenceResolutionLabel(divergence.divergence_resolution)}</div>
                      </div>

                      <div className="rounded-xl bg-white/70 p-2">
                        <div className="font-semibold opacity-70">Motivo</div>
                        <div>{getTransferDivergenceReasonLabel(divergence.divergence_reason)}</div>
                      </div>

                      <div className="rounded-xl bg-white/70 p-2">
                        <div className="font-semibold opacity-70">Impacto</div>
                        <div>
                          Perda: {Number(divergence.loss_qty ?? 0)} · Retorno: {Number(divergence.returned_to_origin_qty ?? 0)} · Falta aceita: {Number(divergence.accepted_shortage_qty ?? 0)}
                        </div>
                      </div>
                    </div>

                    {divergence.divergence_notes && (
                      <p className="mt-3 text-xs opacity-80">
                        Observação: {divergence.divergence_notes}
                      </p>
                    )}
                  </div>
                );
              }

              const movement = item.movement;

              return (
                <div
                  key={`movement-${movement.id}`}
                  className={`rounded-2xl border p-4 shadow-sm ${getMovementToneClass(movement)}`}
                >
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold">
                          {getMovementOperationLabel(movement)}
                        </span>

                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">
                          {getMovementDirectionLabel(movement)}
                        </span>

                        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs">
                          {Math.abs(Number(movement.quantity ?? 0))} un.
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-relaxed">
                        {getMovementHumanDescription(movement)}
                      </p>
                    </div>

                    <div className="text-left text-xs md:text-right">
                      <div className="font-semibold">
                        Saldo no local: {getMovementStockPath(movement)}
                      </div>
                      <div className="mt-1 opacity-80">
                        Ocorrência: {formatDateTimePtBr(movement.created_at)}
                      </div>
                      <div className="mt-1 opacity-80">
                        Ref.: {getMovementReferenceLabel(movement)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                    <div className="rounded-xl bg-white/70 p-2">
                      <div className="font-semibold opacity-70">Local afetado</div>
                      <div>{movement.location_name ?? '—'}</div>
                    </div>

                    <div className="rounded-xl bg-white/70 p-2">
                      <div className="font-semibold opacity-70">Origem</div>
                      <div>{getMovementOriginLabel(movement)}</div>
                    </div>

                    <div className="rounded-xl bg-white/70 p-2">
                      <div className="font-semibold opacity-70">Destino</div>
                      <div>{getMovementDestinationLabel(movement)}</div>
                    </div>
                  </div>

                  {movement.reason && (
                    <p className="mt-3 text-xs opacity-80">
                      Motivo/observação: {movement.reason}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center">
            <h2 className="font-semibold text-gray-900 dark:text-white">Auditoria não física</h2>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th className="text-left px-4 py-3">Data/Hora</th>
                  <th className="text-left px-4 py-3">Ação</th>
                  <th className="text-left px-4 py-3">Quantidade</th>
                  <th className="text-left px-4 py-3">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-4 py-3">{new Date(item.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">{auditActionLabelMap[item.action] ?? item.action}</td>
                    <td className="px-4 py-3">
                      {String((item.new_data?.quantity as number | string | undefined) ?? '—')}
                    </td>
                    <td className="px-4 py-3">
                      {String((item.new_data?.reason as string | undefined) ?? '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
