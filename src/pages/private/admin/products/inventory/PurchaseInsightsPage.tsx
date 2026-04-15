import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Download,
  FileText,
  Filter,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import PageContainer from '@/components/common/PageContainer';
import StatsCard from '@/components/common/StatsCard';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import AlertBanner from '@/components/common/AlertBanner';
import {
  useProcurementDashboard,
  type ProcurementTopProductBySupplierRow,
  type ProcurementTopProductRow,
} from './hooks/useProcurementDashboard';
import {
  buildCsv,
  downloadCsv,
  formatCsvIntegerBR,
  formatCsvNumberBR,
} from '@/utils/csv';

function formatCurrency(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatNumber(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString('pt-BR');
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function getAlertBadge(alertType: string) {
  switch (alertType) {
    case 'high_increase':
      return {
        label: 'Alta forte',
        className:
          'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      };
    case 'price_up':
      return {
        label: 'Preço subiu',
        className:
          'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      };
    default:
      return {
        label: 'Alerta',
        className:
          'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
      };
  }
}

function withinPeriod(
  dateValue: string | null | undefined,
  period: 'all' | '30d' | '90d',
) {
  if (period === 'all') return true;
  if (!dateValue) return false;

  const diffDays =
    (Date.now() - new Date(dateValue).getTime()) / (1000 * 60 * 60 * 24);

  if (period === '30d') return diffDays <= 30;
  if (period === '90d') return diffDays <= 90;
  return true;
}

function compareNullableDatesDesc(a?: string | null, b?: string | null) {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return bTime - aTime;
}

function isTopProductBySupplier(
  item: ProcurementTopProductRow | ProcurementTopProductBySupplierRow,
): item is ProcurementTopProductBySupplierRow {
  return 'supplier_id' in item;
}

export default function PurchaseInsightsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    loading,
    error,
    summary,
    topSuppliers,
    topProducts,
    topProductsBySupplier,
    priceAlerts,
    staleSuppliers,
    refresh,
  } = useProcurementDashboard();

  const [supplierFilter, setSupplierFilter] = useState<string>(
    searchParams.get('supplier') || 'all',
  );
  const [periodFilter, setPeriodFilter] = useState<'all' | '30d' | '90d'>(
    (searchParams.get('period') as 'all' | '30d' | '90d') || 'all',
  );

  const [suppliersLimit, setSuppliersLimit] = useState<number>(
    Number(searchParams.get('suppliersLimit') || 10),
  );
  const [productsLimit, setProductsLimit] = useState<number>(
    Number(searchParams.get('productsLimit') || 10),
  );
  const [alertsLimit, setAlertsLimit] = useState<number>(
    Number(searchParams.get('alertsLimit') || 10),
  );
  const [staleLimit, setStaleLimit] = useState<number>(
    Number(searchParams.get('staleLimit') || 10),
  );

  const [suppliersSort, setSuppliersSort] = useState<'spent' | 'rank' | 'last_purchase'>(
    (searchParams.get('suppliersSort') as 'spent' | 'rank' | 'last_purchase') || 'spent',
  );
  const [productsSort, setProductsSort] = useState<'spent' | 'quantity' | 'last_purchase'>(
    (searchParams.get('productsSort') as 'spent' | 'quantity' | 'last_purchase') || 'spent',
  );
  const [alertsSort, setAlertsSort] = useState<'delta' | 'supplier' | 'product'>(
    (searchParams.get('alertsSort') as 'delta' | 'supplier' | 'product') || 'delta',
  );
  const [staleSort, setStaleSort] = useState<'days' | 'spent' | 'name'>(
    (searchParams.get('staleSort') as 'days' | 'spent' | 'name') || 'days',
  );

  const lastUpdated = useMemo(() => new Date(), [
    summary,
    topSuppliers,
    topProducts,
    topProductsBySupplier,
    priceAlerts,
    staleSuppliers,
  ]);

  const supplierOptions = useMemo(() => {
    const map = new Map<string, string>();

    topSuppliers.forEach((item) => map.set(item.supplier_id, item.supplier_name));
    priceAlerts.forEach((item) => map.set(item.supplier_id, item.supplier_name));
    staleSuppliers.forEach((item) => map.set(item.supplier_id, item.supplier_name));
    topProductsBySupplier.forEach((item) => map.set(item.supplier_id, item.supplier_name));

    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [topSuppliers, priceAlerts, staleSuppliers, topProductsBySupplier]);

  const filteredTopSuppliers = useMemo(() => {
    return topSuppliers.filter((item) => {
      const supplierMatch = supplierFilter === 'all' || item.supplier_id === supplierFilter;
      const periodMatch = withinPeriod(item.last_purchase_date, periodFilter);
      return supplierMatch && periodMatch;
    });
  }, [topSuppliers, supplierFilter, periodFilter]);

  const filteredTopProducts = useMemo<Array<ProcurementTopProductRow | ProcurementTopProductBySupplierRow>>(() => {
    if (supplierFilter !== 'all') {
      return topProductsBySupplier.filter((item) => {
        const supplierMatch = item.supplier_id === supplierFilter;
        const periodMatch = withinPeriod(item.last_purchase_date, periodFilter);
        return supplierMatch && periodMatch;
      });
    }

    return topProducts.filter((item) => withinPeriod(item.last_purchase_date, periodFilter));
  }, [topProducts, topProductsBySupplier, supplierFilter, periodFilter]);

  const filteredPriceAlerts = useMemo(() => {
    return priceAlerts.filter((item) => {
      const supplierMatch = supplierFilter === 'all' || item.supplier_id === supplierFilter;
      const periodMatch = withinPeriod(item.current_purchase_at, periodFilter);
      return supplierMatch && periodMatch;
    });
  }, [priceAlerts, supplierFilter, periodFilter]);

  const filteredStaleSuppliers = useMemo(() => {
    return staleSuppliers.filter((item) => supplierFilter === 'all' || item.supplier_id === supplierFilter);
  }, [staleSuppliers, supplierFilter]);

  const visibleTopSuppliers = useMemo(() => {
    const sorted = [...filteredTopSuppliers].sort((a, b) => {
      switch (suppliersSort) {
        case 'rank':
          return (a.rank_position ?? Number.MAX_SAFE_INTEGER) - (b.rank_position ?? Number.MAX_SAFE_INTEGER);
        case 'last_purchase':
          return compareNullableDatesDesc(a.last_purchase_date, b.last_purchase_date);
        case 'spent':
        default:
          return (b.total_spent ?? 0) - (a.total_spent ?? 0);
      }
    });

    return sorted.slice(0, suppliersLimit);
  }, [filteredTopSuppliers, suppliersLimit, suppliersSort]);

  const visibleTopProducts = useMemo(() => {
    const sorted = [...filteredTopProducts].sort((a, b) => {
      switch (productsSort) {
        case 'quantity':
          return (b.total_quantity ?? 0) - (a.total_quantity ?? 0);
        case 'last_purchase':
          return compareNullableDatesDesc(a.last_purchase_date, b.last_purchase_date);
        case 'spent':
        default:
          return (b.total_spent ?? 0) - (a.total_spent ?? 0);
      }
    });

    return sorted.slice(0, productsLimit);
  }, [filteredTopProducts, productsLimit, productsSort]);

  const visiblePriceAlerts = useMemo(() => {
    const sorted = [...filteredPriceAlerts].sort((a, b) => {
      switch (alertsSort) {
        case 'supplier':
          return a.supplier_name.localeCompare(b.supplier_name, 'pt-BR');
        case 'product':
          return a.product_name.localeCompare(b.product_name, 'pt-BR');
        case 'delta':
        default:
          return (b.delta_pct ?? 0) - (a.delta_pct ?? 0);
      }
    });

    return sorted.slice(0, alertsLimit);
  }, [filteredPriceAlerts, alertsLimit, alertsSort]);

  const visibleStaleSuppliers = useMemo(() => {
    const sorted = [...filteredStaleSuppliers].sort((a, b) => {
      switch (staleSort) {
        case 'name':
          return a.supplier_name.localeCompare(b.supplier_name, 'pt-BR');
        case 'spent':
          return (b.total_spent ?? 0) - (a.total_spent ?? 0);
        case 'days':
        default:
          return (b.days_since_last_purchase ?? -1) - (a.days_since_last_purchase ?? -1);
      }
    });

    return sorted.slice(0, staleLimit);
  }, [filteredStaleSuppliers, staleLimit, staleSort]);

  const scopedSummary = useMemo(() => {
    const totalSpent = filteredTopSuppliers.reduce((sum, item) => sum + (item.total_spent ?? 0), 0);
    const confirmedDocuments = filteredTopSuppliers.reduce(
      (sum, item) => sum + (item.confirmed_documents ?? 0),
      0,
    );
    const activeSuppliers = supplierFilter === 'all'
      ? filteredTopSuppliers.length
      : filteredTopSuppliers.length > 0
        ? 1
        : 0;
    const purchasedProducts = filteredTopProducts.length;
    const avgTicket = confirmedDocuments > 0 ? totalSpent / confirmedDocuments : null;

    return {
      totalSpent,
      confirmedDocuments,
      activeSuppliers,
      purchasedProducts,
      avgTicket,
      weightedAvgUnitCost: summary?.weighted_avg_unit_cost ?? 0,
    };
  }, [filteredTopSuppliers, filteredTopProducts, supplierFilter, summary]);

  const exportDashboardCsv = useCallback(() => {
    const supplierRows = filteredTopSuppliers.map((item) => ({
      tipo: 'top_supplier',
      fornecedor: item.supplier_name,
      produto: '',
      ranking: formatCsvIntegerBR(item.rank_position),
      participacao_pct: formatCsvNumberBR(item.share_pct),
      total_gasto: formatCsvNumberBR(item.total_spent),
      documentos_confirmados: formatCsvIntegerBR(item.confirmed_documents),
      produtos_distintos: formatCsvIntegerBR(item.distinct_products),
      ultima_compra: item.last_purchase_date ?? '',
      fornecedores: '',
      quantidade_total: formatCsvNumberBR(item.total_quantity),
      custo_medio: '',
      alerta: '',
      delta_pct: '',
      custo_atual: '',
      custo_anterior: '',
      data: '',
      dias_sem_compra: '',
      status: '',
    }));

    const productRows = filteredTopProducts.map((item) => ({
      tipo: 'top_product',
      fornecedor: isTopProductBySupplier(item) ? item.supplier_name : '',
      produto: item.product_name,
      ranking: '',
      participacao_pct: '',
      total_gasto: formatCsvNumberBR(item.total_spent),
      documentos_confirmados: formatCsvIntegerBR(item.confirmed_documents),
      produtos_distintos: '',
      ultima_compra: item.last_purchase_date ?? '',
      fornecedores: isTopProductBySupplier(item) ? '' : formatCsvIntegerBR(item.suppliers_count),
      quantidade_total: formatCsvNumberBR(item.total_quantity),
      custo_medio: item.avg_unit_cost == null ? '' : formatCsvNumberBR(item.avg_unit_cost),
      alerta: '',
      delta_pct: '',
      custo_atual: '',
      custo_anterior: '',
      data: '',
      dias_sem_compra: '',
      status: '',
    }));

    const alertRows = filteredPriceAlerts.map((item) => ({
      tipo: 'price_alert',
      fornecedor: item.supplier_name,
      produto: item.product_name,
      ranking: '',
      participacao_pct: '',
      total_gasto: '',
      documentos_confirmados: '',
      produtos_distintos: '',
      ultima_compra: '',
      fornecedores: '',
      quantidade_total: '',
      custo_medio: '',
      alerta: item.alert_type,
      delta_pct: item.delta_pct == null ? '' : formatCsvNumberBR(item.delta_pct),
      custo_atual: formatCsvNumberBR(item.current_unit_cost),
      custo_anterior: item.previous_unit_cost == null ? '' : formatCsvNumberBR(item.previous_unit_cost),
      data: item.current_purchase_at ?? '',
      dias_sem_compra: '',
      status: '',
    }));

    const staleRows = filteredStaleSuppliers.map((item) => ({
      tipo: 'stale_supplier',
      fornecedor: item.supplier_name,
      produto: '',
      ranking: '',
      participacao_pct: '',
      total_gasto: formatCsvNumberBR(item.total_spent),
      documentos_confirmados: formatCsvIntegerBR(item.confirmed_documents),
      produtos_distintos: formatCsvIntegerBR(item.distinct_products),
      ultima_compra: item.last_purchase_at ?? '',
      fornecedores: '',
      quantidade_total: '',
      custo_medio: '',
      alerta: '',
      delta_pct: '',
      custo_atual: '',
      custo_anterior: '',
      data: '',
      dias_sem_compra: item.days_since_last_purchase == null ? '' : formatCsvIntegerBR(item.days_since_last_purchase),
      status: item.recency_status,
    }));

    const csv = buildCsv(
      [...supplierRows, ...productRows, ...alertRows, ...staleRows],
      [
        'tipo',
        'fornecedor',
        'produto',
        'ranking',
        'participacao_pct',
        'total_gasto',
        'documentos_confirmados',
        'produtos_distintos',
        'ultima_compra',
        'fornecedores',
        'quantidade_total',
        'custo_medio',
        'alerta',
        'delta_pct',
        'custo_atual',
        'custo_anterior',
        'data',
        'dias_sem_compra',
        'status',
      ],
    );

    const suffix = new Date().toISOString().slice(0, 10);
    downloadCsv(`dashboard_compras_${suffix}.csv`, csv);
  }, [filteredTopSuppliers, filteredTopProducts, filteredPriceAlerts, filteredStaleSuppliers]);

  const exportTopSuppliersCsv = useCallback(() => {
    const rows = filteredTopSuppliers.map((item) => ({
      fornecedor: item.supplier_name,
      ranking: formatCsvIntegerBR(item.rank_position),
      participacao_pct: formatCsvNumberBR(item.share_pct),
      total_gasto: formatCsvNumberBR(item.total_spent),
      documentos_confirmados: formatCsvIntegerBR(item.confirmed_documents),
      produtos_distintos: formatCsvIntegerBR(item.distinct_products),
      ultima_compra: item.last_purchase_date ?? '',
    }));

    const csv = buildCsv(rows, [
      'fornecedor',
      'ranking',
      'participacao_pct',
      'total_gasto',
      'documentos_confirmados',
      'produtos_distintos',
      'ultima_compra',
    ]);

    downloadCsv(`dashboard_top_fornecedores_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [filteredTopSuppliers]);

  const exportTopProductsCsv = useCallback(() => {
    const rows = filteredTopProducts.map((item) => ({
      fornecedor: isTopProductBySupplier(item) ? item.supplier_name : '',
      produto: item.product_name,
      fornecedores: isTopProductBySupplier(item) ? '' : formatCsvIntegerBR(item.suppliers_count),
      quantidade_total: formatCsvNumberBR(item.total_quantity),
      total_gasto: formatCsvNumberBR(item.total_spent),
      custo_medio: item.avg_unit_cost == null ? '' : formatCsvNumberBR(item.avg_unit_cost),
      ultima_compra: item.last_purchase_date ?? '',
    }));

    const csv = buildCsv(rows, [
      'fornecedor',
      'produto',
      'fornecedores',
      'quantidade_total',
      'total_gasto',
      'custo_medio',
      'ultima_compra',
    ]);

    downloadCsv(`dashboard_top_produtos_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [filteredTopProducts]);

  const exportPriceAlertsCsv = useCallback(() => {
    const rows = filteredPriceAlerts.map((item) => ({
      fornecedor: item.supplier_name,
      produto: item.product_name,
      alerta: item.alert_type,
      delta_pct: item.delta_pct == null ? '' : formatCsvNumberBR(item.delta_pct),
      custo_atual: formatCsvNumberBR(item.current_unit_cost),
      custo_anterior: item.previous_unit_cost == null ? '' : formatCsvNumberBR(item.previous_unit_cost),
      data: item.current_purchase_at ?? '',
    }));

    const csv = buildCsv(rows, [
      'fornecedor',
      'produto',
      'alerta',
      'delta_pct',
      'custo_atual',
      'custo_anterior',
      'data',
    ]);

    downloadCsv(`dashboard_alertas_preco_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [filteredPriceAlerts]);

  const exportStaleSuppliersCsv = useCallback(() => {
    const rows = filteredStaleSuppliers.map((item) => ({
      fornecedor: item.supplier_name,
      dias_sem_compra: item.days_since_last_purchase == null ? '' : formatCsvIntegerBR(item.days_since_last_purchase),
      status: item.recency_status,
      total_gasto: formatCsvNumberBR(item.total_spent),
      documentos_confirmados: formatCsvIntegerBR(item.confirmed_documents),
      produtos_distintos: formatCsvIntegerBR(item.distinct_products),
    }));

    const csv = buildCsv(rows, [
      'fornecedor',
      'dias_sem_compra',
      'status',
      'total_gasto',
      'documentos_confirmados',
      'produtos_distintos',
    ]);

    downloadCsv(`dashboard_fornecedores_sem_compra_${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }, [filteredStaleSuppliers]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);

    if (supplierFilter === 'all') next.delete('supplier');
    else next.set('supplier', supplierFilter);

    if (periodFilter === 'all') next.delete('period');
    else next.set('period', periodFilter);

    next.set('suppliersLimit', String(suppliersLimit));
    next.set('productsLimit', String(productsLimit));
    next.set('alertsLimit', String(alertsLimit));
    next.set('staleLimit', String(staleLimit));
    next.set('suppliersSort', suppliersSort);
    next.set('productsSort', productsSort);
    next.set('alertsSort', alertsSort);
    next.set('staleSort', staleSort);

    setSearchParams(next, { replace: true });
  }, [
    supplierFilter,
    periodFilter,
    suppliersLimit,
    productsLimit,
    alertsLimit,
    staleLimit,
    suppliersSort,
    productsSort,
    alertsSort,
    staleSort,
    searchParams,
    setSearchParams,
  ]);

  if (loading && !summary && !topSuppliers.length && !topProducts.length) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <PageContainer
      title="Dashboard de compras"
      subtitle="Visão consolidada de fornecedores, produtos, custo e alertas."
      lastUpdated={lastUpdated}
      onRefresh={refresh}
      action={
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </button>
      }
    >
      <div className="space-y-6">
        {error ? <AlertBanner type="error" title="Atenção" message={error} /> : null}

        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="min-w-[220px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Fornecedor
              </label>
              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="all">Todos</option>
                {supplierOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Período
              </label>
              <select
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value as 'all' | '30d' | '90d')}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="all">Todo período</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
              </select>
            </div>

            <LimitSelect label="Limite fornecedores" value={suppliersLimit} onChange={setSuppliersLimit} />
            <LimitSelect label="Limite produtos" value={productsLimit} onChange={setProductsLimit} />
            <LimitSelect label="Limite alertas" value={alertsLimit} onChange={setAlertsLimit} />
            <LimitSelect label="Limite sem compra" value={staleLimit} onChange={setStaleLimit} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSupplierFilter('all');
                setPeriodFilter('all');
                setSuppliersLimit(10);
                setProductsLimit(10);
                setAlertsLimit(10);
                setStaleLimit(10);
                setSuppliersSort('spent');
                setProductsSort('spent');
                setAlertsSort('delta');
                setStaleSort('days');
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Filter className="h-4 w-4" />
              Limpar filtros
            </button>

            <button
              type="button"
              onClick={exportDashboardCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              CSV consolidado
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatsCard title="Total comprado" value={formatCurrency(scopedSummary.totalSpent)} icon={<ShoppingCart className="h-5 w-5" />} color="purple" />
          <StatsCard title="Docs confirmados" value={scopedSummary.confirmedDocuments} icon={<Receipt className="h-5 w-5" />} color="blue" />
          <StatsCard title="Fornecedores ativos" value={scopedSummary.activeSuppliers} icon={<Truck className="h-5 w-5" />} color="green" />
          <StatsCard title="Produtos comprados" value={scopedSummary.purchasedProducts} icon={<Package className="h-5 w-5" />} color="orange" />
          <StatsCard title="Ticket médio" value={formatCurrency(scopedSummary.avgTicket)} icon={<TrendingUp className="h-5 w-5" />} color="purple" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Custo médio ponderado</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(scopedSummary.weightedAvgUnitCost)}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Primeira compra: {formatDate(summary?.first_purchase_date)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Última compra: {formatDate(summary?.last_purchase_date)}</div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Maiores aumentos</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{filteredPriceAlerts.length}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Itens com alerta de aumento no recorte atual.</div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">Fornecedores sem compra recente</div>
            <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{filteredStaleSuppliers.length}</div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">Inclui parados há mais de 90 dias e sem histórico.</div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardTable
            title="Top fornecedores por gasto"
            subtitle="Os fornecedores mais relevantes no consolidado da loja."
            extraAction={
              <div className="flex items-center gap-2">
                <select
                  value={suppliersSort}
                  onChange={(e) => setSuppliersSort(e.target.value as 'spent' | 'rank' | 'last_purchase')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="spent">Maior gasto</option>
                  <option value="rank">Ranking</option>
                  <option value="last_purchase">Última compra</option>
                </select>
                <button
                  type="button"
                  onClick={exportTopSuppliersCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            }
          >
            {loading ? (
              <DashboardSkeletonTable rows={5} />
            ) : visibleTopSuppliers.length === 0 ? (
              <EmptyTableMessage message="Nenhum fornecedor com compras confirmadas no recorte atual." />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fornecedor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Gasto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Part.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleTopSuppliers.map((item) => (
                    <tr key={item.supplier_id} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        <div className="font-medium">#{item.rank_position} • {item.supplier_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.distinct_products} produtos • {item.confirmed_documents} docs</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total_spent)}</td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{formatPercent(item.share_pct)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/suppliers/${item.supplier_id}`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            Ver fornecedor
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/stock/purchase-documents?supplier_id=${item.supplier_id}`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <FileText className="h-4 w-4" />
                            Documentos
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {filteredTopSuppliers.length > suppliersLimit ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSuppliersLimit((prev) => prev + 10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Ver mais 10
                </button>
              </div>
            ) : filteredTopSuppliers.length > 10 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSuppliersLimit(10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Recolher
                </button>
              </div>
            ) : null}
          </DashboardTable>

          <DashboardTable
            title="Top produtos comprados"
            subtitle={supplierFilter === 'all' ? 'Itens que mais concentram gasto ou volume.' : 'Produtos mais relevantes para o fornecedor selecionado.'}
            extraAction={
              <div className="flex items-center gap-2">
                <select
                  value={productsSort}
                  onChange={(e) => setProductsSort(e.target.value as 'spent' | 'quantity' | 'last_purchase')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="spent">Maior gasto</option>
                  <option value="quantity">Maior quantidade</option>
                  <option value="last_purchase">Última compra</option>
                </select>
                <button
                  type="button"
                  onClick={exportTopProductsCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            }
          >
            {loading ? (
              <DashboardSkeletonTable rows={5} />
            ) : visibleTopProducts.length === 0 ? (
              <EmptyTableMessage message="Nenhum produto encontrado no recorte atual." />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Produto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Quantidade</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Gasto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleTopProducts.map((item) => (
                    <tr key={`${isTopProductBySupplier(item) ? item.supplier_id : 'all'}-${item.product_id}`} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {'supplier_name' in item && item.supplier_name
                            ? `${item.supplier_name} • última compra ${formatDate(item.last_purchase_date)}`
                            : `${'suppliers_count' in item ? item.suppliers_count : 0} fornecedores • última compra ${formatDate(item.last_purchase_date)}`}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{formatNumber(item.total_quantity)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total_spent)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set('product_id', item.product_id);
                            if (isTopProductBySupplier(item)) {
                              params.set('supplier_id', item.supplier_id);
                            }
                            navigate(`/admin/stock/purchase-documents?${params.toString()}`);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <FileText className="h-4 w-4" />
                          Documentos
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {filteredTopProducts.length > productsLimit ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setProductsLimit((prev) => prev + 10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Ver mais 10
                </button>
              </div>
            ) : filteredTopProducts.length > 10 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setProductsLimit(10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Recolher
                </button>
              </div>
            ) : null}
          </DashboardTable>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DashboardTable
            title="Maiores aumentos de preço"
            subtitle="Produtos com alta recente no custo."
            icon={<AlertTriangle className="h-4 w-4" />}
            extraAction={
              <div className="flex items-center gap-2">
                <select
                  value={alertsSort}
                  onChange={(e) => setAlertsSort(e.target.value as 'delta' | 'supplier' | 'product')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="delta">Maior delta</option>
                  <option value="supplier">Fornecedor</option>
                  <option value="product">Produto</option>
                </select>
                <button
                  type="button"
                  onClick={exportPriceAlertsCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            }
          >
            {loading ? (
              <DashboardSkeletonTable rows={5} />
            ) : visiblePriceAlerts.length === 0 ? (
              <EmptyTableMessage message="Nenhum alerta de aumento no recorte atual." />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Produto</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Delta %</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Alerta</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visiblePriceAlerts.map((item) => {
                    const badge = getAlertBadge(item.alert_type);
                    return (
                      <tr key={`${item.supplier_id}-${item.product_id}`} className="bg-white dark:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          <div className="font-medium">{item.product_name}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{item.supplier_name}</div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-rose-600 dark:text-rose-400">{formatPercent(item.delta_pct)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/stock/purchase-documents?supplier_id=${item.supplier_id}&product_id=${item.product_id}`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <FileText className="h-4 w-4" />
                            Documentos
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {filteredPriceAlerts.length > alertsLimit ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAlertsLimit((prev) => prev + 10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Ver mais 10
                </button>
              </div>
            ) : filteredPriceAlerts.length > 10 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setAlertsLimit(10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Recolher
                </button>
              </div>
            ) : null}
          </DashboardTable>

          <DashboardTable
            title="Fornecedores sem compra recente"
            subtitle="Quem merece revisão comercial."
            icon={<BarChart3 className="h-4 w-4" />}
            extraAction={
              <div className="flex items-center gap-2">
                <select
                  value={staleSort}
                  onChange={(e) => setStaleSort(e.target.value as 'days' | 'spent' | 'name')}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                >
                  <option value="days">Mais tempo sem compra</option>
                  <option value="spent">Maior gasto histórico</option>
                  <option value="name">Nome</option>
                </select>
                <button
                  type="button"
                  onClick={exportStaleSuppliersCsv}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </button>
              </div>
            }
          >
            {loading ? (
              <DashboardSkeletonTable rows={5} />
            ) : visibleStaleSuppliers.length === 0 ? (
              <EmptyTableMessage message="Nenhum fornecedor parado no recorte atual." />
            ) : (
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Fornecedor</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Dias</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {visibleStaleSuppliers.map((item) => (
                    <tr key={item.supplier_id} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        <div className="font-medium">{item.supplier_name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{item.confirmed_documents} docs • {item.distinct_products} produtos</div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">{item.days_since_last_purchase ?? '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/suppliers/${item.supplier_id}`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            Ver fornecedor
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/stock/purchase-documents?supplier_id=${item.supplier_id}`)}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                          >
                            <FileText className="h-4 w-4" />
                            Documentos
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {filteredStaleSuppliers.length > staleLimit ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStaleLimit((prev) => prev + 10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Ver mais 10
                </button>
              </div>
            ) : filteredStaleSuppliers.length > 10 ? (
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStaleLimit(10)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Recolher
                </button>
              </div>
            ) : null}
          </DashboardTable>
        </div>
      </div>
    </PageContainer>
  );
}

function DashboardTable({
  title,
  subtitle,
  icon,
  extraAction,
  children,
}: {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  extraAction?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{title}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</div>
        </div>
        <div className="flex items-center gap-2">
          {extraAction}
          {icon ? (
            <div className="rounded-xl bg-gray-100 p-2 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
              {icon}
            </div>
          ) : null}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">{children}</div>
    </div>
  );
}

function EmptyTableMessage({ message }: { message: string }) {
  return <div className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">{message}</div>;
}

function LimitSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-[150px]">
      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-purple-400 dark:border-gray-700 dark:bg-gray-900"
      >
        <option value={5}>5</option>
        <option value={10}>10</option>
        <option value={20}>20</option>
        <option value={50}>50</option>
      </select>
    </div>
  );
}

function DashboardSkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="grid grid-cols-3 gap-4 px-4 py-4">
          <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}
