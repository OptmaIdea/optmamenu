import { useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageContainer from '@/components/common/PageContainer';
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
import { downloadCsv } from '@/utils/export/csv';
import { formatCurrencyPtBr, formatNumberPtBr } from '@/utils/export/formatters';
import { formatDateTimePtBr } from '@/utils/dateTime';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { usePermissions } from '@/hooks/usePermissions';
import EmptyState from '@/components/common/empty-state/EmptyState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import { ProductPricingHistoryTab } from './pricing-history/ProductPricingHistoryTab';
import { getShortDocumentReference, getDocumentReferenceTitle, humanizeTextReferences } from '@/utils/documentReference';
import {
  ArrowLeft,
  History,
  MapPinned,
  Package,
  Layers,
  Truck,
  ShieldCheck,
  BarChart3,
  RefreshCw,
  Tag,
  DollarSign
} from 'lucide-react';
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
} from './utils/productMovementNarrative';

type LifecycleTab = 'summary' | 'locations' | 'movements' | 'suppliers' | 'audit' | 'pricing_history';

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
  low: 'Estoque Baixo',
  ok: 'Estoque Normal',
  over: 'Acima do máximo',
};

const stockStatusClassMap: Record<string, string> = {
  out: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
  over: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300 border border-sky-200 dark:border-sky-800',
};

