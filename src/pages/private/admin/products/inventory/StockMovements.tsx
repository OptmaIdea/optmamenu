import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  History,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Printer,
  Calendar,
  ListFilter,
  FileText,
  Search,
  Plus,
  PlusCircle,
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import EmptyState from '@/components/common/empty-state/EmptyState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';
import type { StockMovement, StockMovementType, StockMovementFilters, StockMovementOperationFilter } from './types/inventory.types';
import PrintableStockMovements from '@/pages/private/admin/products/inventory/components/PrintableStockMovements';
import { useReactToPrint } from 'react-to-print';
import { downloadCsv } from '@/utils/export/csv';
import { formatDateTimePtBr, formatDateTimeForExportPtBr, formatDatePtBr, getLocalDateInputValue } from '@/utils/dateTime';
import { formatNumberPtBr } from '@/utils/export/formatters';
import { ManualStockAdjustmentModal } from './components/ManualStockAdjustmentModal';
import {
  getMovementDestinationLabel,
  getMovementHumanDescription,
  getMovementOperationLabel,
  getMovementOriginLabel,
  getMovementReferenceLabel,
  getTransferDivergenceReasonLabel,
  getTransferDivergenceResolutionLabel,
} from './utils/productMovementNarrative';
import { getActiveStoreId } from '@/utils/activeStore';

const INITIAL_MOVEMENTS_LIMIT = 7;
const MOVEMENTS_PAGE_SIZE = 50;

const MOVEMENT_LABELS: Record<
  Exclude<StockMovementOperationFilter, ''>,
  { label: string; color: string }
