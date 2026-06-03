import { useMemo, useState, useEffect, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useInventoryByLocation } from './hooks/useInventoryByLocation';
import { useInventoryTransit } from './hooks/useInventoryTransit';
import { mergeInventoryRowsWithTransit } from './utils/mergeInventoryTransit';
import { downloadCsv } from '@/utils/export/csv';
import { formatNumberPtBr } from '@/utils/export/formatters';
import EmptyState from '@/components/common/empty-state/EmptyState';
import EmptyTableState from '@/components/common/empty-state/EmptyTableState';
import InfoTooltip from '@/components/common/tooltip/InfoTooltip';
import PageContainer from '@/components/common/PageContainer';
import {
  PackageSearch,
  ArrowRightLeft,
  ShoppingCart,
  AlertTriangle,
  Archive,
  Truck,
  ChevronUp,
  ChevronDown,
  FileText,
} from 'lucide-react';

// ─── Mapas de status local ────────────────────────────────────────────────────

const statusLabelMap: Record<string, string> = {
  out: 'Sem estoque',
  low: 'Crítico',
  ok: 'OK',
  over: 'Excesso',
  inactive: 'Inativo',

  location_stockout: 'Sem estoque no local',
  location_critical: 'Crítico no local',
  location_excess: 'Excesso no local',
  location_ok: 'OK no local',
  location_inactive: 'Local inativo',
  product_inactive: 'Produto inativo',
  monitor_only: 'Monitorar',
  not_configured: 'Sem regra',
};

