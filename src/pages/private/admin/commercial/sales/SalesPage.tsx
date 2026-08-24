import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import DateRangeFilter, { getPeriodDates } from '@/components/common/DateRangeFilter';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';

type JsonRecord = Record<string, unknown>;
type Sale = {
  id: string;
  order_code: string | null;
  created_at: string;
  completed_at: string | null;
  customer_name: string | null;
  status: string;
  subtotal: number;
  total: number;
  sales_channel: string | null;
  payment_method_code: string | null;
  payment_status: string | null;
  commercial_metadata: JsonRecord | null;
  metadata: JsonRecord | null;
};
type SaleItem = {
  id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  product_snapshot: JsonRecord | null;
  commercial_metadata: JsonRecord | null;
};
type DiscrepancySummary = {
  id: string;
  order_id: string | null;
  status: string;
  items: unknown;
  resolved_at?: string | null;
  updated_at?: string | null;
};
type DiscrepancyFilter = 'all' | 'pending' | 'resolved' | 'none';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const channelLabels: Record<string, string> = {
  public_store: 'Loja pública',
  whatsapp: 'WhatsApp',
  direct: 'Venda direta',
  in_person: 'PDV',
  pdv: 'PDV',
  phone: 'Telefone',
  qr_table: 'Mesa / QR',
  other: 'Outro',
};
const paymentLabels: Record<string, string> = {
  pix: 'PIX',
  cash: 'Dinheiro',
  card: 'Cartão',
  debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito',
  bank_transfer: 'Transferência bancária',
  voucher: 'Voucher / benefício',
  pending: 'A definir',
};
const paymentStatusLabels: Record<string, string> = {
  paid: 'Pago',
  pending: 'Pendente',
  failed: 'Falhou',
  refund_pending: 'Estorno pendente',
  refunded: 'Estornado',
  partially_refunded: 'Estorno parcial',
};
const pricingLabels: Record<string, string> = {
  pricing_group_combined_volume: 'Grupo de categorias · volume combinado',
  category_combined_volume: 'Categoria · volume combinado',
  category_product_volume: 'Categoria · quantidade do produto',
  category_per_product_volume: 'Categoria · quantidade do produto',
  category_price_rules: 'Regra da categoria',
  category_standard: 'Preço da categoria',
  product_volume: 'Regra própria do produto',
  product_price_rules: 'Regra própria do produto',
  product_standard: 'Preço próprio do produto',
  product_base_price: 'Preço-base do produto',
  product_price: 'Preço-base do produto',
  base_price: 'Preço-base do produto',
};
const discrepancyLabels: Record<string, string> = {
  open: 'Divergência aberta',
  under_review: 'Divergência em análise',
  waiting_stock_count: 'Aguardando contagem física',
  resolved: 'Divergência resolvida',
  cancelled: 'Divergência cancelada',
};
const discrepancyClasses: Record<string, string> = {
  open: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
  under_review: 'border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
  waiting_stock_count: 'border-violet-200 bg-violet-100 text-violet-900 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
};
const pendingDiscrepancyStatuses = new Set(['open', 'under_review', 'waiting_stock_count']);

function label(map: Record<string, string>, value?: string | null, fallback = 'Não informado') {
  return map[value || ''] || value || fallback;
}

