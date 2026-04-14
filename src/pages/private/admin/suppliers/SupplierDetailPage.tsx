import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Eye, Package, Receipt, TrendingUp, Truck } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import PageContainer from '@/components/common/PageContainer';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import AlertBanner from '@/components/common/AlertBanner';
import StatsCard from '@/components/common/StatsCard';
import { supabase } from '@/lib/supabase';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';

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

type SupplierMetrics = {
  totalDocuments: number;
  confirmedDocuments: number;
  totalSpent: number;
  avgTicket: number;
  lastPurchase: string | null;
};

type TopProduct = {
  name: string;
  total_qty: number;
};

type PurchaseDocumentItemRow = {
  product_id: string;
  quantity: number;
};

type ProductRow = {
  id: string;
  name: string;
};

function formatCurrency(value: number | null | undefined) {
  return (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
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

export default function SupplierDetailPage() {
  const navigate = useNavigate();
  const { id: supplierId } = useParams<{ id: string }>();
  const { storeId, loading: storeLoading } = useCurrentStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [documents, setDocuments] = useState<PurchaseDocumentRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | undefined>(undefined);

  const metrics = useMemo<SupplierMetrics>(() => {
    const confirmed = documents.filter((doc) => doc.status === 'confirmed');
    const totalSpent = confirmed.reduce((sum, doc) => sum + (doc.total_amount ?? 0), 0);
    const avgTicket = confirmed.length > 0 ? totalSpent / confirmed.length : 0;
    const lastPurchase =
      confirmed.length > 0
        ? confirmed
          .map((doc) => doc.created_at)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;

    return {
      totalDocuments: documents.length,
      confirmedDocuments: confirmed.length,
      totalSpent,
      avgTicket,
      lastPurchase,
    };
  }, [documents]);

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

      const docs = (documentsRes.data ?? []) as PurchaseDocumentRow[];

      setSupplier(supplierRes.data as Supplier);
      setDocuments(docs);

      const confirmedDocIds = docs
        .filter((doc) => doc.status === 'confirmed')
        .map((doc) => doc.id);

      if (confirmedDocIds.length === 0) {
        setTopProducts([]);
        setLastUpdated(new Date());
        return;
      }

      const { data: itemsData, error: itemsErr } = await supabase
        .from('purchase_document_items')
        .select('product_id, quantity, purchase_document_id')
        .in('purchase_document_id', confirmedDocIds);

      if (itemsErr) throw itemsErr;

      const items = (itemsData ?? []) as Array<
        PurchaseDocumentItemRow & { purchase_document_id: string }
      >;

      const uniqueProductIds = Array.from(new Set(items.map((item) => item.product_id)));

      if (uniqueProductIds.length === 0) {
        setTopProducts([]);
        setLastUpdated(new Date());
        return;
      }

      const { data: productsData, error: productsErr } = await supabase
        .from('products')
        .select('id, name')
        .in('id', uniqueProductIds);

      if (productsErr) throw productsErr;

      const products = (productsData ?? []) as ProductRow[];
      const productMap = new Map(products.map((product) => [product.id, product.name]));

      const productAccumulator = new Map<string, number>();

      items.forEach((item) => {
        const productName = productMap.get(item.product_id) ?? 'Produto';
        productAccumulator.set(
          productName,
          (productAccumulator.get(productName) ?? 0) + Number(item.quantity ?? 0),
        );
      });

      const sortedTopProducts = Array.from(productAccumulator.entries())
        .map(([name, total_qty]) => ({ name, total_qty }))
        .sort((a, b) => b.total_qty - a.total_qty)
        .slice(0, 10);

      setTopProducts(sortedTopProducts);
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

  useEffect(() => {
    void fetchSupplierDetail();
  }, [fetchSupplierDetail]);

  if (storeLoading || loading) {
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
      subtitle="Histórico de compras, documentos e métricas do fornecedor."
      lastUpdated={lastUpdated}
      onRefresh={fetchSupplierDetail}
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
        {error ? <AlertBanner type="error" title="Atenção" message={error} /> : null}

        {supplier ? (
          <div className="rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  Status
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
          <StatsCard title="Documentos" value={metrics.totalDocuments} icon={<Receipt className="h-5 w-5" />} color="blue" />
          <StatsCard title="Confirmados" value={metrics.confirmedDocuments} icon={<CheckCircleIcon className="h-5 w-5" />} color="green" />
          <StatsCard title="Total comprado" value={formatCurrency(metrics.totalSpent)} icon={<Truck className="h-5 w-5" />} color="purple" />
          <StatsCard title="Ticket médio" value={formatCurrency(metrics.avgTicket)} icon={<TrendingUp className="h-5 w-5" />} color="orange" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl bg-white p-6 shadow-sm dark:bg-gray-800">
            <div className="mb-4">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                Documentos do fornecedor
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Histórico completo de drafts, confirmados e cancelados.
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
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusBadge(doc.status)}`}>
                            {doc.status === 'confirmed'
                              ? 'Confirmado'
                              : doc.status === 'cancelled' || doc.status === 'canceled'
                                ? 'Cancelado'
                                : 'Rascunho'}
                          </span>

                          {doc.status === 'cancelled' && doc.cancel_reason ? (
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
                            onClick={() => navigate(`/admin/stock/purchase-documents?open=${doc.id}`)}
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
              Produtos mais comprados
            </div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Baseado apenas em documentos confirmados.
            </div>

            <div className="mt-4 space-y-3">
              {topProducts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Ainda não há itens confirmados para este fornecedor.
                </div>
              ) : (
                topProducts.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                        {index + 1}
                      </div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.name}
                      </div>
                    </div>

                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {item.total_qty}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                <Package className="h-4 w-4" />
                Última compra
              </div>
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {metrics.lastPurchase ? formatDateTime(metrics.lastPurchase) : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
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