> = {
  entry: { label: 'Entrada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  exit: { label: 'Saída', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  reservation: { label: 'Reserva', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  confirmation: { label: 'Baixa (Pedido)', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  cancellation: { label: 'Cancelamento', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  transfer_all: { label: 'Transferência', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' },
  transfer_out: { label: 'Transferência enviada', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  transfer_in: { label: 'Transferência recebida', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  clearance: { label: 'Zeramento', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

export default function StockMovementsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'));
  }, []);

  const { fetchMovements } = useStockMovement();
  const { products: allProducts, refresh: refreshInventory } = useInventory();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [initialMovementsLimit, setInitialMovementsLimit] = useState(INITIAL_MOVEMENTS_LIMIT);
  const [loading, setLoading] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementKind, setMovementKind] = useState<StockMovementOperationFilter>('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentLocations, setAdjustmentLocations] = useState<
    Array<{ id: string; name: string; code?: string | null }>
  >([]);
  const [filters, setFilters] = useState<StockMovementFilters>({
    productId: undefined,
    type: undefined,
    startDate: undefined,
    endDate: undefined,
    locationId: undefined,
    search: undefined,
  });

  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [storeName, setStoreName] = useState('Minha Loja');
  const [userEmail, setUserEmail] = useState('Admin');

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Relatorio_Movimentacoes_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}`,
  });

  useEffect(() => {
    const movementType = searchParams.get('type') as StockMovementType | null;
    const productId = searchParams.get('productId');
    const productName = searchParams.get('productName');
    const productIds = searchParams.get('productIds');

    setFilters({
      startDate: undefined,
      endDate: undefined,
      type: movementType || undefined,
      productId: productId || undefined,
      productIds: productIds ? productIds.split(',') : undefined,
      locationId: undefined,
      search: undefined,
    });
    setCurrentPage(1);
    setInitialMovementsLimit(INITIAL_MOVEMENTS_LIMIT);

    if (productId) {
      setSelectedProduct({ id: productId, name: productName || 'Produto' });
    } else {
      setSelectedProduct(null);
    }

    if (productIds) {
      setSelectedProductIds(productIds.split(','));
    } else if (productId) {
      setSelectedProductIds([productId]);
    } else {
      setSelectedProductIds([]);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchStoreAndUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserEmail(user.email || 'Admin');
      }

      const activeStoreId = getActiveStoreId();
      if (!activeStoreId) {
        throw new Error('Nenhuma loja ativa selecionada.');
      }

      const { data: store, error: storeError } = await supabase
        .from('stores')
        .select('id, name, slug, config')
        .eq('id', activeStoreId)
        .maybeSingle();

      if (storeError) throw storeError;
      if (!store) {
        throw new Error('Loja ativa não encontrada ou sem permissão.');
      }

      const { data, error } = await supabase.rpc('get_store_config_admin', { p_store_id: store.id });
      if (error) return;
      const storeConfig = Array.isArray(data) ? data[0] : data;
      if (storeConfig) setStoreName(storeConfig.name);

      const { data: locationsData, error: locationsError } = await supabase
        .from('stock_locations')
        .select('id, name, code')
        .eq('store_id', store.id)
        .order('name');

      if (!locationsError) {
        setAdjustmentLocations(
          (locationsData || []).map((location: any) => ({
            id: location.id,
            name: location.name,
            code: location.code ?? null,
          })),
        );
      }
    };
    void fetchStoreAndUser();
  }, []);

  const hasMovementQueryFilters = useMemo(() => {
    return (
      !!filters.search?.trim() ||
      !!filters.locationId ||
      !!filters.type ||
      !!filters.productId ||
      !!(filters.productIds && filters.productIds.length > 0) ||
      !!filters.startDate ||
      !!filters.endDate
    );
  }, [filters]);

  const isSmartInitialLoad = !hasMovementQueryFilters;
  const currentPageSize = isSmartInitialLoad ? initialMovementsLimit : MOVEMENTS_PAGE_SIZE;
  const totalPages = isSmartInitialLoad ? 1 : Math.ceil(total / MOVEMENTS_PAGE_SIZE);
  const canLoadMoreInitialMovements = isSmartInitialLoad && movements.length < total;

  const effectiveMovementFilters = useMemo<StockMovementFilters>(() => {
    const next: StockMovementFilters = {
      ...filters,
      type: undefined,
      source: undefined,
      reasonCode: undefined,
    };

    if (movementKind === 'transfer_all') {
      return {
        ...next,
        source: 'stock_transfer',
      };
    }

    if (movementKind === 'transfer_out') {
      return {
        ...next,
        source: 'stock_transfer',
        reasonCode: 'transfer_shipped',
      };
    }

    if (movementKind === 'transfer_in') {
      return {
        ...next,
        source: 'stock_transfer',
        reasonCode: 'transfer_received',
      };
    }

    if (movementKind) {
      return {
        ...next,
        type: movementKind as StockMovementType,
      };
    }

    return next;
  }, [filters, movementKind]);

  useEffect(() => {
    void loadMovements();
  }, [currentPage, effectiveMovementFilters, initialMovementsLimit]);

  useEffect(() => {
    if (hasMovementQueryFilters) {
      setInitialMovementsLimit(INITIAL_MOVEMENTS_LIMIT);
    }
  }, [hasMovementQueryFilters]);



  const loadMovements = async () => {
    setLoading(true);
    try {
      const page = isSmartInitialLoad ? 1 : currentPage;
      const result = await fetchMovements(effectiveMovementFilters, page, currentPageSize);
      setMovements(result.movements);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      productId: undefined,
      productIds: undefined,
      type: undefined,
      startDate: undefined,
      endDate: undefined,
      locationId: undefined,
      search: undefined,
    });
    setSelectedProduct(null);
    setSelectedProductIds([]);
    setProductSearch('');
    setMovementSearch('');
    setMovementKind('');
    setLocationFilter('all');
    setCurrentPage(1);
    setInitialMovementsLimit(INITIAL_MOVEMENTS_LIMIT);
  };

  const removeContextProductFilter = () => {
    setSelectedProduct(null);
    setSelectedProductIds([]);
    setFilters((prev) => ({ ...prev, productId: undefined, productIds: undefined }));
    setCurrentPage(1);
  };

  const availableProducts = useMemo(() => {
    return allProducts.filter((p) => !p.discontinued);
  }, [allProducts]);

  const selectedProducts = useMemo(
    () => availableProducts.filter((p) => selectedProductIds.includes(p.id)),
    [availableProducts, selectedProductIds],
  );

  const filteredProductOptions = useMemo(() => {
    const term = productSearch.trim().toLowerCase();
    return availableProducts.filter((p) => {
      if (selectedProductIds.includes(p.id)) return false;
      return !term || p.name.toLowerCase().includes(term);
    }).slice(0, 20);
  }, [availableProducts, productSearch, selectedProductIds]);

  const locationOptions = useMemo(() => {
    const map = new Map<string, string>();

    adjustmentLocations.forEach((location) => {
      map.set(location.id, location.name);
    });

    movements.forEach((movement) => {
      if (movement.location_id && movement.location_name) {
        map.set(movement.location_id, movement.location_name);
      }
      if (movement.from_location_id && movement.from_location_name) {
        map.set(movement.from_location_id, movement.from_location_name);
      }
      if (movement.to_location_id && movement.to_location_name) {
        map.set(movement.to_location_id, movement.to_location_name);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [adjustmentLocations, movements]);

  const addProductSelection = (productId: string) => {
    if (selectedProductIds.includes(productId)) return;
    setSelectedProductIds((prev) => [...prev, productId]);
    setProductSearch('');
  };

  const removeProductSelection = (productId: string) => {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  };

  const applyProductFilter = () => {
    setFilters((prev) => ({
      ...prev,
      productIds: selectedProductIds.length > 0 ? selectedProductIds : undefined,
      productId: undefined,
    }));
    setSelectedProduct(null);
    setCurrentPage(1);
    setShowFilters(false);
  };

  const formatQuantity = (qty: number) => (qty > 0 ? `+${Math.abs(qty)}` : `-${Math.abs(qty)}`);

  const formatDate = (dateString: string, display?: string | null) => display ?? formatDateTimePtBr(dateString);
  const formatDateOnly = (dateString: string) => formatDatePtBr(dateString);

  const handleExportCsv = () => {
    const exportableMovements = movements;
    downloadCsv({
      filename: `movimentacoes_estoque_${getLocalDateInputValue()}.csv`,
      headers: [
        'Data/Hora',
        'Produto',
        'Local',
        'Tipo',
        'Quantidade',
        'Estoque antes',
        'Estoque depois',
        'Origem',
        'Destino',
        'Referência',
        'Descrição',
        'Observação',
      ],
      rows: exportableMovements.map((movement) => [
        (movement.created_at_display ?? formatDateTimeForExportPtBr(movement.created_at)),
        movement.product_name ?? '',
        movement.location_name
          ? movement.location_name
          : movement.from_location_name || movement.to_location_name
            ? `${movement.from_location_name ?? '—'} -> ${movement.to_location_name ?? '—'}`
            : '',
        getMovementOperationLabel(movement),
        formatNumberPtBr(movement.quantity),
        formatNumberPtBr(movement.previous_stock),
        formatNumberPtBr(movement.new_stock),
        getMovementOriginLabel(movement),
        getMovementDestinationLabel(movement),
        getMovementReferenceLabel(movement),
        getMovementHumanDescription(movement),
        movement.reason ?? '',
      ]),
    });
  };

  const hasActiveFilters =
    !!movementSearch.trim() ||
    !!productSearch.trim() ||
    locationFilter !== 'all' ||
    !!filters.type ||
    !!filters.productId ||
    !!(filters.productIds && filters.productIds.length > 0) ||
    !!filters.startDate ||
    !!filters.endDate;

  useEffect(() => {
    if (!loading && movements.length === 0 && hasActiveFilters) {
      setShowFilters(true);
    }
  }, [loading, movements.length, hasActiveFilters, setShowFilters]);

  const emptyStateActions = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {!showFilters && (
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
        >
          Abrir filtros
        </button>
      )}

      <button
        type="button"
        onClick={clearFilters}
        className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition"
      >
        Limpar filtros
      </button>
    </div>
  );

  return (
    <>
      {portalContainer && createPortal(
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAdjustmentModalOpen(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 bg-[#21A896] hover:bg-[#1a867a] text-white text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <PlusCircle size={13} />
            <span>Registrar ajuste</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-bold transition-colors shadow-sm cursor-pointer shrink-0 ${showFilters
              ? 'bg-[#21A896] border-[#21A896] text-white hover:bg-[#1a867a]'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
          >
            <Filter size={13} />
            <span>Filtros</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <Printer size={13} />
            <span>Imprimir</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm cursor-pointer shrink-0"
          >
            <FileText size={13} />
            <span>Exportar CSV</span>
          </button>
        </div>,
        portalContainer
      )}

      <PageContainer
        title={selectedProduct ? `Movimentações: ${selectedProduct.name}` : 'Movimentações de Estoque'}
        subtitle="Entradas, saídas, baixas e ajustes centralizados em um único lugar"
        onRefresh={loadMovements}
        withoutHeader={true}
      >
      {(selectedProduct || selectedProductIds.length > 0 || filters.productId || filters.productIds) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          {selectedProduct && (
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              Produto da origem: {selectedProduct.name}
              <button type="button" onClick={removeContextProductFilter}>
                <X size={14} />
              </button>
            </span>
          )}
          {!selectedProduct && selectedProducts.map((product) => (
            <span key={product.id} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {product.name}
              <button type="button" onClick={() => removeProductSelection(product.id)}>
                <X size={14} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Remover filtros
          </button>
        </div>
      )}

      {showFilters && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ListFilter size={18} />
              Filtros Avançados
            </h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 font-medium flex items-center gap-1"
              >
                <X size={14} />
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <div className="xl:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Search size={16} />
                Busca
              </label>
              <input
                type="text"
                value={movementSearch}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setMovementSearch(nextValue);
                  setFilters((prev) => ({
                    ...prev,
                    search: nextValue.trim() ? nextValue : undefined,
                  }));
                  setCurrentPage(1);
                }}
                placeholder="Buscar por motivo, origem do movimento ou referência"
                className="w-full min-w-0 p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="xl:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Período - Data Inicial */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Calendar size={16} />
                  Período
                </label>
                <span className="text-xs text-gray-500 mb-1 block">Data inicial</span>
                <input
                  type="date"
                  title="Data inicial (formato dd/mm/aaaa)"
                  aria-label="Data inicial"
                  value={filters.startDate || ''}
                  onChange={(e) => {
                    setFilters({ ...filters, startDate: e.target.value || undefined });
                    setCurrentPage(1);
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Período - Data Final */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 invisible md:flex items-center gap-2">
                  <Calendar size={16} />
                  Período
                </label>
                <span className="text-xs text-gray-500 mb-1 block">Data final</span>
                <input
                  type="date"
                  title="Data final (formato dd/mm/aaaa)"
                  aria-label="Data final"
                  value={filters.endDate || ''}
                  onChange={(e) => {
                    setFilters({ ...filters, endDate: e.target.value || undefined });
                    setCurrentPage(1);
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>

              {/* Tipo de Movimentação */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                  <Filter size={16} />
                  Tipo de Movimentação
                </label>
                <span className="text-xs text-transparent mb-1 block select-none">Tipo</span>
                <select
                  value={movementKind}
                  onChange={(e) => {
                    setMovementKind(e.target.value as StockMovementOperationFilter);
                    setCurrentPage(1);
                  }}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">Todos os tipos</option>
                  <option value="entry">Entrada</option>
                  <option value="exit">Saída</option>

                  <option value="transfer_all">Transferências</option>
                  <option value="transfer_out">Transferência enviada</option>
                  <option value="transfer_in">Transferência recebida</option>

                  <option value="reservation">Reserva</option>
                  <option value="confirmation">Baixa por pedido</option>
                  <option value="cancellation">Cancelamento</option>
                  <option value="clearance">Zeramento</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Local
              </label>
              <select
                value={locationFilter}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setLocationFilter(nextValue);
                  setFilters((prev) => ({
                    ...prev,
                    locationId: nextValue === 'all' ? undefined : nextValue,
                  }));
                  setCurrentPage(1);
                }}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">Todos os locais</option>
                {locationOptions.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Produtos (opcional)
              </label>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Buscar e adicionar produtos ao filtro"
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white"
                  />
                </div>

                {productSearch && filteredProductOptions.length > 0 && (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
                    {filteredProductOptions.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => addProductSelection(product.id)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span className="truncate text-gray-800 dark:text-gray-200">{product.name}</span>
                        <Plus size={14} className="text-[#21A896]" />
                      </button>
                    ))}
                  </div>
                )}

                {selectedProducts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedProducts.map((product) => (
                      <span
                        key={product.id}
                        className="inline-flex items-center gap-2 rounded-full bg-[#21A896]/10 px-3 py-1 text-sm text-[#1a867a] dark:text-[#6ee7d1]"
                      >
                        {product.name}
                        <button type="button" onClick={() => removeProductSelection(product.id)}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={applyProductFilter}
                    className="w-full sm:w-auto px-3 py-1.5 bg-[#21A896] text-white text-sm rounded-lg hover:bg-[#1a867a]"
                  >
                    Aplicar filtro de produtos
                  </button>
                  {selectedProductIds.length > 0 && (
                    <span className="text-sm text-gray-500">
                      {selectedProductIds.length} produto(s) selecionado(s)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && movements.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title={
            hasActiveFilters
              ? 'Nenhum resultado para os filtros aplicados'
              : 'Ainda não há registros para esta operação'
          }
          description={
            hasActiveFilters
              ? 'Os filtros atuais não retornaram resultados. Limpe os filtros ou ajuste período, local, tipo ou busca.'
              : 'Entradas, saídas, reservas, ajustes e transferências aparecerão aqui conforme o estoque for operado.'
          }
          action={hasActiveFilters ? emptyStateActions : undefined}
        />
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6 print:mb-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <History size={20} />
                <span className="font-medium">Total de movimentações: </span>
                <span className="font-bold text-gray-900 dark:text-white">{total}</span>
              </div>
              {filters.startDate && filters.endDate && (
                <div className="text-sm text-gray-500 dark:text-gray-400 print:block hidden">
                  Período: {formatDateOnly(filters.startDate)} até {formatDateOnly(filters.endDate)}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg print:shadow-none print:border-0">
            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700">
              <table className="min-w-[1180px] w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm font-medium print:bg-gray-100">
                  <tr>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2">Data/Hora</th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2">Produto</th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2">Local</th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-center">Tipo</th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        Quantidade
                        <InfoTooltip text="Variação registrada na movimentação. Valores positivos indicam entrada; negativos indicam saída." />
                      </div>
                    </th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        Estoque Antes
                        <InfoTooltip text="Saldo imediatamente antes da movimentação." />
                      </div>
                    </th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        Estoque Depois
                        <InfoTooltip text="Saldo imediatamente após a movimentação." />
                      </div>
                    </th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2 min-w-[220px]">
                      Origem/Destino
                    </th>
                    <th className="px-3 py-3 md:px-4 md:py-4 print:p-2 min-w-[220px]">
                      <div className="inline-flex items-center gap-1">
                        Motivo
                        <InfoTooltip text="Descrição operacional do que gerou a movimentação, como transferência, ajuste, reserva ou saída manual." />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {loading ? (
                    <tr><td colSpan={9} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                  ) : (
                    movements.map((movement) => {
                      const config = MOVEMENT_LABELS[movement.type];
                      const operationLabel = getMovementOperationLabel(movement);
                      return (
                        <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors print:hover:bg-transparent">
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-sm text-gray-600 dark:text-gray-400">{formatDate(movement.created_at, movement.created_at_display)}</td>
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 font-medium text-gray-900 dark:text-white">
                            <button
                              type="button"
                              onClick={() => navigate(`/admin/products/${movement.product_id}/lifecycle`)}
                              className="font-medium text-[#21A896] hover:underline text-left"
                            >
                              {movement.product_name || 'Produto removido'}
                            </button>
                          </td>
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-sm text-gray-600 dark:text-gray-400">
                            {movement.location_name ? (
                              movement.location_name
                            ) : movement.from_location_name || movement.to_location_name ? (
                              <span>
                                {movement.from_location_name ?? '—'} → {movement.to_location_name ?? '—'}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color} print:border print:border-gray-300`}>{operationLabel}</span></td>
                          <td className={`px-3 py-3 md:px-4 md:py-4 print:p-2 text-right font-bold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatQuantity(movement.quantity)}</td>
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-right text-gray-600 dark:text-gray-400">{movement.previous_stock}</td>
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-right font-bold text-gray-900 dark:text-white">{movement.new_stock}</td>
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-sm text-gray-600 dark:text-gray-400 min-w-[220px]">
                            <div className="space-y-1">
                              <div>
                                <span className="font-semibold text-gray-500 dark:text-gray-400">Origem:</span>{' '}
                                {getMovementOriginLabel(movement)}
                              </div>

                              <div>
                                <span className="font-semibold text-gray-500 dark:text-gray-400">Destino:</span>{' '}
                                {getMovementDestinationLabel(movement)}
                              </div>

                              <div className="text-xs text-gray-400">
                                Ref.: {getMovementReferenceLabel(movement)}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 md:px-4 md:py-4 print:p-2 text-sm text-gray-600 dark:text-gray-400 min-w-[220px]">
                            <div className="space-y-1">
                              <div>{getMovementHumanDescription(movement)}</div>
                              {movement.reason && (
                                <div className="text-xs text-gray-500">
                                  Obs.: {movement.reason}
                                </div>
                              )}
                            </div>
                            {Number(movement.divergence_qty ?? 0) > 0 && (
                              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                <strong>Divergência:</strong>{' '}
                                {Number(movement.divergence_qty)} un. não chegaram ao destino.{' '}
                                <strong>Resolução:</strong>{' '}
                                {getTransferDivergenceResolutionLabel(movement.divergence_resolution)}.{' '}
                                <strong>Motivo:</strong>{' '}
                                {getTransferDivergenceReasonLabel(movement.divergence_reason)}.
                              </div>
                            )}
                            {movement.transfer_id && (
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/transfers/${movement.transfer_id}`)}
                                className="text-xs text-gray-500 hover:text-[#21A896] mt-0.5"
                              >
                                Ver transferência
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {isSmartInitialLoad && canLoadMoreInitialMovements && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Exibindo os {movements.length} lançamentos mais recentes de {total}
                </p>
                <button
                  type="button"
                  onClick={() => setInitialMovementsLimit((limit) => Math.min(limit + MOVEMENTS_PAGE_SIZE, total))}
                  disabled={loading}
                  className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Carregar mais
                </button>
              </div>
            )}

            {!isSmartInitialLoad && totalPages > 1 && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between print:hidden">
                <p className="text-sm text-gray-600 dark:text-gray-400">Página {currentPage} de {totalPages}</p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"><ChevronLeft size={18} /></button>
                  <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div className="hidden">
        <PrintableStockMovements
          ref={printRef}
          movements={movements}
          title={selectedProduct ? `Produto: ${selectedProduct.name}` : 'Movimentações de Estoque'}
          storeName={storeName}
          printedBy={userEmail}
          filters={{ startDate: filters.startDate, endDate: filters.endDate, type: filters.type }}
        />
      </div>
      <ManualStockAdjustmentModal
        open={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        onSuccess={() => {
          void loadMovements();
          refreshInventory();
        }}
        products={availableProducts}
        locations={adjustmentLocations.length > 0 ? adjustmentLocations : locationOptions}
      />
      </PageContainer>
    </>
  );
}