export default function ProductLifecyclePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<any>(null);
  const { storeId } = useCurrentStore();
  const { hasPermission } = usePermissions(storeId ?? null);
  const canCreateTransfers = hasPermission('transfers.create');

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'));
  }, []);

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
      .select('*, categories(name)')
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

  useEffect(() => {
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

  const productName = product?.name || row?.product_name || 'Produto não identificado';
  const categoryName = product?.categories?.name || product?.category_name || (row as Record<string, any>)?.category_name || 'Sem categoria';
  const sku = product?.sku || product?.barcode || product?.code || null;
  const price = product?.price ?? row?.price ?? 0;
  const imageUrl = (Array.isArray(product?.images) && product.images.length > 0)
    ? product.images[0]
    : (product?.image_url || null);

  const handleBack = () => {
    const returnTo = (location.state as any)?.returnTo;
    if (returnTo) {
      navigate(returnTo);
    } else if (id) {
      navigate(`/admin/products/${id}`);
    } else {
      navigate('/admin/products');
    }
  };

  const totalOnHand = row?.total_on_hand ?? 0;
  const minStock = row?.min_stock ?? product?.min_stock ?? 0;

  const stockStatus = useMemo(() => {
    if (totalOnHand <= 0) return 'out';
    if (minStock > 0 && totalOnHand <= minStock) return 'low';
    return 'ok';
  }, [totalOnHand, minStock]);

  const tabs = useMemo(
    () => [
      { key: 'summary' as const, label: 'Resumo & Diagnóstico', icon: BarChart3 },
      { key: 'locations' as const, label: 'Estoque por Local', icon: MapPinned },
      { key: 'movements' as const, label: 'Movimentações', icon: History },
      { key: 'suppliers' as const, label: 'Fornecedores & Custos', icon: Truck },
      { key: 'pricing_history' as const, label: 'Preços e margens', icon: DollarSign },
      { key: 'audit' as const, label: 'Auditoria', icon: ShieldCheck },
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
      <PageContainer title="Vida do produto">
        <div className="rounded-3xl bg-white dark:bg-gray-800 p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Produto não encontrado</h1>
          <p className="mt-1 text-sm text-gray-500">O produto solicitado não foi localizado nesta loja.</p>
          <Link
            to="/admin/products"
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#19A999] text-white font-bold text-sm shadow-xs hover:bg-[#158f81] transition-all"
          >
            <ArrowLeft size={16} /> Voltar para lista de produtos
          </Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <>
      {portalContainer && createPortal(
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchProduct}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-2xs"
            title="Atualizar dados do produto"
          >
            <RefreshCw size={13} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-2xs cursor-pointer"
            title="Voltar para a tela anterior"
          >
            <ArrowLeft size={13} />
            <span>Voltar</span>
          </button>
        </div>,
        portalContainer
      )}

      <PageContainer title="Vida do produto" subtitle={`Histórico e análise operacional de ${productName}`}>
        {/* ── CARD HEADER DO PRODUTO DESTACADO ── */}
        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className="h-16 w-16 shrink-0 rounded-2xl border border-gray-100 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/50 flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <img src={imageUrl} alt={productName} className="h-full w-full object-contain rounded-xl" />
                ) : (
                  <Package className="h-8 w-8 text-gray-400" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight truncate">
                    {productName}
                  </h1>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${
                      stockStatusClassMap[stockStatus] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {stockStatusLabelMap[stockStatus] ?? stockStatus}
                  </span>
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1 font-semibold text-gray-700 dark:text-gray-300">
                    <Layers size={13} className="text-[#19A999]" />
                    {categoryName}
                  </span>

                  {sku && (
                    <span className="flex items-center gap-1 font-medium bg-gray-100 dark:bg-gray-700/60 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                      <Tag size={11} />
                      SKU: {sku}
                    </span>
                  )}

                  <span className="font-bold text-[#F1613A]">
                    {formatCurrencyPtBr(price)} / un
                  </span>
                </div>
              </div>
            </div>

            {/* Ações / Botões rápidos */}
            <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
              <Link
                to={`/admin/products?edit=${id}`}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Editar cadastro
              </Link>
            </div>
          </div>
        </div>

        {/* ── NAVEGAÇÃO POR ABAS (TABS) ── */}
        <div className="mb-6 rounded-2xl bg-white dark:bg-gray-800 p-2 shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="w-full lg:w-auto overflow-x-auto">
            <div className="flex min-w-max gap-2 pb-1 lg:pb-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all tracking-tight ${
                      active
                        ? 'bg-[#19A999] text-white shadow-xs'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700/60'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
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
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-2xs"
              >
                Exportar resumo CSV
              </button>
            )}
            {activeTab === 'locations' && (
              <button
                type="button"
                onClick={handleExportLocationsCsv}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-2xs"
              >
                Exportar locais CSV
              </button>
            )}
            {activeTab === 'movements' && (
              <button
                type="button"
                onClick={handleExportMovementsCsv}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition shadow-2xs"
              >
                Exportar movimentações CSV
              </button>
            )}
          </div>
        </div>

        {/* ── ABA 1: RESUMO & DIAGNÓSTICO ── */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* CARDS DE SALDO DE ESTOQUE */}
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Estoque total
                    <InfoTooltip text="Quantidade física total do produto somando todos os locais." />
                  </div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{row?.total_on_hand ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Reservado
                    <InfoTooltip text="Quantidade comprometida com pedidos ou operações em andamento." />
                  </div>
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{row?.total_reserved ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="flex items-center gap-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Disponível
                    <InfoTooltip text="Quantidade utilizável no momento, considerando o saldo físico menos reservas." />
                  </div>
                  <div className="text-2xl font-black text-[#19A999] mt-1">{row?.total_available ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Transferências</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{row?.transfer_count ?? 0}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mínimo</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{row?.min_stock ?? product?.min_stock ?? '—'}</div>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Máximo</div>
                  <div className="text-2xl font-black text-gray-900 dark:text-white mt-1">{row?.max_stock ?? product?.max_stock ?? '—'}</div>
                </div>
              </div>
            </div>

            {/* Diagnóstico Gerencial */}
            <ProductStockManagementCards
              globalSummary={globalSummary}
              locationRows={managementRows}
              loading={loadingManagement}
              error={managementError}
              canCreateTransfers={canCreateTransfers}
            />

            {/* Resumo Operacional Datas */}
            <div className="rounded-3xl bg-white dark:bg-gray-800 p-6 shadow-sm border border-gray-100 dark:border-gray-700">
              <h2 className="text-sm font-black uppercase tracking-wider text-gray-900 dark:text-white">
                Datas da Operação
              </h2>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-400 uppercase">Última entrada</div>
                  <div className="font-bold text-gray-900 dark:text-white mt-1">
                    {row?.last_entry_at ? (
                      formatDateTimePtBr(row.last_entry_at)
                    ) : (
                      <span className="text-gray-400 font-normal text-xs">Sem histórico registrado</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-400 uppercase">Última saída</div>
                  <div className="font-bold text-gray-900 dark:text-white mt-1">
                    {row?.last_exit_at ? (
                      formatDateTimePtBr(row.last_exit_at)
                    ) : (
                      <span className="text-gray-400 font-normal text-xs">Sem histórico registrado</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-400 uppercase">Última movimentação</div>
                  <div className="font-bold text-gray-900 dark:text-white mt-1">
                    {row?.last_movement_at ? (
                      formatDateTimePtBr(row.last_movement_at)
                    ) : (
                      <span className="text-gray-400 font-normal text-xs">Sem histórico registrado</span>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="text-xs font-bold text-gray-400 uppercase">Última transferência</div>
                  <div className="font-bold text-gray-900 dark:text-white mt-1">
                    {row?.last_transfer_at ? (
                      formatDateTimePtBr(row.last_transfer_at)
                    ) : (
                      <span className="text-gray-400 font-normal text-xs">Sem histórico registrado</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ABA 2: ESTOQUE POR LOCAL & TRÂNSITO ── */}
        {activeTab === 'locations' && (
          <div className="space-y-6">
            <ProductTransitPanel
              rows={productTransitRows}
              loading={productTransitLoading}
              error={productTransitError}
            />

            {locationRows.length === 0 ? (
              <EmptyState
                icon={<MapPinned className="h-5 w-5" />}
                title="Sem saldo por local para este produto"
                description="Quando este item tiver posição registrada em locais de estoque, os saldos aparecerão aqui."
              />
            ) : (
              <div className="space-y-3">
                <h2 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white">
                  Posição nos Locais de Estoque
                </h2>

                <div className="overflow-x-auto rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                  <table className="min-w-[860px] w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-xs font-black text-gray-400 uppercase tracking-wider">
                      <tr>
                        <th className="text-left px-5 py-4">Local</th>
                        <th className="text-left px-5 py-4">Físico</th>
                        <th className="text-left px-5 py-4">Reservado</th>
                        <th className="text-left px-5 py-4">Disponível</th>
                        <th className="text-left px-5 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {locationRows.map((item) => (
                        <tr key={`${item.location_id}-${item.product_id}`} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition">
                          <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">{item.location_name}</td>
                          <td className="px-5 py-4 font-extrabold">{item.on_hand}</td>
                          <td className="px-5 py-4 font-bold text-amber-600 dark:text-amber-400">{item.reserved}</td>
                          <td className="px-5 py-4 font-extrabold text-[#19A999]">{item.available}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${
                                stockStatusClassMap[item.stock_status] ??
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
          </div>
        )}

        {/* ── ABA 3: MOVIMENTAÇÕES & HISTÓRICO ── */}
        {activeTab === 'movements' && (
          <div className="space-y-4">
            {movementRows.length === 0 && transferDivergences.length === 0 ? (
              <EmptyState
                icon={<History className="h-5 w-5" />}
                title="Nenhuma movimentação encontrada para este produto"
                description="Entradas, saídas, reservas, ajustes e transferências do item aparecerão aqui."
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white">Movimentações Físicas</h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {displayMovementItems.length} de {movementRows.length + transferDivergences.length} eventos exibidos
                      </p>
                    </div>

                    {hasMovementFilters && (
                      <button
                        type="button"
                        onClick={clearMovementFilters}
                        className="self-start rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700 md:self-auto"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Buscar
                      <input
                        value={movementSearch}
                        onChange={(event) => setMovementSearch(event.target.value)}
                        placeholder="Ref., local, motivo..."
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      />
                    </label>

                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Tipo
                      <select
                        value={movementOperationFilter}
                        onChange={(event) =>
                          setMovementOperationFilter(event.target.value as MovementOperationFilter)
                        }
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        {movementOperationFilterOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Local
                      <select
                        value={movementLocationFilter}
                        onChange={(event) => setMovementLocationFilter(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="all">Todos os locais</option>
                        {movementLocationOptions.map((location) => (
                          <option key={location} value={location}>
                            {location}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Ordenar
                      <select
                        value={movementSort}
                        onChange={(event) => setMovementSort(event.target.value as MovementSortOption)}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 outline-none focus:border-[#19A999] dark:border-gray-700 dark:bg-gray-900 dark:text-white"
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
                      const rawCode = divergence.transfer_code || divergence.transfer_id || '';
                      const shortRef = getShortDocumentReference(rawCode, { fallbackLabel: 'Transferência' });
                      const titleAttr = getDocumentReferenceTitle(rawCode);

                      return (
                        <div
                          key={`divergence-${divergence.id}`}
                          className="rounded-3xl border border-amber-200 bg-amber-50/90 p-5 text-amber-900 shadow-sm"
                        >
                          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-black">
                                  Divergência na transferência
                                </span>
                                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold">
                                  Divergência
                                </span>
                                <span className="rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                                  {Number(divergence.divergence_qty ?? 0)} un.
                                </span>
                              </div>

                              <p className="mt-2 text-sm font-medium leading-relaxed">
                                {Number(divergence.divergence_qty ?? 0)} un. não chegaram ao destino conforme o enviado.
                              </p>
                            </div>

                            <div className="text-left text-xs md:text-right">
                              <div className="font-black text-amber-950" title={titleAttr}>
                                Ref.: {shortRef}
                              </div>
                              <div className="mt-1 font-medium opacity-80">
                                Ocorrência: {formatDateTimePtBr(getTransferDivergenceDate(divergence))}
                              </div>
                              <div className="mt-1 font-medium opacity-80">
                                {divergence.source_location_name ?? 'Origem'} → {divergence.destination_location_name ?? 'Destino'}
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-2 text-xs md:grid-cols-4">
                            <div className="rounded-xl bg-white/70 p-2.5">
                              <div className="font-bold opacity-70 uppercase text-[10px]">Local afetado</div>
                              <div className="font-semibold mt-0.5">{divergence.source_location_name ?? 'Origem não identificada'}</div>
                            </div>

                            <div className="rounded-xl bg-white/70 p-2.5">
                              <div className="font-bold opacity-70 uppercase text-[10px]">Resolução</div>
                              <div className="font-semibold mt-0.5">{getTransferDivergenceResolutionLabel(divergence.divergence_resolution)}</div>
                            </div>

                            <div className="rounded-xl bg-white/70 p-2.5">
                              <div className="font-bold opacity-70 uppercase text-[10px]">Motivo</div>
                              <div className="font-semibold mt-0.5">{getTransferDivergenceReasonLabel(divergence.divergence_reason)}</div>
                            </div>

                            <div className="rounded-xl bg-white/70 p-2.5">
                              <div className="font-bold opacity-70 uppercase text-[10px]">Impacto</div>
                              <div className="font-semibold mt-0.5">
                                Perda: {Number(divergence.loss_qty ?? 0)} · Retorno: {Number(divergence.returned_to_origin_qty ?? 0)} · Falta aceita: {Number(divergence.accepted_shortage_qty ?? 0)}
                              </div>
                            </div>
                          </div>

                          {divergence.divergence_notes && (
                            <p className="mt-3 text-xs opacity-80 font-medium">
                              Observação: {humanizeTextReferences(divergence.divergence_notes)}
                            </p>
                          )}
                        </div>
                      );
                    }

                    const movement = item.movement;
                    const shortRef = getMovementReferenceLabel(movement);
                    const rawRef = movement.transfer_code || movement.purchase_document_number || (movement.metadata?.order_code as string) || movement.source_id || '';
                    const titleAttr = getDocumentReferenceTitle(rawRef);

                    return (
                      <div
                        key={`movement-${movement.id}`}
                        className={`rounded-3xl border p-5 shadow-xs transition-all ${getMovementToneClass(movement)}`}
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-black">
                                {getMovementOperationLabel(movement)}
                              </span>

                              <span className="rounded-full bg-white/80 dark:bg-gray-900/60 px-2.5 py-0.5 text-xs font-bold">
                                {getMovementDirectionLabel(movement)}
                              </span>

                              <span className="rounded-full bg-white/80 dark:bg-gray-900/60 px-2.5 py-0.5 text-xs font-extrabold">
                                {Math.abs(Number(movement.quantity ?? 0))} un.
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-medium leading-relaxed">
                              {humanizeTextReferences(getMovementHumanDescription(movement))}
                            </p>
                          </div>

                          <div className="text-left text-xs md:text-right">
                            <div className="font-black">
                              Saldo no local: {getMovementStockPath(movement)}
                            </div>
                            <div className="mt-1 font-medium opacity-80">
                              Ocorrência: {formatDateTimePtBr(movement.created_at)}
                            </div>
                            <div className="mt-1 font-bold opacity-90" title={titleAttr}>
                              Ref.: {shortRef}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-2 text-xs md:grid-cols-3">
                          <div className="rounded-xl bg-white/60 dark:bg-gray-900/40 p-2.5">
                            <div className="font-bold opacity-70 uppercase text-[10px]">Local afetado</div>
                            <div className="font-semibold mt-0.5">{movement.location_name ?? '—'}</div>
                          </div>

                          <div className="rounded-xl bg-white/60 dark:bg-gray-900/40 p-2.5">
                            <div className="font-bold opacity-70 uppercase text-[10px]">Origem</div>
                            <div className="font-semibold mt-0.5">{getMovementOriginLabel(movement)}</div>
                          </div>

                          <div className="rounded-xl bg-white/60 dark:bg-gray-900/40 p-2.5">
                            <div className="font-bold opacity-70 uppercase text-[10px]">Destino</div>
                            <div className="font-semibold mt-0.5">{getMovementDestinationLabel(movement)}</div>
                          </div>
                        </div>

                        {movement.reason && (
                          <p className="mt-3 text-xs font-medium opacity-80">
                            Motivo/observação: {humanizeTextReferences(movement.reason)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ABA 4: FORNECEDORES & CUSTOS ── */}
        {activeTab === 'suppliers' && (
          <ProductSupplierCostPanel
            suppliers={productSuppliers}
            costHistory={productCostHistory}
            loading={productSupplierLoading}
            error={productSupplierError}
          />
        )}

        {/* ── ABA: PREÇOS E MARGENS ── */}
        {activeTab === 'pricing_history' && (
          <ProductPricingHistoryTab productId={id} productName={productName} />
        )}

        {/* ── ABA 5: AUDITORIA ── */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <h2 className="font-black text-sm uppercase tracking-wider text-gray-900 dark:text-white">
              Auditoria de Estoque Não Física
            </h2>

            <div className="overflow-x-auto rounded-3xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
              <table className="min-w-[860px] w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700 text-xs font-black text-gray-400 uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-5 py-4">Data/Hora</th>
                    <th className="text-left px-5 py-4">Ação</th>
                    <th className="text-left px-5 py-4">Quantidade</th>
                    <th className="text-left px-5 py-4">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {auditRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-gray-400 font-medium">
                        Nenhum registro de auditoria encontrado para este produto.
                      </td>
                    </tr>
                  ) : (
                    auditRows.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/30 transition">
                        <td className="px-5 py-4 font-bold text-gray-900 dark:text-white">
                          {formatDateTimePtBr(item.created_at)}
                        </td>
                        <td className="px-5 py-4 font-semibold">{auditActionLabelMap[item.action] ?? item.action}</td>
                        <td className="px-5 py-4 font-extrabold text-[#19A999]">
                          {String((item.new_data?.quantity as number | string | undefined) ?? '—')}
                        </td>
                        <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                          {String((item.new_data?.reason as string | undefined) ?? '—')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PageContainer>
    </>
  );
}
