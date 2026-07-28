import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, ReceiptText, RefreshCw, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PdvLayout from '@/components/layouts/PdvLayout';
import { supabase } from '@/lib/supabase';
import { getPosBootstrap } from '@/services/pdvService';
import type { PosBootstrap } from '@/types/pdv';
import { getActiveStoreId } from '@/utils/activeStore';
import { usePermissions } from '@/hooks/usePermissions';
import { hasOnlyPdvOperationalAccess } from '@/utils/permissions';

type SaleRow = {
  id: string;
  order_code: string | null;
  created_at: string;
  completed_at: string | null;
  customer_name: string | null;
  status: string;
  subtotal: number;
  total: number;
  sales_channel: string;
  payment_method_code: string | null;
  payment_status: string | null;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
  commercial_metadata: Record<string, unknown> | null;
};

type SaleItem = {
  id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  product_snapshot: Record<string, unknown> | null;
  commercial_metadata: Record<string, unknown> | null;
};

type CashbookEntry = {
  id: string;
  amount: number;
  occurred_at: string | null;
  created_at: string;
  description: string | null;
  payment_method_code: string | null;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function paymentLabel(code?: string | null): string {
  switch (code) {
    case 'pix':
      return 'PIX';
    case 'cash':
      return 'Dinheiro';
    case 'debit_card':
      return 'Cartão de débito';
    case 'credit_card':
      return 'Cartão de crédito';
    default:
      return code || 'Pendente';
  }
}

function pricingSourceLabel(metadata?: Record<string, unknown> | null): string {
  if (!metadata || (!metadata.pricing_source && !metadata.source)) {
    return 'Origem não registrada';
  }
  const source = String(metadata.pricing_source || metadata.source || '');
  const groupName = metadata.pricing_group_name || metadata.pricing_group_name_snapshot;
  const quantity = metadata.pricing_quantity || metadata.applied_tier_min_quantity || metadata.quantity;

  if (source === 'pricing_group_combined_volume') {
    return `Grupo ${groupName || 'de preços'} • ${quantity || 0} un. combinadas`;
  }
  if (source === 'category_combined_volume') {
    return `Categoria • ${quantity || 0} un. combinadas`;
  }
  if (source === 'category_per_product_volume') {
    return `Categoria • ${quantity || 0} un. do produto`;
  }
  if (source === 'product_volume') {
    return `Faixa do produto • ${quantity || 0} un.`;
  }
  if (source === 'category_standard') return 'Preço da categoria';
  if (source === 'product_base_price' || source === 'product_standard') return 'Preço do produto';
  return 'Origem não registrada';
}

export default function PdvSalesHistoryPage() {
  const navigate = useNavigate();
  const storeId = getActiveStoreId();
  const { permissions } = usePermissions(storeId);
  const [bootstrap, setBootstrap] = useState<PosBootstrap | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, SaleItem[]>>({});
  const [cashbookByOrder, setCashbookByOrder] = useState<Record<string, CashbookEntry | null>>({});
  const [online, setOnline] = useState(() => navigator.onLine);

  const load = useCallback(async () => {
    if (!storeId) return;
    setRefreshing(!loading);

    try {
      const [bootstrapData, salesResult] = await Promise.all([
        getPosBootstrap(storeId),
        supabase
          .from('orders')
          .select(
            'id, order_code, created_at, completed_at, customer_name, status, subtotal, total, sales_channel, payment_method_code, payment_status, user_id, metadata, commercial_metadata'
          )
          .eq('store_id', storeId)
          .eq('status', 'completed')
          .in('sales_channel', ['direct', 'in_person'])
          .order('completed_at', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(150),
      ]);

      if (salesResult.error) throw salesResult.error;
      setBootstrap(bootstrapData);
      setSales(
        (salesResult.data || []).map((sale) => ({
          ...sale,
          subtotal: Number(sale.subtotal || 0),
          total: Number(sale.total || 0),
        })) as SaleRow[]
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar as vendas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [storeId, loading]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const filteredSales = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return sales;
    return sales.filter((sale) =>
      `${sale.order_code || ''} ${sale.customer_name || ''} ${paymentLabel(sale.payment_method_code)}`
        .toLocaleLowerCase('pt-BR')
        .includes(normalized)
    );
  }, [sales, search]);

  const openSale = async (saleId: string) => {
    if (expandedId === saleId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(saleId);
    if (itemsByOrder[saleId]) return;

    const [itemsResult, cashbookResult] = await Promise.all([
      supabase
        .from('order_items')
        .select('id, quantity, unit_price, discount, product_snapshot, commercial_metadata')
        .eq('order_id', saleId)
        .order('id'),
      supabase
        .from('cashbook_entries')
        .select('id, amount, occurred_at, created_at, description, payment_method_code')
        .eq('order_id', saleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (itemsResult.error) {
      toast.error('Não foi possível carregar os itens da venda.');
      return;
    }

    setItemsByOrder((current) => ({
      ...current,
      [saleId]: (itemsResult.data || []).map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        discount: Number(item.discount || 0),
      })) as SaleItem[],
    }));
    setCashbookByOrder((current) => ({
      ...current,
      [saleId]: cashbookResult.error
        ? null
        : cashbookResult.data
          ? ({
              ...cashbookResult.data,
              amount: Number(cashbookResult.data.amount || 0),
            } as CashbookEntry)
          : null,
    }));
  };

  const selectedLocation = bootstrap?.locations.find(
    (location) => location.id === bootstrap.selected_location_id
  );
  const showAdminExit = !hasOnlyPdvOperationalAccess(permissions);

  return (
    <PdvLayout
      storeName={bootstrap?.store.name}
      operatorName={bootstrap?.operator.name}
      operatorAvatarUrl={bootstrap?.operator.avatar_url}
      locationName={selectedLocation?.name}
      online={online}
      showAdminExit={showAdminExit}
      hideSalesHistory
    >
      <div className="mx-auto max-w-6xl space-y-4 p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/admin/pdv')}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#6B6258]/15 bg-white dark:border-gray-700 dark:bg-gray-900"
              aria-label="Voltar ao PDV"
            >
              <ArrowLeft size={19} />
            </button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-black sm:text-2xl">
                <ReceiptText className="text-[#7B2D8E]" /> Vendas realizadas
              </h1>
              <p className="text-sm text-[#6B6258] dark:text-gray-400">
                Consulte valores, descontos, itens e lançamento financeiro.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={refreshing}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-[#6B6258]/15 bg-white px-4 text-sm font-bold dark:border-gray-700 dark:bg-gray-900"
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </div>

        <label className="relative block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6258]" size={19} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por código, cliente ou pagamento"
            className="h-12 w-full rounded-xl border border-[#6B6258]/15 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#21A896] dark:border-gray-700 dark:bg-gray-900"
          />
        </label>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-2xl bg-white dark:bg-gray-900">
            <RefreshCw className="animate-spin text-[#21A896]" size={32} />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#6B6258]/20 bg-white p-10 text-center dark:bg-gray-900">
            <p className="font-bold">Nenhuma venda encontrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSales.map((sale) => {
              const expanded = expandedId === sale.id;
              const metadata = sale.commercial_metadata || sale.metadata || {};
              const grossSubtotal = Number(metadata.gross_subtotal || sale.subtotal || sale.total);
              const discountTotal = Number(metadata.discount_total || Math.max(grossSubtotal - sale.total, 0));
              const items = itemsByOrder[sale.id] || [];
              const cashbook = cashbookByOrder[sale.id];

              return (
                <article
                  key={sale.id}
                  className="overflow-hidden rounded-2xl border border-[#6B6258]/10 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
                >
                  <button
                    type="button"
                    onClick={() => void openSale(sale.id)}
                    className="grid w-full gap-3 p-4 text-left sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-black">{sale.order_code || sale.id.slice(0, 8)}</p>
                      <p className="text-xs text-[#6B6258] dark:text-gray-400">
                        {formatDateTime(sale.completed_at || sale.created_at)} • {sale.customer_name || 'Cliente de balcão'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B6258]">Pagamento</p>
                      <p className="text-sm font-bold">{paymentLabel(sale.payment_method_code)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B6258]">Desconto</p>
                      <p className="text-sm font-bold text-[#1A867A]">{formatCurrency(discountTotal)}</p>
                    </div>
                    <div className="flex items-center justify-between gap-4 sm:justify-end">
                      <div>
                        <p className="text-xs text-[#6B6258]">Total</p>
                        <p className="text-lg font-black text-[#7B2D8E]">{formatCurrency(sale.total)}</p>
                      </div>
                      {expanded ? <ChevronUp /> : <ChevronDown />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-[#6B6258]/10 p-4 dark:border-gray-800">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl bg-[#F8F6F2] p-3 dark:bg-gray-950">
                          <p className="text-xs text-[#6B6258]">Valor sem desconto</p>
                          <p className="font-black">{formatCurrency(grossSubtotal)}</p>
                        </div>
                        <div className="rounded-xl bg-[#21A896]/10 p-3">
                          <p className="text-xs text-[#1A867A]">Desconto aplicado</p>
                          <p className="font-black text-[#1A867A]">{formatCurrency(discountTotal)}</p>
                        </div>
                        <div className="rounded-xl bg-[#7B2D8E]/10 p-3">
                          <p className="text-xs text-[#7B2D8E]">Status financeiro</p>
                          <p className="font-black text-[#7B2D8E]">
                            {sale.payment_status === 'paid' ? 'Pago' : sale.payment_status || 'Pendente'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        <h2 className="font-black">Itens</h2>
                        {items.length === 0 ? (
                          <p className="text-sm text-[#6B6258]">Carregando itens...</p>
                        ) : (
                          items.map((item) => {
                            const snapshot = item.product_snapshot || {};
                            const itemMetadata = item.commercial_metadata || {};
                            const originalUnitPrice = Number(itemMetadata.original_unit_price || item.unit_price);
                            const lineTotal = Number(itemMetadata.line_total || item.quantity * item.unit_price - item.discount);
                            return (
                              <div
                                key={item.id}
                                className="grid gap-2 rounded-xl border border-[#6B6258]/10 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center dark:border-gray-800"
                              >
                                <div>
                                  <p className="font-bold">
                                    {item.quantity}× {String(snapshot.name || 'Produto')}
                                  </p>
                                  <p className="text-xs text-[#6B6258] dark:text-gray-400">
                                    {pricingSourceLabel(itemMetadata)}
                                  </p>
                                </div>
                                <div className="text-sm">
                                  <p>{formatCurrency(item.unit_price)}/un.</p>
                                  {originalUnitPrice > item.unit_price && (
                                    <p className="text-xs text-[#6B6258] line-through">
                                      {formatCurrency(originalUnitPrice)}/un.
                                    </p>
                                  )}
                                </div>
                                <p className="font-black">{formatCurrency(lineTotal)}</p>
                              </div>
                            );
                          })
                        )}
                      </div>

                      <div className="mt-4 rounded-xl border border-[#6B6258]/10 p-3 dark:border-gray-800">
                        <p className="text-xs text-[#6B6258]">Livro Diário</p>
                        {cashbook ? (
                          <p className="font-bold">
                            {formatCurrency(cashbook.amount)} • {formatDateTime(cashbook.occurred_at || cashbook.created_at)}
                          </p>
                        ) : (
                          <p className="font-bold text-[#DC2626]">Lançamento não localizado</p>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </PdvLayout>
  );
}
