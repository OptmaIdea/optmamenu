import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Search, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
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
};

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const channelLabels: Record<string, string> = {
  public_store: 'Loja pública', whatsapp: 'WhatsApp', direct: 'Venda direta',
  in_person: 'PDV', phone: 'Telefone', qr_table: 'Mesa/QR', other: 'Outro',
};
const paymentLabels: Record<string, string> = {
  pix: 'PIX', cash: 'Dinheiro', debit_card: 'Cartão de débito',
  credit_card: 'Cartão de crédito', pending: 'A definir',
};
const paymentStatusLabels: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhou', refunded: 'Estornado',
  partially_refunded: 'Estorno parcial', cancelled: 'Cancelado',
};
const pricingLabels: Record<string, string> = {
  pricing_group_combined_volume: 'Grupo de categorias · volume combinado',
  category_combined_volume: 'Categoria · volume combinado',
  category_product_volume: 'Categoria · quantidade do produto',
  category_price_rules: 'Regra da categoria', category_standard: 'Preço da categoria',
  product_volume: 'Regra própria do produto', product_price_rules: 'Regra própria do produto',
  product_standard: 'Preço próprio do produto', product_base_price: 'Preço-base do produto',
  product_price: 'Preço-base do produto', base_price: 'Preço-base do produto',
};

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

