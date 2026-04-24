import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  History,
  Filter,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Printer,
  Calendar,
  ListFilter,
  FileText,
  Search,
  Plus,
} from 'lucide-react';
import PageContainer from '@/components/common/PageContainer';
import { supabase } from '@/lib/supabase';
import EmptyState from '@/components/common/empty-state/EmptyState';

import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory';
import type { StockMovement, StockMovementType, StockMovementFilters } from './types/inventory.types';
import PrintableStockMovements from '@/pages/private/admin/products/inventory/components/PrintableStockMovements';
import { useReactToPrint } from 'react-to-print';
import { timezoneUtils } from '@/utils/timezoneUtils';
import { downloadCsv } from '@/utils/export/csv';
import { formatDateTimePtBr, formatNumberPtBr } from '@/utils/export/formatters';

const MOVEMENT_LABELS: Record<StockMovementType, { label: string; color: string }> = {
  entry: { label: 'Entrada', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  exit: { label: 'Saída', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  reservation: { label: 'Reserva', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  confirmation: { label: 'Baixa (Pedido)', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  cancellation: { label: 'Cancelamento', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  clearance: { label: 'Zeramento', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

export default function StockMovementsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fetchMovements } = useStockMovement();
  const { products: allProducts } = useInventory();

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 50;

  const [showFilters, setShowFilters] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
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
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);

    const movementType = searchParams.get('type') as StockMovementType | null;
    const productId = searchParams.get('productId');
    const productName = searchParams.get('productName');
    const productIds = searchParams.get('productIds');

    setFilters({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      type: movementType || undefined,
      productId: productId || undefined,
      productIds: productIds ? productIds.split(',') : undefined,
      locationId: undefined,
      search: undefined,
    });

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
      if (!user) return;

      setUserEmail(user.email || 'Admin');

      const { data: storeData, error: storeError } = await supabase.rpc('get_user_store_by_id', { p_user_id: user.id });
      if (storeError || !storeData) return;
      const store = Array.isArray(storeData) ? storeData[0] : storeData;

      const { data, error } = await supabase.rpc('get_store_config_admin', { p_store_id: store.id });
      if (error) return;
      const storeConfig = Array.isArray(data) ? data[0] : data;
      if (storeConfig) setStoreName(storeConfig.name);
    };
    void fetchStoreAndUser();
  }, []);

  useEffect(() => {
    void loadMovements();
  }, [currentPage, filters]);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const result = await fetchMovements(filters, currentPage, pageSize);
      setMovements(result.movements);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 3);

    setFilters({
      productId: undefined,
      productIds: undefined,
      type: undefined,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      locationId: undefined,
      search: undefined,
    });
    setSelectedProduct(null);
    setSelectedProductIds([]);
    setProductSearch('');
    setMovementSearch('');
    setLocationFilter('all');
    setCurrentPage(1);
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
  }, [movements]);

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

  const totalPages = Math.ceil(total / pageSize);

  const formatQuantity = (qty: number) => (qty > 0 ? `+${Math.abs(qty)}` : `-${Math.abs(qty)}`);

  const formatDate = (dateString: string) => timezoneUtils.formatBrazilDateTime(dateString);
  const formatDateOnly = (dateString: string) => timezoneUtils.formatBrazilDate(dateString);

  const handleExportCsv = () => {
    const exportableMovements = movements;
    downloadCsv({
      filename: `movimentacoes_estoque_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Data/Hora',
        'Produto',
        'Local',
        'Tipo',
        'Quantidade',
        'Estoque antes',
        'Estoque depois',
        'Motivo',
        'Origem',
        'Transferência',
      ],
      rows: exportableMovements.map((movement) => [
        formatDateTimePtBr(movement.created_at),
        movement.product_name ?? '',
        movement.location_name
          ? movement.location_name
          : movement.from_location_name || movement.to_location_name
          ? `${movement.from_location_name ?? '—'} -> ${movement.to_location_name ?? '—'}`
          : '',
        MOVEMENT_LABELS[movement.type]?.label ?? movement.type,
        formatNumberPtBr(movement.quantity),
        formatNumberPtBr(movement.previous_stock),
        formatNumberPtBr(movement.new_stock),
        movement.reason ?? '',
        movement.source_label ?? movement.source ?? '',
        movement.transfer_code ?? movement.transfer_id ?? '',
      ]),
    });
  };

  const hasActiveFilters =
    !!movementSearch.trim() ||
    !!productSearch.trim() ||
    locationFilter !== 'all' ||
    !!filters.type ||
    !!filters.productId ||
    !!(filters.productIds && filters.productIds.length > 0);

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
    <PageContainer
      title={selectedProduct ? `Movimentações: ${selectedProduct.name}` : 'Movimentações de Estoque'}
      subtitle="Entradas, saídas, baixas e ajustes centralizados em um único lugar"
      action={
        <div className="flex gap-2">
          <Link
            to="/admin/products"
            className="p-2 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Ir para Produtos"
          >
            <Package size={20} />
          </Link>
          <Link
            to="/admin/inventory"
            className="p-2 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Ir para Estoque"
          >
            <FileText size={20} />
          </Link>
          <Link
            to="/admin/stock/purchase-documents"
            className="p-2 text-gray-400 hover:text-[#21A896] transition bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
            title="Entradas por documento"
          >
            <Plus size={20} />
          </Link>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${showFilters
              ? 'bg-[#21A896] text-white'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filtros</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium flex items-center gap-2"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium flex items-center gap-2"
          >
            <FileText size={18} />
            <span className="hidden sm:inline">Exportar CSV</span>
          </button>
        </div>
      }
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <Calendar size={16} />
                Período
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-gray-500 mb-1 block">Data inicial</span>
                  <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, startDate: e.target.value || undefined });
                      setCurrentPage(1);
                    }}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500 mb-1 block">Data final</span>
                  <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => {
                      setFilters({ ...filters, endDate: e.target.value || undefined });
                      setCurrentPage(1);
                    }}
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Movimentação
              </label>
              <select
                value={filters.type || ''}
                onChange={(e) => {
                  setFilters({ ...filters, type: (e.target.value as StockMovementType) || undefined });
                  setCurrentPage(1);
                }}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Todos os tipos</option>
                {Object.entries(MOVEMENT_LABELS).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
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

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    onClick={applyProductFilter}
                    className="px-3 py-1.5 bg-[#21A896] text-white text-sm rounded-lg hover:bg-[#1a867a]"
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
        <div className="flex items-center justify-between">
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

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden print:shadow-none print:border-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-sm font-medium print:bg-gray-100">
              <tr>
                <th className="p-4 print:p-2">Data/Hora</th>
                <th className="p-4 print:p-2">Produto</th>
                <th className="p-4 print:p-2">Local</th>
                <th className="p-4 print:p-2 text-center">Tipo</th>
                <th className="p-4 print:p-2 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    Quantidade
                    <InfoTooltip text="Variação registrada na movimentação. Valores positivos indicam entrada; negativos indicam saída." />
                  </div>
                </th>
                <th className="p-4 print:p-2 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    Estoque Antes
                    <InfoTooltip text="Saldo imediatamente antes da movimentação." />
                  </div>
                </th>
                <th className="p-4 print:p-2 text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    Estoque Depois
                    <InfoTooltip text="Saldo imediatamente após a movimentação." />
                  </div>
                </th>
                <th className="p-4 print:p-2">
                  <div className="inline-flex items-center gap-1">
                    Motivo
                    <InfoTooltip text="Descrição operacional do que gerou a movimentação, como transferência, ajuste, reserva ou saída manual." />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Carregando...</td></tr>
              ) : (
                movements.map((movement) => {
                  const config = MOVEMENT_LABELS[movement.type];
                  return (
                    <tr key={movement.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors print:hover:bg-transparent">
                      <td className="p-4 print:p-2 text-sm text-gray-600 dark:text-gray-400">{formatDate(movement.created_at)}</td>
                      <td className="p-4 print:p-2 font-medium text-gray-900 dark:text-white">
                        <button
                          type="button"
                          onClick={() => navigate(`/admin/products/${movement.product_id}/lifecycle`)}
                          className="font-medium text-[#21A896] hover:underline text-left"
                        >
                          {movement.product_name || 'Produto removido'}
                        </button>
                      </td>
                      <td className="p-4 print:p-2 text-sm text-gray-600 dark:text-gray-400">
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
                      <td className="p-4 print:p-2 text-center"><span className={`px-3 py-1 rounded-full text-xs font-bold ${config.color} print:border print:border-gray-300`}>{config.label}</span></td>
                      <td className={`p-4 print:p-2 text-right font-bold ${movement.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>{formatQuantity(movement.quantity)}</td>
                      <td className="p-4 print:p-2 text-right text-gray-600 dark:text-gray-400">{movement.previous_stock}</td>
                      <td className="p-4 print:p-2 text-right font-bold text-gray-900 dark:text-white">{movement.new_stock}</td>
                      <td className="p-4 print:p-2 text-sm text-gray-600 dark:text-gray-400 max-w-xs">
                        <div className="truncate">{movement.reason || '-'}</div>
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

        {totalPages > 1 && (
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
    </PageContainer>
  );
}
