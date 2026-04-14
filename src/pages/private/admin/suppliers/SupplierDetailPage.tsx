import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Eye,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Truck,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import AlertBanner from '@/components/common/AlertBanner';
import StatsCard from '@/components/common/StatsCard';
import { supabase } from '@/lib/supabase';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import { useSupplierMetrics } from './hooks/useSupplierMetrics';
import { useSupplierInsights } from './hooks/useSupplierInsights';
import { buildCsv, downloadCsv, formatCsvNumberBR, formatCsvIntegerBR } from '@/utils/csv';

type Supplier = {
  id: string;
  store_id: string;
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  active: boolean;
  created_at: string;
  updated_at?: string | null;
};

type PurchaseDocumentRow = {
  id: string;
  store_id: string;
  supplier_id: string | null;
  status: 'draft' | 'confirmed' | 'cancelled' | 'canceled';
  issue_date: string | null;
  invoice_number: string | null;
  notes: string | null;
  created_at: string;
  total_amount: number | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
};

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

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function statusBadge(status: PurchaseDocumentRow['status']) {
  if (status === 'confirmed') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  }
  if (status === 'cancelled' || status === 'canceled') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';
  }
  return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300';
}

function getSupplierOperationalStatus(lastPurchaseAt: string | null | undefined) {
  if (!lastPurchaseAt) {
    return {
      label: 'Sem compras',
      className:
        'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
    };
  }

  const diffMs = Date.now() - new Date(lastPurchaseAt).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) {
    return {
      label: 'Ativo',
      className:
        'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    };
  }

  if (diffDays <= 90) {
    return {
      label: 'Morno',
      className:
        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    };
  }

  return {
    label: 'Inativo',
    className:
      'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  };
}

function getVariationClass(deltaPct: number | null | undefined) {
  if (deltaPct === null || deltaPct === undefined) {
    return 'text-gray-500 dark:text-gray-400';
  }

  if (deltaPct > 0) {
    return 'text-rose-600 dark:text-rose-400';
  }

  if (deltaPct < 0) {
    return 'text-green-600 dark:text-green-400';
  }

  return 'text-gray-700 dark:text-gray-300';
}

function getRankingBandLabel(band: string | null | undefined) {
  switch (band) {
    case 'leader':
      return 'Líder da loja';
    case 'top_3':
      return 'Top 3';
    case 'top_10':
      return 'Top 10';
    default:
      return 'Base ampla';
  }
}

function getAlertBadge(alertType: string) {
  switch (alertType) {
    case 'high_increase':
      return {
        label: 'Alta forte',
        className: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
      };
    case 'price_up':
      return {
        label: 'Preço subiu',
        className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
      };
    case 'price_down':
      return {
        label: 'Preço caiu',
        className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
      };
    case 'price_stable':
      return {
        label: 'Estável',
        className: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
      };
    default:
      return {
        label: 'Sem histórico',
        className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
      };
  }
}

export default function SupplierDetailPage() {
  const navigate = useNavigate();
  const { id: supplierId } = useParams<{ id: string }>();
  const { storeId, loading: storeLoading } = useCurrentStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [documents, setDocuments] = useState<PurchaseDocumentRow[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);

  const {
    loading: metricsLoading,
    error: metricsError,
    metrics,
    products,
    variations,
    refresh: refreshMetrics,
  } = useSupplierMetrics(storeId ?? undefined, supplierId);

  const {
    loading: insightsLoading,
    error: insightsError,
    ranking,
    alerts,
    refresh: refreshInsights,
  } = useSupplierInsights(storeId ?? undefined, supplierId);

  const exportSupplierDocumentsCsv = useCallback(() => {
    if (!documents.length || !supplier) return;

    const rows = documents.map((doc) => ({
      fornecedor: supplier.name,
      documento_id: doc.id,
      numero_documento: doc.invoice_number?.trim() || doc.id,
      emissao: doc.issue_date ?? '',
      status: doc.status ?? '',
      total: formatCsvNumberBR(doc.total_amount ?? 0),
      criado_em: doc.created_at ?? '',
      cancelado_em: doc.cancelled_at ?? '',
      motivo_cancelamento: doc.cancel_reason ?? '',
      observacoes: doc.notes ?? '',
    }));

    const csv = buildCsv(rows, [
      'fornecedor',
      'documento_id',
      'numero_documento',
      'emissao',
      'status',
      'total',
      'criado_em',
      'cancelado_em',
      'motivo_cancelamento',
      'observacoes',
    ]);

    const safeName = supplier.name.replace(/[^\w\-]+/g, '_');
    downloadCsv(`fornecedor_${safeName}_documentos.csv`, csv);
  }, [documents, supplier]);

  const exportSupplierProductsCsv = useCallback(() => {
    if (!products.length || !supplier) return;

    const rows = products.map((item) => ({
      fornecedor: supplier.name,
      produto_id: item.product_id,
      produto: item.product_name,
      compras: formatCsvIntegerBR(item.purchase_events ?? 0),
      quantidade_total: formatCsvNumberBR(item.total_quantity ?? 0),
      gasto_total: formatCsvNumberBR(item.total_spent ?? 0),
      custo_medio: formatCsvNumberBR(item.avg_unit_cost ?? 0),
      menor_custo: formatCsvNumberBR(item.min_unit_cost ?? 0),
      maior_custo: formatCsvNumberBR(item.max_unit_cost ?? 0),
      primeira_compra: item.first_purchase_at ?? '',
      ultima_compra: item.last_purchase_at ?? '',
    }));

    const csv = buildCsv(rows, [
      'fornecedor',
      'produto_id',
      'produto',
      'compras',
      'quantidade_total',
      'gasto_total',
      'custo_medio',
      'menor_custo',
      'maior_custo',
      'primeira_compra',
      'ultima_compra',
    ]);

    const safeName = supplier.name.replace(/[^\w\-]+/g, '_');
    downloadCsv(`fornecedor_${safeName}_produtos.csv`, csv);
  }, [products, supplier]);

  const exportSupplierPriceAlertsCsv = useCallback(() => {
    if (!variations.length || !supplier) return;

    const alertByProductId = new Map(alerts.map((item) => [item.product_id, item]));

    const rows = variations.map((item) => {
      const alert = alertByProductId.get(item.product_id);

      return {
        fornecedor: supplier.name,
        produto_id: item.product_id,
        produto: item.product_name,
        custo_atual: formatCsvNumberBR(item.current_unit_cost ?? 0),
        custo_anterior:
          item.previous_unit_cost == null ? '' : formatCsvNumberBR(item.previous_unit_cost),
        delta_abs: item.delta_abs == null ? '' : formatCsvNumberBR(item.delta_abs),
        delta_pct: item.delta_pct == null ? '' : formatCsvNumberBR(item.delta_pct),
        data_ultima_compra: item.current_purchase_at ?? '',
        alerta: alert?.alert_type ?? 'no_history',
        melhor_preco:
          alert?.best_unit_cost == null ? '' : formatCsvNumberBR(alert.best_unit_cost),
        melhor_preco_gap_abs:
          alert?.best_price_gap_abs == null ? '' : formatCsvNumberBR(alert.best_price_gap_abs),
        melhor_preco_gap_pct:
          alert?.best_price_gap_pct == null ? '' : formatCsvNumberBR(alert.best_price_gap_pct),
        is_best_price: alert?.is_best_price ? 'sim' : 'nao',
      };
    });

    const csv = buildCsv(rows, [
      'fornecedor',
      'produto_id',
      'produto',
      'custo_atual',
      'custo_anterior',
      'delta_abs',
      'delta_pct',
      'data_ultima_compra',
      'alerta',
      'melhor_preco',
      'melhor_preco_gap_abs',
      'melhor_preco_gap_pct',
      'is_best_price',
    ]);

    const safeName = supplier.name.replace(/[^\w\-]+/g, '_');
    downloadCsv(`fornecedor_${safeName}_variacoes_alertas.csv`, csv);
  }, [variations, alerts, supplier]);

  const fetchSupplierDetail = useCallback(async () => {
    if (!storeId || !supplierId) return;

    setLoading(true);
    setError(null);

    try {
      const [supplierRes, documentsRes] = await Promise.all([
        supabase
          .from('suppliers')
          .select('*')
          .eq('id', supplierId)
          .eq('store_id', storeId)
          .maybeSingle(),

        supabase
          .from('purchase_documents')
          .select(
            'id, store_id, supplier_id, status, issue_date, invoice_number, notes, created_at, total_amount, cancelled_at, cancel_reason',
          )
          .eq('store_id', storeId)
          .eq('supplier_id', supplierId)
          .order('created_at', { ascending: false }),
      ]);

      if (supplierRes.error) throw supplierRes.error;
      if (documentsRes.error) throw documentsRes.error;

      if (!supplierRes.data) {
        throw new Error('Fornecedor não encontrado.');
      }

      setSupplier(supplierRes.data as Supplier);
      setDocuments((documentsRes.data ?? []) as PurchaseDocumentRow[]);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      console.error('Error fetching supplier detail:', e);
      const message =
        e instanceof Error ? e.message : 'Erro ao carregar detalhes do fornecedor';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [storeId, supplierId]);

  const handleRefresh = useCallback(async () => {
    try {
      await Promise.all([
        fetchSupplierDetail(),
        refreshMetrics(),
        refreshInsights(),
      ]);
      setLastUpdated(new Date());
    } catch {
      // erros já tratados
    }
  }, [fetchSupplierDetail, refreshMetrics, refreshInsights]);

  useEffect(() => {
    void fetchSupplierDetail();
  }, [fetchSupplierDetail]);

  const operationalStatus = useMemo(
    () => getSupplierOperationalStatus(metrics?.last_purchase_at),
    [metrics?.last_purchase_at],
  );

  const topProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => Number(b.total_quantity ?? 0) - Number(a.total_quantity ?? 0))
      .slice(0, 10);
  }, [products]);

  const alertByProductId = useMemo(() => {
    return new Map(alerts.map((item) => [item.product_id, item]));
  }, [alerts]);

  if (storeLoading || loading || metricsLoading || insightsLoading) {
    return <LoadingSpinner size="lg" />;
  }

  if (!supplierId) {
    return (
      <PageContainer title="Fornecedor" subtitle="Detalhes do fornecedor">
        <AlertBanner type="error" title="Atenção" message="Fornecedor inválido." />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title={supplier ? `Fornecedor • ${supplier.name}` : 'Fornecedor'}
      subtitle="Histórico de compras, documentos e métricas avançadas do fornecedor."
      lastUpdated={lastUpdated}
      onRefresh={handleRefresh}
      action={
        <button
          onClick={() => navigate('/admin/suppliers')}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      }
    >
      <div className="space-y-6">
        {error || metricsError || insightsError ? (
          <AlertBanner
            type="error"
            title="Atenção"
            message={error || metricsError || insightsError || 'Erro ao carregar fornecedor.'}
          />
        ) : null}

        {supplier ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Documento
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {supplier.document || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Telefone
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {supplier.phone || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    E-mail
                  </div>
                  <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                    {supplier.email || '—'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Status cadastral
                  </div>
                  <div className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${supplier.active
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                        }`}
                    >
                      {supplier.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={exportSupplierDocumentsCsv}
                  disabled={!documents.length}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  CSV documentos
                </button>

                <button
                  type="button"
                  onClick={exportSupplierProductsCsv}
                  disabled={!products.length}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  CSV produtos
                </button>

                <button
                  type="button"
                  onClick={exportSupplierPriceAlertsCsv}
                  disabled={!variations.length}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  CSV alertas/preços
                </button>
              </div>
            </div>

            {supplier.notes ? (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Observações
                </div>
                <div className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                  {supplier.notes}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Documentos"
            value={metrics?.total_documents ?? 0}
            icon={<Receipt className="h-5 w-5" />}
            color="blue"
          />
          <StatsCard
            title="Confirmados"
            value={metrics?.confirmed_documents ?? 0}
            icon={<CheckCircleIcon className="h-5 w-5" />}
            color="green"
          />
          <StatsCard
            title="Total comprado"
            value={formatCurrency(metrics?.total_spent)}
            icon={<Truck className="h-5 w-5" />}
            color="purple"
          />
          <StatsCard
            title="Ticket médio"
            value={formatCurrency(metrics?.avg_ticket)}
            icon={<TrendingUp className="h-5 w-5" />}
            color="orange"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Produtos distintos"
            value={metrics?.distinct_products ?? 0}
            icon={<Package className="h-5 w-5" />}
            color="blue"
          />
          <StatsCard
            title="Quantidade comprada"
            value={formatNumber(metrics?.total_quantity)}
            icon={<ShoppingCart className="h-5 w-5" />}
            color="green"
          />
          <StatsCard
            title="Última compra"
            value={metrics?.last_purchase_at ? formatDateTime(metrics.last_purchase_at) : '—'}
            icon={<TrendingUp className="h-5 w-5" />}
            color="purple"
          />
          <StatsCard
            title="Status operacional"
            value={operationalStatus.label}
            icon={<Truck className="h-5 w-5" />}
            color="orange"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              Ranking do fornecedor
            </div>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">
                  {ranking?.rank_position ? `#${ranking.rank_position}` : '—'}
                </div>
                <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {getRankingBandLabel(ranking?.ranking_band)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Participação
                </div>
                <div className="text-xl font-semibold text-gray-900 dark:text-white">
                  {ranking?.share_pct != null ? `${ranking.share_pct}%` : '—'}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              Alertas de compra
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {alerts.length === 0 ? (
                <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                  Nenhum alerta
                </span>
              ) : (
                alerts.slice(0, 5).map((alert) => {
                  const badge = getAlertBadge(alert.alert_type);
                  return (
                    <span
                      key={`${alert.product_id}-${alert.alert_type}`}
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                    >
                      {alert.product_name} • {badge.label}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                Documentos do fornecedor
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Histórico completo de rascunhos, confirmados e cancelados.
              </div>
            </div>

            {documents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Nenhum documento encontrado para este fornecedor.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/40">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Documento
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Emissão
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Total
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Ações
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="bg-white dark:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          <div className="font-medium">{doc.invoice_number || '—'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Criado em {formatDateTime(doc.created_at)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {formatDate(doc.issue_date)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(
                              doc.status,
                            )}`}
                          >
                            {doc.status === 'confirmed'
                              ? 'Confirmado'
                              : doc.status === 'cancelled' || doc.status === 'canceled'
                                ? 'Cancelado'
                                : 'Rascunho'}
                          </span>

                          {(doc.status === 'cancelled' || doc.status === 'canceled') &&
                            doc.cancel_reason ? (
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Motivo: {doc.cancel_reason}
                            </div>
                          ) : null}
                        </td>

                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(doc.total_amount)}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/stock/purchase-documents?open=${doc.id}`)
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-700"
                            title="Visualizar documento"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              Visão geral do fornecedor
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Resumo consolidado com base nas compras ativas.
            </div>

            <div className="mt-4 space-y-3">
              <MetricRow label="Primeira compra" value={formatDateTime(metrics?.first_purchase_at)} />
              <MetricRow label="Última compra" value={formatDateTime(metrics?.last_purchase_at)} />
              <MetricRow
                label="Produtos distintos"
                value={formatNumber(metrics?.distinct_products)}
              />
              <MetricRow
                label="Quantidade comprada"
                value={formatNumber(metrics?.total_quantity)}
              />
              <MetricRow label="Total gasto" value={formatCurrency(metrics?.total_spent)} />
              <MetricRow label="Ticket médio" value={formatCurrency(metrics?.avg_ticket)} />
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Status operacional
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${operationalStatus.className}`}
                >
                  {operationalStatus.label}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-gray-900 dark:text-white">
                Produtos mais comprados
              </div>
              <div className="mt-3 space-y-3">
                {topProducts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Ainda não há itens confirmados para este fornecedor.
                  </div>
                ) : (
                  topProducts.map((item, index) => (
                    <div
                      key={`${item.product_id}-${index}`}
                      className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {item.product_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.purchase_events} compras
                          </div>
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatNumber(item.total_quantity)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <div className="mb-4">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              Variação de preço por produto
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Comparativo entre o custo atual e o custo anterior por item.
            </div>
          </div>

          {variations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Ainda não há histórico suficiente para calcular variação de preço.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Atual
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Anterior
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Delta
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Variação %
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Alerta
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Melhor preço
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Última compra
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {variations.map((item) => {
                    const alert = alertByProductId.get(item.product_id);
                    const badge = getAlertBadge(alert?.alert_type || 'no_history');

                    return (
                      <tr key={item.product_id} className="bg-white dark:bg-gray-800">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {item.product_name}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-900 dark:text-white">
                          {formatCurrency(item.current_unit_cost)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                          {item.previous_unit_cost === null
                            ? '—'
                            : formatCurrency(item.previous_unit_cost)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-semibold ${getVariationClass(
                            item.delta_pct,
                          )}`}
                        >
                          {item.delta_abs === null ? '—' : formatCurrency(item.delta_abs)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right text-sm font-semibold ${getVariationClass(
                            item.delta_pct,
                          )}`}
                        >
                          {formatPercent(item.delta_pct)}
                        </td>
                        <td className="px-4 py-3 text-left">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                          {alert?.is_best_price
                            ? 'Sim'
                            : alert?.best_unit_cost != null
                              ? formatCurrency(alert.best_unit_cost)
                              : '—'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                          {formatDateTime(item.current_purchase_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
          <div className="mb-4">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              Produtos fornecidos
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Histórico consolidado por produto com volume, gasto e custo.
            </div>
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
              Ainda não há produtos ativos vinculados a este fornecedor.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900/40">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Produto
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Compras
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Quantidade
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Gasto total
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Custo médio
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Menor custo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Maior custo
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Última compra
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {products.map((item) => (
                    <tr key={item.product_id} className="bg-white dark:bg-gray-800">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {item.product_name}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                        {formatNumber(item.purchase_events)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                        {formatNumber(item.total_quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(item.total_spent)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.avg_unit_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.min_unit_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                        {formatCurrency(item.max_unit_cost)}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-700 dark:text-gray-300">
                        {formatDateTime(item.last_purchase_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-sm font-semibold text-gray-900 dark:text-white">{value}</div>
    </div>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