export default function SalesPage() {
  const storeId = getActiveStoreId();
  const [sales, setSales] = useState<Sale[]>([]);
  const [itemsBySale, setItemsBySale] = useState<Record<string, SaleItem[]>>({});
  const [discrepancies, setDiscrepancies] = useState<Record<string, DiscrepancySummary>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [payment, setPayment] = useState('all');
  const [period, setPeriod] = useState('30');

  const loadSales = useCallback(async () => {
    if (!storeId) return setLoading(false);
    setLoading(true);
    let query = supabase.from('orders')
      .select('id, order_code, created_at, completed_at, customer_name, status, subtotal, total, sales_channel, payment_method_code, payment_status, commercial_metadata, metadata')
      .eq('store_id', storeId).eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false }).limit(500);
    if (period !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - Number(period));
      query = query.gte('completed_at', from.toISOString());
    }
    const [{ data, error }, discrepancyResult] = await Promise.all([
      query,
      supabase.from('stock_discrepancy_occurrences')
        .select('id, order_id, status, items')
        .eq('store_id', storeId)
        .in('status', ['open', 'under_review', 'waiting_stock_count']),
    ]);
    if (error) {
      toast.error('Não foi possível carregar as vendas.');
      setSales([]);
    } else {
      setSales((data || []).map((row) => ({ ...row, subtotal: Number(row.subtotal || 0), total: Number(row.total || 0) })) as Sale[]);
    }
    if (!discrepancyResult.error) {
      setDiscrepancies(Object.fromEntries((discrepancyResult.data || []).filter((row) => row.order_id).map((row) => [row.order_id as string, row as DiscrepancySummary])));
    }
    setLoading(false);
  }, [period, storeId]);

  useEffect(() => { void loadSales(); }, [loadSales]);

  const visibleSales = useMemo(() => sales.filter((sale) => {
    if (channel !== 'all' && sale.sales_channel !== channel) return false;
    if (payment !== 'all' && sale.payment_method_code !== payment) return false;
    const term = search.trim().toLocaleLowerCase('pt-BR');
    if (!term) return true;
    const metadata = sale.commercial_metadata || sale.metadata || {};
    return `${sale.order_code || ''} ${sale.customer_name || ''} ${textValue(metadata, 'operator_name', 'cashier_name') || ''} ${textValue(metadata, 'location_name', 'stock_location_name') || ''}`
      .toLocaleLowerCase('pt-BR').includes(term);
  }), [sales, search, channel, payment]);

  async function openSale(saleId: string) {
    if (expandedId === saleId) return setExpandedId(null);
    setExpandedId(saleId);
    if (itemsBySale[saleId]) return;
    const { data, error } = await supabase.from('order_items')
      .select('id, quantity, unit_price, discount, product_snapshot, commercial_metadata')
      .eq('order_id', saleId).order('id');
    if (error) return toast.error('Não foi possível carregar os itens desta venda.');
    setItemsBySale((current) => ({ ...current, [saleId]: (data || []).map((item) => ({
      ...item, quantity: Number(item.quantity || 0), unit_price: Number(item.unit_price || 0), discount: Number(item.discount || 0),
    })) as SaleItem[] }));
  }

  return (
    <PageContainer title="Vendas">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#21A896]">Comercial</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-slate-900"><ShoppingBag className="text-[#21A896]" /> Central de Vendas</h1>
            <p className="mt-1 text-slate-500">Vendas concluídas da loja pública, PDV, venda direta e demais canais.</p>
          </div>
          <button type="button" onClick={() => void loadSales()} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold"><RefreshCw size={17} /> Atualizar</button>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 xl:grid-cols-[minmax(280px,1fr)_170px_170px_180px]">
          <label className="relative min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código, cliente, operador ou local" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3" /></label>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3"><option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="all">Todo o período</option></select>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3"><option value="all">Todos os canais</option><option value="public_store">Loja pública</option><option value="in_person">PDV</option><option value="direct">Venda direta</option><option value="whatsapp">WhatsApp</option><option value="phone">Telefone</option><option value="qr_table">Mesa/QR</option></select>
          <select value={payment} onChange={(e) => setPayment(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3"><option value="all">Todos os pagamentos</option><option value="pix">PIX</option><option value="cash">Dinheiro</option><option value="debit_card">Débito</option><option value="credit_card">Crédito</option><option value="pending">A definir</option></select>
        </div>

        {loading ? <div className="flex min-h-56 items-center justify-center rounded-2xl bg-white"><RefreshCw className="animate-spin text-[#21A896]" /></div> : visibleSales.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma venda encontrada.</div> : (
          <div className="space-y-3">{visibleSales.map((sale) => {
            const expanded = expandedId === sale.id;
            const metadata = sale.commercial_metadata || sale.metadata || {};
            const gross = numberValue(metadata, 'gross_subtotal', 'base_subtotal') ?? sale.subtotal ?? sale.total;
            const discount = numberValue(metadata, 'discount_total', 'total_discount') ?? Math.max(gross - sale.total, 0);
            const cashbookCode = textValue(metadata, 'cashbook_entry_code', 'financial_entry_code', 'cashbook_code');
            const discrepancy = discrepancies[sale.id];
            return <article key={sale.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button type="button" onClick={() => void openSale(sale.id)} className="grid w-full gap-3 p-4 text-left sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_110px_190px_110px_105px] xl:items-center">
                <div className="min-w-0 sm:col-span-2 xl:col-span-1"><p className="truncate font-black text-slate-900">{sale.order_code || sale.id.slice(0, 8)}</p><p className="text-xs text-slate-500">{dateTime.format(new Date(sale.completed_at || sale.created_at))} • {sale.customer_name || 'Cliente de balcão'}</p></div>
                <div><p className="text-xs text-slate-500">Canal</p><p className="font-semibold">{label(channelLabels, sale.sales_channel)}</p></div>
                <div><p className="text-xs text-slate-500">Pagamento</p><p className="font-semibold">{label(paymentLabels, sale.payment_method_code)} · {label(paymentStatusLabels, sale.payment_status)}</p></div>
                <div><p className="text-xs text-slate-500">Desconto</p><p className="font-semibold text-[#1A867A]">{currency.format(discount)}</p></div>
                <div className="flex items-center justify-end gap-2"><strong className="whitespace-nowrap text-lg text-[#7B2D8E]">{currency.format(sale.total)}</strong>{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</div>
              </button>
              {expanded && <div className="border-t border-slate-100 bg-slate-50 p-4">
                <div className="space-y-2">{(itemsBySale[sale.id] || []).map((item) => {
                  const snapshot = item.product_snapshot || {};
                  const meta = item.commercial_metadata || {};
                  const basePrice = numberValue(meta, 'base_price', 'original_unit_price') ?? numberValue(snapshot, 'base_price', 'original_unit_price') ?? item.unit_price;
                  const appliedPrice = numberValue(meta, 'applied_price', 'unit_price') ?? numberValue(snapshot, 'applied_unit_price') ?? item.unit_price;
                  const source = textValue(meta, 'pricing_source') || textValue(snapshot, 'pricing_source') || 'base_price';
                  const group = textValue(meta, 'pricing_group_name', 'group_name') || textValue(snapshot, 'pricing_group_name');
                  return <div key={item.id} className="grid gap-3 rounded-xl border border-slate-100 bg-white p-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_70px_120px_120px_220px_120px]">
                    <div><p className="font-bold">{String(snapshot.name || 'Produto')}</p>{group && <p className="text-xs text-slate-500">{group}</p>}</div>
                    <div><p className="text-xs text-slate-500">Qtd.</p><p className="font-semibold">{item.quantity}</p></div>
                    <div><p className="text-xs text-slate-500">Preço-base</p><p className="font-semibold">{currency.format(basePrice)}</p></div>
                    <div><p className="text-xs text-slate-500">Aplicado</p><p className="font-semibold">{currency.format(appliedPrice)}</p></div>
                    <div><p className="text-xs text-slate-500">Origem da regra</p><p className="font-semibold">{label(pricingLabels, source, 'Preço-base do produto')}</p></div>
                    <div><p className="text-xs text-slate-500">Total</p><p className="font-black">{currency.format(item.quantity * appliedPrice - item.discount)}</p><p className="text-[11px] text-slate-400">Bruto {currency.format(item.quantity * basePrice)}</p></div>
                  </div>;
                })}</div>
                <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm md:grid-cols-2 lg:grid-cols-3">
                  <span>Bruto: <strong>{currency.format(gross)}</strong></span><span>Desconto: <strong>{currency.format(discount)}</strong></span><span>Total: <strong>{currency.format(sale.total)}</strong></span>
                  <span>Livro Diário: <strong>{cashbookCode || 'Lançamento integrado'}</strong></span><span>Status da venda: <strong>Concluída</strong></span>
                  <span className={discrepancy ? 'text-amber-700' : ''}>Divergência: <strong>{discrepancy ? 'Pendente de tratamento' : 'Nenhuma'}</strong></span>
                </div>
                {discrepancy && <Link to="/admin/stock/divergences" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-black text-amber-900"><AlertTriangle size={16} /> Tratar divergência <ExternalLink size={14} /></Link>}
              </div>}
            </article>;
          })}</div>
        )}
      </div>
    </PageContainer>
  );
}