const statusClassMap: Record<string, string> = {
  out: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  over: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',

  location_stockout: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  location_critical: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  location_excess: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  location_ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

// ─── Mapas de ação gerencial ──────────────────────────────────────────────────

const actionLabelMap: Record<string, string> = {
  buy: 'Comprar',
  transfer: 'Transferir',
  monitor: 'Monitorar',
  review_excess: 'Revisar excesso',
  ok: 'OK',
  await_transit: 'Aguardar recebimento',
};

const actionClassMap: Record<string, string> = {
  buy: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  transfer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  monitor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  review_excess: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  await_transit: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
};

function getTransitAwareAction(row: any) {
  const available = Number(row.available ?? 0);
  const inTransitIn = Number(row.in_transit_in ?? 0);
  if (available <= 0 && inTransitIn > 0) return 'await_transit';
  return row.recommended_action;
}

const globalStatusLabelMap: Record<string, string> = {
  product_inactive: 'Produto inativo',
  global_stockout: 'Ruptura global',
  global_critical: 'Crítico global',
  global_attention: 'Atenção global',
  global_excess: 'Excesso global',
  global_ok: 'Global OK',
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function InventoryByLocationPage() {
  const navigate = useNavigate();
  const { rows: rawRows, loading, storeId } = useInventoryByLocation();
  const { rows: transitRows } = useInventoryTransit(storeId);

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'));
  }, []);

  const rows = useMemo(
    () => mergeInventoryRowsWithTransit(rawRows, transitRows),
    [rawRows, transitRows]
  );

  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedAction, setSelectedAction] = useState('all');
  const [groupBy, setGroupBy] = useState<'none' | 'product' | 'location'>('none');
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showInactives, setShowInactives] = useState(false);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        return null; // Volta ao estado original
      }
      return { key, direction: 'asc' };
    });
  };

  const locations = useMemo(() => {
    const unique = new Map<string, string>();
    rows.forEach((row) => {
      unique.set(row.location_id, row.location_name);
    });
    return Array.from(unique.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        !search.trim() ||
        row.product_name.toLowerCase().includes(search.toLowerCase()) ||
        row.location_name.toLowerCase().includes(search.toLowerCase());

      const matchesLocation =
        selectedLocation === 'all' || row.location_id === selectedLocation;

      const matchesStatus =
        selectedStatus === 'all' || row.stock_status === selectedStatus;

      const matchesAction =
        selectedAction === 'all' || row.recommended_action === selectedAction;

      const isInactive =
        row.location_status === 'inactive' ||
        row.location_status === 'location_inactive' ||
        row.stock_status === 'inactive' ||
        row.stock_status === 'product_inactive' ||
        row.global_status === 'product_inactive';

      const matchesInactives = showInactives || !isInactive;

      return matchesSearch && matchesLocation && matchesStatus && matchesAction && matchesInactives;
    });
  }, [rows, search, selectedLocation, selectedStatus, selectedAction, showInactives]);

  const sortedRows = useMemo(() => {
    const data = [...filteredRows];
    if (!sortConfig) return data;

    return data.sort((a: any, b: any) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) {
        // Se empatou no critério principal e for Local, secundário é Produto
        if (sortConfig.key === 'location_name') {
          return a.product_name.localeCompare(b.product_name);
        }
        return 0;
      }
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const modifier = sortConfig.direction === 'asc' ? 1 : -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * modifier;
      }

      return (aValue < bValue ? -1 : 1) * modifier;
    });
  }, [filteredRows, sortConfig]);

  const groupedRows = useMemo(() => {
    if (groupBy === 'none') return null;

    const groups = new Map<string, { label: string; rows: any[] }>();

    sortedRows.forEach((row) => {
      const key = groupBy === 'product' ? row.product_id : row.location_id;
      const label = groupBy === 'product' ? row.product_name : row.location_name;

      if (!groups.has(key)) {
        groups.set(key, { label, rows: [] });
      }
      groups.get(key)!.rows.push(row);
    });

    return Array.from(groups.values());
  }, [sortedRows, groupBy]);

  const filteredSummary = useMemo(() => {
    const buyProducts = new Set<string>();
    const transferProducts = new Set<string>();
    const monitorProducts = new Set<string>();
    const excessProducts = new Set<string>();

    return filteredRows.reduce(
      (acc, row) => {
        acc.onHand += Number(row.on_hand || 0);
        acc.reserved += Number(row.reserved || 0);
        acc.available += Number(row.available || 0);

        if (row.location_status === 'location_stockout') acc.locationStockout += 1;
        if (row.location_status === 'location_critical') acc.locationCritical += 1;
        if (row.location_status === 'location_excess') acc.locationExcess += 1;

        if (row.recommended_action === 'buy') buyProducts.add(row.product_id);
        if (row.recommended_action === 'transfer') transferProducts.add(row.product_id);
        if (row.recommended_action === 'monitor') monitorProducts.add(row.product_id);
        if (row.recommended_action === 'review_excess') excessProducts.add(row.product_id);

        acc.recommendedBuy = buyProducts.size;
        acc.recommendedTransfer = transferProducts.size;
        acc.recommendedMonitor = monitorProducts.size;
        acc.recommendedReviewExcess = excessProducts.size;

        return acc;
      },
      {
        onHand: 0,
        reserved: 0,
        available: 0,
        locationStockout: 0,
        locationCritical: 0,
        locationExcess: 0,
        recommendedBuy: 0,
        recommendedTransfer: 0,
        recommendedMonitor: 0,
        recommendedReviewExcess: 0,
      }
    );
  }, [filteredRows]);

  const filteredLocationsCount = useMemo(() => {
    return new Set(filteredRows.map((row) => row.location_id)).size;
  }, [filteredRows]);

  const totalInTransitIn = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number((row as any).in_transit_in ?? 0), 0);
  }, [filteredRows]);

  const totalInTransitOut = useMemo(() => {
    return filteredRows.reduce((sum, row) => sum + Number((row as any).in_transit_out ?? 0), 0);
  }, [filteredRows]);

  const hasFilters =
    search.trim() !== '' ||
    selectedLocation !== 'all' ||
    selectedStatus !== 'all' ||
    selectedAction !== 'all' ||
    groupBy !== 'none' ||
    sortConfig !== null;

  const clearFilters = () => {
    setSearch('');
    setSelectedLocation('all');
    setSelectedStatus('all');
    setSelectedAction('all');
    setGroupBy('none');
    setSortConfig(null);
    setShowInactives(false);
  };

  const handleExportCsv = () => {
    downloadCsv({
      filename: `estoque_por_local_${new Date().toISOString().slice(0, 10)}.csv`,
      headers: [
        'Local',
        'Código do local',
        'Produto',
        'Físico',
        'Reservado',
        'Disponível',
        'Em trânsito entrada',
        'Em trânsito saída',
        'Disponível projetado',
        'Transferências entrada',
        'Transferências saída',
        'Mínimo local provisório',
        'Máximo local provisório',
        'Status local',
        'Ação',
        'Status global',
        'Disponível global',
        'Origens possíveis',
      ],
      rows: filteredRows.map((row) => {
        const sourceLocations = Array.isArray(row.source_locations)
          ? row.source_locations
          : [];

        const sourceSummary = sourceLocations
          .filter((source) => source.location_id !== row.location_id)
          .map(
            (source) =>
              `${source.location_name} (${source.location_code}) - Disp.: ${formatNumberPtBr(source.available ?? 0)}`
          )
          .join(' | ');

        return [
          row.location_name,
          row.location_code,
          row.product_name,
          formatNumberPtBr(row.on_hand),
          formatNumberPtBr(row.reserved),
          formatNumberPtBr(row.available),
          formatNumberPtBr(row.in_transit_in ?? 0),
          formatNumberPtBr(row.in_transit_out ?? 0),
          formatNumberPtBr((row as any).projected_available ?? row.available ?? 0),
          Array.isArray((row as any).incoming_transfers)
            ? (row as any).incoming_transfers.map((t: any) => t.transfer_code).join(' | ')
            : '',
          Array.isArray((row as any).outgoing_transfers)
            ? (row as any).outgoing_transfers.map((t: any) => t.transfer_code).join(' | ')
            : '',
          formatNumberPtBr(row.provisional_location_min_stock ?? row.min_stock ?? 0),
          formatNumberPtBr(row.provisional_location_max_stock ?? row.max_stock ?? 0),
          statusLabelMap[row.location_status] ??
            statusLabelMap[row.stock_status] ??
            row.stock_status ??
            '',
          actionLabelMap[getTransitAwareAction(row)] ?? getTransitAwareAction(row) ?? '',
          globalStatusLabelMap[row.global_status] ?? row.global_status ?? '',
          formatNumberPtBr(row.global_available ?? 0),
          sourceSummary || '',
        ];
      }),
    });
  };

  const hasAnyData = rows.length > 0;
  const hasFilteredData = filteredRows.length > 0;
  const isFilteredEmpty = hasAnyData && !hasFilteredData;

  const handleCreateTransferFromRow = (row: any) => {
    const sourceLocations = Array.isArray(row.source_locations)
      ? row.source_locations
      : [];

    const bestSource = sourceLocations.find(
      (source: any) => source.location_id !== row.location_id
    );

    if (!bestSource) return;

    const destinationNeed = Math.max(
      1,
      Number(row.provisional_location_min_stock ?? 0) - Number(row.available ?? 0)
    );

    const sourceSafeExcess = Math.max(
      0,
      Number(bestSource.available ?? 0) - Number(row.provisional_location_min_stock ?? 0)
    );

    const suggestedQty = Math.max(
      1,
      Math.min(destinationNeed, sourceSafeExcess || destinationNeed)
    );

    const params = new URLSearchParams({
      product_id: row.product_id,
      source_location_id: bestSource.location_id,
      destination_location_id: row.location_id,
      suggested_qty: String(suggestedQty),
    });

    navigate(`/admin/transfers?${params.toString()}`);
  };

  if (loading) return <LoadingSpinner />;

  if (!loading && !hasAnyData) {
    return (
      <PageContainer
        title="Estoque por local"
        subtitle="Visão multiestoque com saldo físico, reservado e disponível por local."
        category="Produtos"
        icon={<FileText size={28} className="text-[#21A896]" />}
        flat
      >
        <EmptyState
          icon={<PackageSearch className="h-5 w-5" />}
          title="Ainda não há posições de estoque por local"
          description="Assim que houver saldos registrados nos locais de estoque, esta visão começará a exibir as posições."
        />
      </PageContainer>
    );
  }

  return (
    <>
      {portalContainer && createPortal(
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors shadow-sm cursor-pointer shrink-0"
        >
          Exportar CSV
        </button>,
        portalContainer
      )}

      <PageContainer
        title="Estoque por local"
        subtitle="Visão multiestoque com saldo físico, reservado e disponível por local."
        category="Produtos"
        icon={<FileText size={28} className="text-[#21A896]" />}
        flat
      >

      {/* Cards gerenciais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-8 gap-4">
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500">Posições</div>
          <div className="text-2xl font-bold">{filteredRows.length}</div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500">Locais</div>
          <div className="text-2xl font-bold">{filteredLocationsCount}</div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Comprar
            <InfoTooltip text="Produtos cujo estoque global está zerado ou crítico. A ação correta tende a ser compra/reposição." />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ShoppingCart size={18} className="text-red-500" />
            <span className="text-2xl font-bold text-red-600 dark:text-red-400">
              {filteredSummary.recommendedBuy}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Transferir
            <InfoTooltip text="Produtos com saldo global, mas com ruptura ou criticidade em algum local. A ação sugerida é redistribuição." />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-blue-500" />
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {filteredSummary.recommendedTransfer}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Locais críticos
            <InfoTooltip text="Quantidade de posições por local sem estoque ou abaixo do mínimo provisório." />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-500" />
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {filteredSummary.locationStockout + filteredSummary.locationCritical}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Disponível
            <InfoTooltip text="Soma do disponível das posições filtradas." />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Archive size={18} className="text-emerald-500" />
            <span className="text-2xl font-bold">
              {formatNumberPtBr(filteredSummary.available)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Trânsito entrada
            <InfoTooltip text="Quantidade total a caminho desta localização, ainda não recebida." />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Truck size={18} className="text-sky-500" />
            <span className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {formatNumberPtBr(totalInTransitIn)}
            </span>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="text-sm text-gray-500 flex items-center gap-1">
            Trânsito saída
            <InfoTooltip text="Quantidade total enviada desta localização, ainda não recebida no destino." />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Truck size={18} className="text-amber-500" />
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatNumberPtBr(totalInTransitOut)}
            </span>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl bg-white dark:bg-gray-800 p-4 shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Buscar por produto ou local"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          />

          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          >
            <option value="all">Todos os locais</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          >
            <option value="all">Todos os status</option>
            <option value="out">Sem estoque</option>
            <option value="low">Crítico</option>
            <option value="ok">OK</option>
            <option value="over">Excesso</option>
            <option value="inactive">Inativo</option>
          </select>

          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          >
            <option value="all">Todas as ações</option>
            <option value="buy">Comprar</option>
            <option value="transfer">Transferir</option>
            <option value="monitor">Monitorar</option>
            <option value="review_excess">Revisar excesso</option>
            <option value="ok">OK</option>
          </select>

          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          >
            <option value="none">Sem agrupamento</option>
            <option value="product">Agrupar por Produto</option>
            <option value="location">Agrupar por Local</option>
          </select>

          <select
            value={sortConfig?.key || 'none'}
            onChange={(e) => {
              if (e.target.value === 'none') setSortConfig(null);
              else handleSort(e.target.value);
            }}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm outline-none"
          >
            <option value="none">Ordenar por...</option>
            <option value="product_name">Produto (A-Z)</option>
            <option value="location_name">Local (A-Z)</option>
            <option value="available">Estoque Disponível</option>
            <option value="on_hand">Estoque Físico</option>
          </select>
        </div>

        <div className="flex items-center gap-4 pt-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={showInactives}
                onChange={(e) => setShowInactives(e.target.checked)}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-gray-300 transition-all checked:border-[#21A896] checked:bg-[#21A896] hover:border-[#21A896]"
              />
              <svg className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 left-1/2 -translate-x-1/2 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">
              Mostrar inativos
            </span>
          </label>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition"
            >
              Limpar todos os filtros
            </button>
          )}
        </div>

        {hasFilters && (
          <p className="text-xs text-gray-400">
            {filteredRows.length} de {rows.length} posição{rows.length !== 1 ? 'ões' : ''} exibida{filteredRows.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Tabela */}
      <div className="space-y-4">
        <div className="flex items-center">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            Posição por local
          </h2>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <table className="min-w-[1300px] w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/40">
              <tr>
                <th 
                  className="text-left px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  onClick={() => handleSort('location_name')}
                >
                  <div className="flex items-center gap-1">
                    Local
                    <div className={`transition-opacity ${sortConfig?.key === 'location_name' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                      {sortConfig?.key === 'location_name' && sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </th>
                <th 
                  className="text-left px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  onClick={() => handleSort('product_name')}
                >
                  <div className="flex items-center gap-1">
                    Produto
                    <div className={`transition-opacity ${sortConfig?.key === 'product_name' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                      {sortConfig?.key === 'product_name' && sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </th>
                <th 
                  className="text-left px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  onClick={() => handleSort('on_hand')}
                >
                  <div className="flex items-center gap-1">
                    Físico
                    <div className={`transition-opacity ${sortConfig?.key === 'on_hand' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                      {sortConfig?.key === 'on_hand' && sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </th>
                <th 
                  className="text-left px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  onClick={() => handleSort('reserved')}
                >
                  <div className="flex items-center gap-1">
                    Reservado
                    <div className={`transition-opacity ${sortConfig?.key === 'reserved' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                      {sortConfig?.key === 'reserved' && sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </th>
                <th 
                  className="text-left px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
                  onClick={() => handleSort('available')}
                >
                  <div className="flex items-center gap-1">
                    Disponível
                    <div className={`transition-opacity ${sortConfig?.key === 'available' ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'}`}>
                      {sortConfig?.key === 'available' && sortConfig.direction === 'desc' ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                    </div>
                  </div>
                </th>
                <th className="text-left px-4 py-3">Entrando</th>
                <th className="text-left px-4 py-3">Saindo</th>
                <th className="text-left px-4 py-3">Mín. local</th>
                <th className="text-left px-4 py-3">Status local</th>
                <th className="text-left px-4 py-3">Ação</th>
                <th className="text-left px-4 py-3">Global</th>
                <th className="text-left px-4 py-3">Origem</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const renderRow = (row: any) => {
                  const sourceLocations = Array.isArray(row.source_locations)
                    ? row.source_locations
                    : [];

                  const bestSource = sourceLocations.find(
                    (source: any) => source.location_id !== row.location_id
                  );

                  return (
                    <tr
                      key={`${row.location_id}-${row.product_id}-${row.variant_id ?? 'base'}`}
                      className="border-t border-gray-100 dark:border-gray-700"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.location_name}</div>
                        <div className="text-xs text-gray-400">{row.location_code}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{row.product_name}</div>
                        <Link
                          to={`/admin/products/${row.product_id}/lifecycle`}
                          className="text-xs text-[#21A896] hover:underline"
                        >
                          Ver vida do produto
                        </Link>
                      </td>

                      <td className="px-4 py-3">{formatNumberPtBr(row.on_hand)}</td>
                      <td className="px-4 py-3">{formatNumberPtBr(row.reserved)}</td>

                      <td className="px-4 py-3">
                        <span className="font-semibold">
                          {formatNumberPtBr(row.available)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {Number((row as any).in_transit_in ?? 0) > 0 ? (
                          <div className="space-y-1">
                            <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                              +{formatNumberPtBr((row as any).in_transit_in)} em trânsito
                            </span>
                            {Array.isArray((row as any).incoming_transfers) &&
                              (row as any).incoming_transfers.slice(0, 1).map((transfer: any) => (
                                <div key={transfer.transfer_id} className="text-xs text-blue-600">
                                  {transfer.transfer_code}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {Number((row as any).in_transit_out ?? 0) > 0 ? (
                          <div className="space-y-1">
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                              -{formatNumberPtBr((row as any).in_transit_out)} em trânsito
                            </span>
                            {Array.isArray((row as any).outgoing_transfers) &&
                              (row as any).outgoing_transfers.slice(0, 1).map((transfer: any) => (
                                <div key={transfer.transfer_id} className="text-xs text-amber-600">
                                  {transfer.transfer_code}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {formatNumberPtBr(row.provisional_location_min_stock ?? row.min_stock ?? 0)}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                            statusClassMap[row.location_status] ??
                            statusClassMap[row.stock_status] ??
                            'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                          }`}
                        >
                          {statusLabelMap[row.location_status] ??
                            statusLabelMap[row.stock_status] ??
                            row.stock_status}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {(() => {
                          const action = getTransitAwareAction(row);
                          return (
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                actionClassMap[action] ??
                                'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                              }`}
                            >
                              {actionLabelMap[action] ?? action}
                            </span>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-xs">
                          {globalStatusLabelMap[row.global_status] ?? row.global_status}
                        </div>
                        <div className="text-xs text-gray-400">
                          Disp.: {formatNumberPtBr(row.global_available ?? 0)}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {row.recommended_action === 'transfer' && bestSource ? (
                          <div className="text-xs space-y-1">
                            <div className="font-medium text-blue-600 dark:text-blue-300">
                              {bestSource.location_name}
                            </div>
                            <div className="text-gray-400">
                              Disp.: {formatNumberPtBr(bestSource.available ?? 0)}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCreateTransferFromRow(row)}
                              className="mt-1 inline-flex items-center rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
                            >
                              Criar transferência
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                };

                if (groupBy === 'none') {
                  return sortedRows.map(renderRow);
                }

                return groupedRows?.map((group) => (
                  <Fragment key={group.label}>
                    <tr className="bg-gray-50/50 dark:bg-gray-900/20">
                      <td colSpan={12} className="px-4 py-2 font-bold text-[#21A896] border-y border-gray-100 dark:border-gray-700">
                        {groupBy === 'product' ? 'Produto: ' : 'Local: '}{group.label}
                        <span className="ml-2 font-normal text-xs text-gray-400">
                          ({group.rows.length} posiç{group.rows.length === 1 ? 'ão' : 'ões'})
                        </span>
                      </td>
                    </tr>
                    {group.rows.map(renderRow)}
                  </Fragment>
                ));
              })()}

              {!hasAnyData && (
                <EmptyTableState
                  colSpan={12}
                  title="Nenhum saldo por local encontrado"
                  description="Quando houver estoque distribuído entre locais, ele aparecerá aqui."
                />
              )}
              {isFilteredEmpty && (
                <EmptyTableState
                  colSpan={12}
                  title="Nenhum resultado para os filtros aplicados"
                  description="Tente limpar os filtros ou ampliar a busca para encontrar outras posições."
                />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  </>
);
}