function textValue(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function numberValue(record: JsonRecord, ...keys: string[]) {
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function fallbackPaymentLabel(code?: string | null) {
  if (!code) return 'Não informado';
  if (paymentLabels[code]) return paymentLabels[code];

  const lower = code.toLowerCase();
  const provider = lower
    .replace(/^debit_card_/, '')
    .replace(/^credit_card_/, '')
    .replace(/^pix_/, '')
    .replace(/^debito_/, '')
    .replace(/^credito_/, '')
    .replaceAll('_', ' ')
    .trim();
  const providerLabel = provider
    ? provider.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : '';

  if (lower.startsWith('debit_card_')) return `Cartão de débito${providerLabel ? ` · ${providerLabel}` : ''}`;
  if (lower.startsWith('credit_card_')) return `Cartão de crédito${providerLabel ? ` · ${providerLabel}` : ''}`;
  if (lower.startsWith('pix_')) return `PIX${providerLabel ? ` · ${providerLabel}` : ''}`;
  return code.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SalesPage() {
  const storeId = getActiveStoreId();
  const initialDates = getPeriodDates('last_30_days');
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemsBySale, setItemsBySale] = useState<Record<string, SaleItem[]>>({});
  const [discrepancies, setDiscrepancies] = useState<Record<string, DiscrepancySummary[]>>({});
  const [paymentMethodNames, setPaymentMethodNames] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [payment, setPayment] = useState('all');
  const [discrepancyFilter, setDiscrepancyFilter] = useState<DiscrepancyFilter>('all');
  const [periodFilter, setPeriodFilter] = useState('last_30_days');
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);

  const loadSales = useCallback(async () => {
    if (!storeId) return setLoading(false);
    setLoading(true);

    let query = supabase
      .from('orders')
      .select('id, order_code, created_at, completed_at, customer_name, status, subtotal, total, sales_channel, payment_method_code, payment_status, commercial_metadata, metadata')
      .eq('store_id', storeId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(500);

    if (startDate) query = query.gte('completed_at', `${startDate}T00:00:00`);
    if (endDate) query = query.lte('completed_at', `${endDate}T23:59:59.999`);

    const [{ data, error }, discrepancyResult, paymentMethodResult] = await Promise.all([
      query,
      supabase
        .from('stock_discrepancy_occurrences')
        .select('id, order_id, status, items, resolved_at, updated_at')
        .eq('store_id', storeId),
      supabase
        .from('store_payment_methods')
        .select('code, name')
        .eq('store_id', storeId),
    ]);

    if (error) {
      toast.error('Não foi possível carregar as vendas.');
      setSales([]);
    } else {
      setSales((data || []).map((row) => ({
        ...row,
        subtotal: Number(row.subtotal || 0),
        total: Number(row.total || 0),
      })) as Sale[]);
    }

    if (!discrepancyResult.error) {
      const grouped: Record<string, DiscrepancySummary[]> = {};
      for (const row of discrepancyResult.data || []) {
        if (!row.order_id) continue;
        grouped[row.order_id] = [...(grouped[row.order_id] || []), row as DiscrepancySummary];
      }
      setDiscrepancies(grouped);
    }

    if (!paymentMethodResult.error) {
      setPaymentMethodNames(Object.fromEntries((paymentMethodResult.data || []).map((method) => [method.code, method.name])));
    }

    setLoading(false);
  }, [endDate, startDate, storeId]);

  useEffect(() => { void loadSales(); }, [loadSales]);

  const paymentName = useCallback((code?: string | null) => {
    if (!code) return 'Não informado';
    return paymentMethodNames[code] || fallbackPaymentLabel(code);
  }, [paymentMethodNames]);

  const saleDiscrepancyState = useCallback((saleId: string) => {
    const list = discrepancies[saleId] || [];
    const pending = list.find((item) => pendingDiscrepancyStatuses.has(item.status));
    const resolved = !pending && list.find((item) => item.status === 'resolved');
    return { list, pending, resolved };
  }, [discrepancies]);

  const paymentOptions = useMemo(() => {
    const codes = new Set<string>();
    sales.forEach((sale) => { if (sale.payment_method_code) codes.add(sale.payment_method_code); });
    Object.keys(paymentMethodNames).forEach((code) => codes.add(code));
    return Array.from(codes)
      .filter((code) => code !== 'pending')
      .sort((left, right) => paymentName(left).localeCompare(paymentName(right), 'pt-BR'));
  }, [paymentMethodNames, paymentName, sales]);

  const visibleSales = useMemo(() => sales.filter((sale) => {
    if (channel !== 'all' && sale.sales_channel !== channel) return false;
    if (payment !== 'all' && sale.payment_method_code !== payment) return false;

    const discrepancy = saleDiscrepancyState(sale.id);
    if (discrepancyFilter === 'pending' && !discrepancy.pending) return false;
    if (discrepancyFilter === 'resolved' && !discrepancy.resolved) return false;
    if (discrepancyFilter === 'none' && discrepancy.list.length > 0) return false;

    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return true;
    const metadata = sale.commercial_metadata || sale.metadata || {};
    return `${sale.order_code || ''} ${sale.customer_name || ''} ${textValue(metadata, 'operator_name', 'cashier_name') || ''} ${textValue(metadata, 'location_name', 'stock_location_name') || ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(term);
  }), [channel, discrepancyFilter, payment, saleDiscrepancyState, sales, search]);

  async function openSale(saleId: string) {
    if (expandedId === saleId) return setExpandedId(null);
    setExpandedId(saleId);
    if (itemsBySale[saleId]) return;

    const { data, error } = await supabase
      .from('order_items')
      .select('id, quantity, unit_price, discount, product_snapshot, commercial_metadata')
      .eq('order_id', saleId)
      .order('id');

    if (error) return toast.error('Não foi possível carregar os itens desta venda.');
    setItemsBySale((current) => ({
      ...current,
      [saleId]: (data || []).map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        discount: Number(item.discount || 0),
      })) as SaleItem[],
    }));
  }

  return (
    <PageContainer title="Vendas" withoutHeader>
      <div className="space-y-5 text-slate-900 dark:text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-600 dark:text-teal-300">Comercial</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-slate-900 dark:text-white">
              <ShoppingBag className="text-teal-600 dark:text-teal-300" /> Central de Vendas
            </h1>
            <p className="mt-1 text-slate-500 dark:text-slate-400">Vendas concluídas da loja pública, PDV, venda direta e demais canais.</p>
          </div>
          <button type="button" onClick={() => void loadSales()} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <RefreshCw size={17} /> Atualizar
          </button>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <DateRangeFilter
            periodFilter={periodFilter}
            onPeriodChange={setPeriodFilter}
            startDate={startDate}
            onStartDateChange={setStartDate}
            endDate={endDate}
            onEndDateChange={setEndDate}
          />
          <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_220px_220px]">
            <label className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, cliente, operador ou local" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-slate-900 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
            </label>
            <select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <option value="all">Todos os canais</option>
              <option value="public_store">Loja pública</option>
              <option value="in_person">PDV</option>
              <option value="direct">Venda direta</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="phone">Telefone</option>
              <option value="qr_table">Mesa / QR</option>
            </select>
            <select value={payment} onChange={(event) => setPayment(event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <option value="all">Todos os pagamentos</option>
              <option value="pending">A definir</option>
              {paymentOptions.map((code) => <option key={code} value={code}>{paymentName(code)}</option>)}
            </select>
            <select value={discrepancyFilter} onChange={(event) => setDiscrepancyFilter(event.target.value as DiscrepancyFilter)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
              <option value="all">Todas as vendas</option>
              <option value="pending">Com divergência pendente</option>
              <option value="resolved">Divergência já resolvida</option>
              <option value="none">Sem divergência registrada</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center rounded-2xl bg-white dark:bg-slate-900"><RefreshCw className="animate-spin text-teal-600" /></div>
        ) : visibleSales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">Nenhuma venda encontrada.</div>
        ) : (
          <div className="space-y-3">{visibleSales.map((sale) => {
            const expanded = expandedId === sale.id;
            const metadata = sale.commercial_metadata || sale.metadata || {};
            const gross = numberValue(metadata, 'gross_subtotal', 'base_subtotal') ?? sale.subtotal ?? sale.total;
            const discount = numberValue(metadata, 'discount_total', 'total_discount') ?? Math.max(gross - sale.total, 0);
            const cashbookCode = textValue(metadata, 'cashbook_entry_code', 'financial_entry_code', 'cashbook_code');
            const discrepancy = saleDiscrepancyState(sale.id);
            const paymentPending = sale.payment_status === 'pending' || sale.payment_method_code === 'pending';
            const saleAdjustmentStatus = textValue(metadata, 'sale_adjustment_status');

            return (
              <article key={sale.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <button type="button" onClick={() => void openSale(sale.id)} className="grid w-full gap-3 p-4 text-left sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_120px_220px_120px_115px] xl:items-center">
                  <div className="min-w-0 sm:col-span-2 xl:col-span-1">
                    <p className="truncate font-black text-slate-900 dark:text-white">{sale.order_code || sale.id.slice(0, 8)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{dateTime.format(new Date(sale.completed_at || sale.created_at))} • {sale.customer_name || 'Cliente de balcão'}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {discrepancy.pending && <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-black ${discrepancyClasses[discrepancy.pending.status] || discrepancyClasses.open}`}><AlertTriangle size={12} /> {discrepancyLabels[discrepancy.pending.status] || 'Divergência pendente'}</span>}
                      {!discrepancy.pending && discrepancy.resolved && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"><CheckCircle2 size={12} /> Divergência resolvida</span>}
                      {paymentPending && <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-900 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-200">Pagamento pendente</span>}
                      {saleAdjustmentStatus === 'cancelled_after_completion' && <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-black text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">Cancelada após conclusão</span>}
                      {saleAdjustmentStatus === 'partially_returned' && <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">Devolução parcial</span>}
                    </div>
                  </div>
                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Canal</p><p className="font-semibold text-slate-900 dark:text-slate-100">{label(channelLabels, sale.sales_channel)}</p></div>
                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Pagamento</p><p className="break-words font-semibold text-slate-900 dark:text-slate-100">{paymentName(sale.payment_method_code)} · {label(paymentStatusLabels, sale.payment_status)}</p></div>
                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Desconto</p><p className="font-semibold text-teal-700 dark:text-teal-300">{currency.format(discount)}</p></div>
                  <div className="flex items-center justify-end gap-2"><strong className="whitespace-nowrap text-lg text-purple-700 dark:text-purple-300">{currency.format(sale.total)}</strong>{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
                </button>

                {expanded && <div className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="space-y-2">{(itemsBySale[sale.id] || []).map((item) => {
                    const snapshot = item.product_snapshot || {};
                    const meta = item.commercial_metadata || {};
                    const basePrice = numberValue(meta, 'base_price', 'original_unit_price') ?? numberValue(snapshot, 'base_price', 'original_unit_price') ?? item.unit_price;
                    const appliedPrice = numberValue(meta, 'applied_price', 'unit_price') ?? numberValue(snapshot, 'applied_unit_price') ?? item.unit_price;
                    const source = textValue(meta, 'pricing_source') || textValue(snapshot, 'pricing_source') || 'base_price';
                    const group = textValue(meta, 'pricing_group_name', 'group_name') || textValue(snapshot, 'pricing_group_name');
                    return <div key={item.id} className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_70px_120px_120px_220px_120px]">
                      <div><p className="font-bold text-slate-900 dark:text-white">{String(snapshot.name || 'Produto')}</p>{group && <p className="text-xs text-slate-500 dark:text-slate-400">{group}</p>}</div>
                      <div><p className="text-xs text-slate-500 dark:text-slate-400">Qtd.</p><p className="font-semibold">{item.quantity}</p></div>
                      <div><p className="text-xs text-slate-500 dark:text-slate-400">Preço-base</p><p className="font-semibold">{currency.format(basePrice)}</p></div>
                      <div><p className="text-xs text-slate-500 dark:text-slate-400">Aplicado</p><p className="font-semibold">{currency.format(appliedPrice)}</p></div>
                      <div><p className="text-xs text-slate-500 dark:text-slate-400">Origem da regra</p><p className="font-semibold">{label(pricingLabels, source, 'Preço-base do produto')}</p></div>
                      <div><p className="text-xs text-slate-500 dark:text-slate-400">Total</p><p className="font-black">{currency.format(item.quantity * appliedPrice - item.discount)}</p><p className="text-[11px] text-slate-400">Bruto {currency.format(item.quantity * basePrice)}</p></div>
                    </div>;
                  })}</div>
                  <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800 md:grid-cols-2 lg:grid-cols-3">
                    <span>Bruto: <strong>{currency.format(gross)}</strong></span>
                    <span>Desconto: <strong>{currency.format(discount)}</strong></span>
                    <span>Total: <strong>{currency.format(sale.total)}</strong></span>
                    <span>Livro Diário: <strong>{cashbookCode || 'Lançamento integrado'}</strong></span>
                    <span>Status da venda: <strong>Concluída</strong></span>
                    <span className={discrepancy.pending ? 'text-amber-700 dark:text-amber-300' : ''}>Divergência: <strong>{discrepancy.pending ? discrepancyLabels[discrepancy.pending.status] || 'Pendente' : discrepancy.resolved ? 'Resolvida' : 'Nenhuma'}</strong></span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/admin/sales/${sale.id}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white">Abrir detalhe completo <ExternalLink size={14} /></Link>
                    {discrepancy.pending && <Link to={`/admin/stock/divergences?orderId=${sale.id}&status=all&returnTo=${encodeURIComponent('/admin/sales')}`} className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"><AlertTriangle size={16} /> Tratar divergência <ExternalLink size={14} /></Link>}
                  </div>
                </div>}
              </article>
            );
          })}</div>
        )}
      </div>
    </PageContainer>
  );
}
