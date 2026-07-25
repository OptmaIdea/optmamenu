import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Search, ShoppingBag } from 'lucide-react';
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
  fulfillment_type: string | null;
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

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function channelLabel(channel?: string | null) {
  const labels: Record<string, string> = {
    public_store: 'Loja pública',
    whatsapp: 'WhatsApp',
    direct: 'Venda direta',
    in_person: 'PDV',
    phone: 'Telefone',
    qr_table: 'Mesa/QR',
    other: 'Outro',
  };
  return labels[channel || ''] || channel || 'Não informado';
}

function paymentLabel(code?: string | null) {
  const labels: Record<string, string> = {
    pix: 'PIX',
    cash: 'Dinheiro',
    debit_card: 'Cartão de débito',
    credit_card: 'Cartão de crédito',
    pending: 'Pendente',
  };
  return labels[code || ''] || code || 'Não informado';
}

function textValue(record: JsonRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function numberValue(record: JsonRecord, ...keys: string[]): number | null {
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [payment, setPayment] = useState('all');
  const [period, setPeriod] = useState('30');

  const loadSales = useCallback(async () => {
    if (!storeId) {
      setSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let query = supabase
      .from('orders')
      .select('id, order_code, created_at, completed_at, customer_name, status, subtotal, total, sales_channel, fulfillment_type, payment_method_code, payment_status, commercial_metadata, metadata')
      .eq('store_id', storeId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(500);

    if (period !== 'all') {
      const from = new Date();
      from.setDate(from.getDate() - Number(period));
      query = query.gte('completed_at', from.toISOString());
    }

    const { data, error } = await query;

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
    setLoading(false);
  }, [period, storeId]);

  useEffect(() => {
    void loadSales();
  }, [loadSales]);

  const visibleSales = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return sales.filter((sale) => {
      if (channel !== 'all' && sale.sales_channel !== channel) return false;
      if (payment !== 'all' && sale.payment_method_code !== payment) return false;
      if (!term) return true;
      const metadata = sale.commercial_metadata || sale.metadata || {};
      const operator = textValue(metadata, 'operator_name', 'cashier_name', 'created_by_name') || '';
      const location = textValue(metadata, 'location_name', 'stock_location_name') || '';
      return `${sale.order_code || ''} ${sale.customer_name || ''} ${operator} ${location} ${channelLabel(sale.sales_channel)} ${paymentLabel(sale.payment_method_code)}`
        .toLocaleLowerCase('pt-BR')
        .includes(term);
    });
  }, [sales, search, channel, payment]);

  const openSale = async (saleId: string) => {
    if (expandedId === saleId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(saleId);
    if (itemsBySale[saleId]) return;

    const { data, error } = await supabase
      .from('order_items')
      .select('id, quantity, unit_price, discount, product_snapshot, commercial_metadata')
      .eq('order_id', saleId)
      .order('id');

    if (error) {
      toast.error('Não foi possível carregar os itens desta venda.');
      return;
    }

    setItemsBySale((current) => ({
      ...current,
      [saleId]: (data || []).map((item) => ({
        ...item,
        quantity: Number(item.quantity || 0),
        unit_price: Number(item.unit_price || 0),
        discount: Number(item.discount || 0),
      })) as SaleItem[],
    }));
  };

  return (
    <PageContainer title="Vendas">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#21A896]">Comercial</p>
            <h1 className="mt-1 flex items-center gap-2 text-3xl font-black text-slate-900">
              <ShoppingBag className="text-[#21A896]" /> Central de Vendas
            </h1>
            <p className="mt-1 text-slate-500">Vendas concluídas da loja pública, PDV, venda direta e demais canais.</p>
          </div>
          <button type="button" onClick={() => void loadSales()} className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold">
            <RefreshCw size={17} /> Atualizar
          </button>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_180px_180px_170px]">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código, cliente, operador ou local" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 outline-none focus:border-[#21A896]" />
          </label>
          <select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="all">Todo o período</option>
          </select>
          <select value={channel} onChange={(event) => setChannel(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="all">Todos os canais</option>
            <option value="public_store">Loja pública</option>
            <option value="in_person">PDV</option>
            <option value="direct">Venda direta</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Telefone</option>
            <option value="qr_table">Mesa/QR</option>
          </select>
          <select value={payment} onChange={(event) => setPayment(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3">
            <option value="all">Todos os pagamentos</option>
            <option value="pix">PIX</option>
            <option value="cash">Dinheiro</option>
            <option value="debit_card">Débito</option>
            <option value="credit_card">Crédito</option>
            <option value="pending">Pendente</option>
          </select>
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center rounded-2xl bg-white"><RefreshCw className="animate-spin text-[#21A896]" /></div>
        ) : visibleSales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">Nenhuma venda encontrada.</div>
        ) : (
          <div className="space-y-3">
            {visibleSales.map((sale) => {
              const expanded = expandedId === sale.id;
              const metadata = sale.commercial_metadata || sale.metadata || {};
              const gross = numberValue(metadata, 'gross_subtotal', 'base_subtotal') ?? sale.subtotal ?? sale.total;
              const discount = numberValue(metadata, 'discount_total') ?? Math.max(gross - sale.total, 0);
              const operator = textValue(metadata, 'operator_name', 'cashier_name', 'created_by_name');
              const location = textValue(metadata, 'location_name', 'stock_location_name');
              const cashbookCode = textValue(metadata, 'cashbook_entry_code', 'financial_entry_code', 'cashbook_code');
              const hasDivergence = Boolean(metadata.stock_divergence || metadata.has_stock_divergence);

              return (
                <article key={sale.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <button type="button" onClick={() => void openSale(sale.id)} className="grid w-full gap-3 p-4 text-left md:grid-cols-[minmax(0,1fr)_130px_150px_130px_auto] md:items-center">
                    <div>
                      <p className="font-black text-slate-900">{sale.order_code || sale.id.slice(0, 8)}</p>
                      <p className="text-xs text-slate-500">{dateTime.format(new Date(sale.completed_at || sale.created_at))} • {sale.customer_name || 'Cliente de balcão'}</p>
                      {(operator || location) && <p className="mt-1 text-xs text-slate-500">{operator || 'Operador não informado'} • {location || 'Local não informado'}</p>}
                    </div>
                    <div><p className="text-xs text-slate-500">Canal</p><p className="font-semibold">{channelLabel(sale.sales_channel)}</p></div>
                    <div><p className="text-xs text-slate-500">Pagamento</p><p className="font-semibold">{paymentLabel(sale.payment_method_code)} · {sale.payment_status === 'paid' ? 'Pago' : sale.payment_status || 'Não informado'}</p></div>
                    <div><p className="text-xs text-slate-500">Desconto</p><p className="font-semibold text-[#1A867A]">{currency.format(discount)}</p></div>
                    <div className="flex items-center justify-end gap-3"><strong className="text-lg text-[#7B2D8E]">{currency.format(sale.total)}</strong>{expanded ? <ChevronUp /> : <ChevronDown />}</div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50 p-4">
                      <div className="space-y-2">
                        {(itemsBySale[sale.id] || []).map((item) => {
                          const snapshot = item.product_snapshot || {};
                          const meta = item.commercial_metadata || {};
                          const basePrice = numberValue(meta, 'base_price') ?? numberValue(snapshot, 'base_price', 'price') ?? item.unit_price;
                          const appliedPrice = numberValue(meta, 'applied_price', 'unit_price') ?? item.unit_price;
                          const pricingSource = textValue(meta, 'pricing_source') || 'base_price';
                          const pricingGroup = textValue(meta, 'pricing_group_name', 'group_name');
                          const itemGross = item.quantity * basePrice;
                          const itemTotal = item.quantity * appliedPrice - item.discount;

                          return (
                            <div key={item.id} className="grid gap-2 rounded-xl bg-white p-3 lg:grid-cols-[minmax(0,1fr)_80px_120px_120px_150px_120px]">
                              <div>
                                <p className="font-bold">{String(snapshot.name || 'Produto')}</p>
                                <p className="text-xs text-slate-500">{pricingGroup || pricingSource}</p>
                              </div>
                              <div><p className="text-xs text-slate-500">Qtd.</p><p className="font-semibold">{item.quantity}</p></div>
                              <div><p className="text-xs text-slate-500">Preço-base</p><p className="font-semibold">{currency.format(basePrice)}</p></div>
                              <div><p className="text-xs text-slate-500">Aplicado</p><p className="font-semibold">{currency.format(appliedPrice)}</p></div>
                              <div><p className="text-xs text-slate-500">Regra</p><p className="font-semibold">{pricingGroup || pricingSource}</p></div>
                              <div><p className="text-xs text-slate-500">Total</p><p className="font-black">{currency.format(itemTotal)}</p><p className="text-[11px] text-slate-400">Bruto {currency.format(itemGross)}</p></div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 text-sm md:grid-cols-2 lg:grid-cols-4">
                        <span>Bruto: <strong>{currency.format(gross)}</strong></span>
                        <span>Desconto: <strong>{currency.format(discount)}</strong></span>
                        <span>Total: <strong>{currency.format(sale.total)}</strong></span>
                        <span>Livro Diário: <strong>{cashbookCode || 'Lançamento integrado'}</strong></span>
                        <span>Status da venda: <strong>Concluída</strong></span>
                        <span>Divergência: <strong>{hasDivergence ? 'Registrada' : 'Nenhuma'}</strong></span>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
