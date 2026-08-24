import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  WalletCards,
} from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  SaleDetailService,
  type SaleDetailItem,
  type SaleDetailResult,
  type SaleJson,
} from '@/services/saleDetailService';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const channelLabels: Record<string, string> = {
  public_store: 'Loja pública', whatsapp: 'WhatsApp', direct: 'Venda direta', in_person: 'PDV',
  phone: 'Telefone', qr_table: 'Mesa / QR', other: 'Outro',
};
const orderStatusLabels: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', preparing: 'Em preparo', ready: 'Pronta',
  completed: 'Concluída', cancelled: 'Cancelada', expired: 'Expirada',
};
const paymentStatusLabels: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhou', refunded: 'Estornado',
  partially_refunded: 'Estorno parcial', cancelled: 'Cancelado',
};
const fulfillmentLabels: Record<string, string> = {
  pickup: 'Retirada', delivery: 'Entrega', dine_in: 'Consumo no local',
};
const reservationLabels: Record<string, string> = {
  active: 'Ativa', reserved: 'Reservada', consumed: 'Consumida', cancelled: 'Cancelada', expired: 'Expirada',
};
const financeStatusLabels: Record<string, string> = {
  confirmed: 'Confirmado', draft: 'Rascunho', cancelled: 'Cancelado',
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

function friendly(map: Record<string, string>, value?: string | null, fallback = 'Não informado') {
  return map[value || ''] || value || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : dateTime.format(parsed);
}

function textValue(record?: SaleJson | null, ...keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function numericValue(record?: SaleJson | null, ...keys: string[]) {
  if (!record) return null;
  for (const key of keys) {
    const value = Number(record[key]);
    if (Number.isFinite(value)) return value;
  }
  return null;
}

function Section({ title, subtitle, icon, children }: { title: string; subtitle?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start gap-3">
        <div className="rounded-xl bg-teal-50 p-2 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">{icon}</div>
        <div><h2 className="font-black text-slate-900 dark:text-white">{title}</h2>{subtitle && <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function StatusPill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'red' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
    amber: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
    red: 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${tones[tone]}`}>{children}</span>;
}

function itemPricing(item: SaleDetailItem) {
  const snapshot = item.product_snapshot || {};
  const metadata = item.commercial_metadata || {};
  const basePrice = numericValue(metadata, 'base_price', 'original_unit_price')
    ?? numericValue(snapshot, 'base_price', 'original_unit_price', 'price') ?? item.unit_price;
  const appliedPrice = numericValue(metadata, 'applied_price', 'unit_price')
    ?? numericValue(snapshot, 'applied_unit_price') ?? item.unit_price;
  const pricingSource = textValue(metadata, 'pricing_source') || textValue(snapshot, 'pricing_source') || 'base_price';
  const groupName = textValue(metadata, 'pricing_group_name', 'group_name') || textValue(snapshot, 'pricing_group_name');
  return { basePrice, appliedPrice, pricingSource, groupName, discount: Math.max((basePrice - appliedPrice) * item.quantity, 0) + item.discount };
}

export default function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const storeId = getActiveStoreId();
  const [detail, setDetail] = useState<SaleDetailResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!storeId || !saleId) { setLoading(false); return; }
    try {
      setLoading(true);
      setDetail(await SaleDetailService.get(storeId, saleId));
    } catch (error) {
      setDetail(null);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a venda.');
    } finally {
      setLoading(false);
    }
  }, [saleId, storeId]);

  useEffect(() => { void load(); }, [load]);

  const grossSubtotal = useMemo(() => {
    if (!detail) return 0;
    const metadata = detail.order.commercial_metadata || detail.order.metadata || {};
    return numericValue(metadata, 'base_subtotal', 'gross_subtotal')
      ?? detail.items.reduce((total, item) => total + itemPricing(item).basePrice * item.quantity, 0);
  }, [detail]);

  const totalDiscount = useMemo(() => {
    if (!detail) return 0;
    const metadata = detail.order.commercial_metadata || detail.order.metadata || {};
    return numericValue(metadata, 'total_discount', 'discount_total')
      ?? Math.max(grossSubtotal + detail.order.delivery_fee - detail.order.total, 0);
  }, [detail, grossSubtotal]);

  if (loading) {
    return <PageContainer title="Detalhe da venda"><div className="flex min-h-80 items-center justify-center"><Loader2 size={30} className="animate-spin text-teal-600" /></div></PageContainer>;
  }

  if (!detail) {
    return <PageContainer title="Detalhe da venda"><div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center"><p className="font-black text-red-800">Venda indisponível.</p><Link to="/admin/sales" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-red-700"><ArrowLeft size={16} />Voltar para vendas</Link></div></PageContainer>;
  }

  const { order, items, stock, finance } = detail;
  const completed = order.status === 'completed';
  const paymentPaid = order.payment_status === 'paid';
  const physicalMovements = stock.movements.filter((movement) => movement.affects_physical);
  const consumedReservations = stock.reservations.filter((reservation) => reservation.status === 'consumed').length;
  const openDiscrepancies = stock.discrepancies.filter((item) => !['resolved', 'closed', 'cancelled'].includes(item.status)).length;
  const confirmedFinancialEntries = finance.entries.filter((entry) => entry.status === 'confirmed' && entry.affects_balance);
  const customerLabel = textValue(order.customer_snapshot, 'display_label') || order.customer_name || 'Cliente de balcão';

  return (
    <PageContainer title="Detalhe da venda" flat>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to="/admin/sales" className="mb-3 inline-flex items-center gap-2 text-sm font-black text-teal-700"><ArrowLeft size={16} />Vendas realizadas</Link>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{order.order_code || order.id.slice(0, 8)}</h1>
              <StatusPill tone={completed ? 'green' : order.status === 'cancelled' ? 'red' : 'amber'}>{friendly(orderStatusLabels, order.status)}</StatusPill>
              <StatusPill tone={paymentPaid ? 'green' : order.payment_status === 'refunded' ? 'red' : 'amber'}>{friendly(paymentStatusLabels, order.payment_status)}</StatusPill>
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500">Uma única leitura da venda, do pedido ao estoque e ao financeiro.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw size={16} />Atualizar</button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total recebido</p><p className="mt-2 text-2xl font-black">{currency.format(order.total)}</p><p className="mt-1 text-xs font-semibold text-slate-500">Bruto {currency.format(grossSubtotal)} · desconto {currency.format(totalDiscount)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canal</p><p className="mt-2 text-lg font-black">{friendly(channelLabels, order.sales_channel)}</p><p className="mt-1 text-xs font-semibold text-slate-500">{friendly(fulfillmentLabels, order.fulfillment_type)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque</p><p className="mt-2 text-lg font-black text-emerald-700">{detail.canViewStock ? `${physicalMovements.length} movimentação(ões)` : 'Sem acesso'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{detail.canViewStock ? (openDiscrepancies ? `${openDiscrepancies} divergência(s)` : 'Sem divergência pendente') : 'Permissão necessária'}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financeiro</p><p className="mt-2 text-lg font-black text-emerald-700">{detail.canViewFinance ? `${confirmedFinancialEntries.length} lançamento(s)` : 'Sem acesso'}</p><p className="mt-1 text-xs font-semibold text-slate-500">{detail.canViewFinance && confirmedFinancialEntries[0]?.destination_financial_account_name ? `Conta: ${confirmedFinancialEntries[0].destination_financial_account_name}` : 'Rota abaixo'}</p></div>
        </div>

        <Section title="Resumo da venda" subtitle="Identidade operacional e sequência de conclusão." icon={<ShoppingBag size={18} />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div><p className="text-xs font-black uppercase text-slate-400">Cliente</p><p className="mt-1 font-black">{customerLabel}</p>{order.customer_phone && <p className="text-xs font-semibold text-slate-500">{order.customer_phone}</p>}</div>
            <div><p className="text-xs font-black uppercase text-slate-400">Pagamento</p><p className="mt-1 font-black">{order.payment_method_name || order.payment_method_code || 'Não informado'}</p><p className="text-xs font-semibold text-slate-500">{friendly(paymentStatusLabels, order.payment_status)}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-400">Atendimento</p><p className="mt-1 font-black">{friendly(fulfillmentLabels, order.fulfillment_type)}</p>{order.table_code && <p className="text-xs font-semibold text-slate-500">Mesa/comanda: {order.table_code}</p>}</div>
            <div><p className="text-xs font-black uppercase text-slate-400">Conclusão</p><p className="mt-1 font-black">{formatDate(order.completed_at)}</p><p className="text-xs font-semibold text-slate-500">Criada {formatDate(order.created_at)}</p></div>
          </div>
          {(order.delivery_address || order.notes) && <div className="mt-4 grid gap-3 md:grid-cols-2">{order.delivery_address && <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="flex items-center gap-1 text-xs font-black uppercase text-slate-400"><MapPin size={13} />Endereço</p><p className="mt-1 text-sm font-semibold">{order.delivery_address}</p></div>}{order.notes && <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-black uppercase text-slate-400">Observações</p><p className="mt-1 text-sm font-semibold">{order.notes}</p></div>}</div>}
        </Section>

        <Section title="Itens e formação de preço" subtitle="Snapshot comercial preservado no momento da venda." icon={<ReceiptText size={18} />}>
          <div className="space-y-2">{items.map((item) => {
            const pricing = itemPricing(item);
            return <div key={item.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-[minmax(210px,1fr)_70px_110px_110px_150px_130px]">
              <div><p className="font-black">{item.product_name}</p>{pricing.groupName && <p className="text-xs font-semibold text-slate-500">{pricing.groupName}</p>}{item.product_id && <Link to={`/admin/products/${item.product_id}/lifecycle`} className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-teal-700">Vida do produto <ExternalLink size={11} /></Link>}</div>
              <div><p className="text-xs font-bold text-slate-400">Qtd.</p><p className="font-black">{item.quantity}</p></div>
              <div><p className="text-xs font-bold text-slate-400">Preço-base</p><p className="font-black">{currency.format(pricing.basePrice)}</p></div>
              <div><p className="text-xs font-bold text-slate-400">Aplicado</p><p className="font-black text-teal-700">{currency.format(pricing.appliedPrice)}</p></div>
              <div><p className="text-xs font-bold text-slate-400">Regra</p><p className="text-sm font-bold">{friendly(pricingLabels, pricing.pricingSource, 'Preço-base')}</p></div>
              <div className="xl:text-right"><p className="text-xs font-bold text-slate-400">Total</p><p className="font-black">{currency.format(item.line_total)}</p>{pricing.discount > 0 && <p className="text-[11px] font-semibold text-emerald-700">-{currency.format(pricing.discount)}</p>}</div>
            </div>;
          })}</div>
          <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm sm:grid-cols-3 dark:border-slate-800"><p>Bruto: <strong>{currency.format(grossSubtotal)}</strong></p><p>Desconto: <strong className="text-emerald-700">{currency.format(totalDiscount)}</strong></p><p>Total: <strong className="text-lg">{currency.format(order.total)}</strong></p></div>
        </Section>

        <Section title="Estoque" subtitle="Reserva, baixa física e divergências vinculadas à venda." icon={<Boxes size={18} />}>
          {!detail.canViewStock ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500 dark:bg-slate-950">Seu perfil pode visualizar a venda, mas não os dados de estoque.</p> : <>
            <div className="mb-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-800"><p className="text-[10px] font-black uppercase">Baixas físicas</p><p className="mt-1 text-xl font-black">{physicalMovements.length}</p></div><div className="rounded-xl bg-blue-50 p-3 text-blue-800"><p className="text-[10px] font-black uppercase">Reservas consumidas</p><p className="mt-1 text-xl font-black">{consumedReservations}/{stock.reservations.length}</p></div><div className={`rounded-xl p-3 ${openDiscrepancies ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-700'}`}><p className="text-[10px] font-black uppercase">Divergências</p><p className="mt-1 text-xl font-black">{openDiscrepancies}</p></div></div>
            <div className="space-y-2">{stock.movements.map((movement) => <div key={movement.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800 md:grid-cols-[minmax(180px,1fr)_100px_150px_160px] md:items-center"><div><p className="font-black">{movement.product_name}</p><p className="text-xs font-semibold text-slate-500">{movement.reason || 'Movimentação vinculada à venda'}</p></div><div><p className="text-xs font-bold text-slate-400">Qtd.</p><p className={`font-black ${movement.quantity < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</p></div><div><p className="text-xs font-bold text-slate-400">Saldo físico</p><p className="font-black">{movement.previous_stock ?? '—'} → {movement.new_stock ?? '—'}</p></div><div><p className="text-xs font-bold text-slate-400">Local</p><p className="font-black">{movement.location_name || movement.to_location_name || movement.from_location_name || 'Não informado'}</p></div></div>)}</div>
            {stock.reservations.length > 0 && <div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-sm font-black"><PackageCheck size={16} />Reservas</h3><div className="flex flex-wrap gap-2">{stock.reservations.map((reservation) => <div key={reservation.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs dark:border-slate-700"><strong>{reservation.product_name}</strong> · {reservation.quantity} un. · {friendly(reservationLabels, reservation.status)} · {reservation.location_name || 'Local não informado'}</div>)}</div></div>}
            {stock.discrepancies.length > 0 && <div className="mt-5 space-y-2">{stock.discrepancies.map((discrepancy) => <div key={discrepancy.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="flex items-center gap-2 font-black"><AlertTriangle size={16} />Divergência · {discrepancy.status}</p><p className="mt-1 text-xs font-semibold">{discrepancy.location_name || 'Local não informado'} · {formatDate(discrepancy.created_at)}</p></div>)}</div>}
            <div className="mt-4 flex flex-wrap gap-2"><Link to="/admin/stock/movements" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black">Movimentações <ExternalLink size={13} /></Link>{openDiscrepancies > 0 && <Link to="/admin/stock/divergences" className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-800">Tratar divergências <ExternalLink size={13} /></Link>}</div>
          </>}
        </Section>

        <Section title="Financeiro" subtitle="Livro Diário, forma recebida, conta financeira e histórico de ajuste." icon={<CircleDollarSign size={18} />}>
          {!detail.canViewFinance ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500 dark:bg-slate-950">Seu perfil pode visualizar a venda, mas não os dados financeiros.</p> : <>
            {finance.entries.length === 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800"><AlertTriangle size={16} className="mr-2 inline" />Nenhum lançamento financeiro vinculado.</div> : <div className="space-y-2">{finance.entries.map((entry) => {
              const accountName = entry.destination_financial_account_name || entry.source_financial_account_name || 'Não distribuído';
              return <div key={entry.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex flex-col gap-3 md:flex-row md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{entry.entry_code || 'Lançamento financeiro'}</p><StatusPill tone={entry.status === 'confirmed' ? 'green' : entry.status === 'cancelled' ? 'red' : 'amber'}>{friendly(financeStatusLabels, entry.status)}</StatusPill></div><p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(entry.occurred_at)} · {entry.description}</p></div><p className={`text-xl font-black ${entry.direction === 'out' ? 'text-red-700' : 'text-emerald-700'}`}>{entry.direction === 'out' ? '-' : '+'}{currency.format(entry.amount)}</p></div><div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800"><div><p className="text-xs font-bold text-slate-400">Forma</p><p className="font-black">{entry.payment_method_name || entry.payment_method_code || 'Não informada'}</p></div><div><p className="text-xs font-bold text-slate-400">Conta</p><p className="font-black">{accountName}</p></div><div><p className="text-xs font-bold text-slate-400">Saldo</p><p className="font-black">{entry.affects_balance ? 'Afeta saldo' : 'Não afeta saldo'}</p></div><div><p className="text-xs font-bold text-slate-400">Origem</p><p className="font-black">{entry.source === 'order' ? 'Venda / pedido' : entry.source || 'Não informada'}</p></div></div></div>;
            })}</div>}
            {finance.routeAudit.length > 0 && <div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-sm font-black"><Clock3 size={16} />Histórico de ajuste financeiro</h3><div className="space-y-2">{finance.routeAudit.map((audit) => <div key={audit.id} className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300"><p><strong>{formatDate(audit.created_at)}</strong> · {audit.old_payment_method_code || '—'} → {audit.new_payment_method_code || '—'}</p><p className="mt-1">Conta: {audit.old_destination_financial_account_name || audit.old_source_financial_account_name || 'Não distribuído'} → {audit.new_destination_financial_account_name || audit.new_source_financial_account_name || 'Não distribuído'}</p>{audit.reason && <p className="mt-1">Motivo: {audit.reason}</p>}</div>)}</div></div>}
            <div className="mt-4 flex flex-wrap gap-2"><Link to="/admin/cashbook" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black"><ReceiptText size={14} />Livro Diário <ExternalLink size={13} /></Link><Link to="/admin/financial-accounts?tab=balances" className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black"><WalletCards size={14} />Contas financeiras <ExternalLink size={13} /></Link></div>
          </>}
        </Section>

        <Section title="Checklist da venda" subtitle="Conferência funcional rápida." icon={<BadgeCheck size={18} />}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-xl border p-3 ${completed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><p className="font-black">Venda</p><p className="text-xs font-semibold">{completed ? 'Concluída' : friendly(orderStatusLabels, order.status)}</p></div>
            <div className={`rounded-xl border p-3 ${paymentPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><p className="font-black">Pagamento</p><p className="text-xs font-semibold">{friendly(paymentStatusLabels, order.payment_status)}</p></div>
            <div className={`rounded-xl border p-3 ${detail.canViewStock && physicalMovements.length > 0 && openDiscrepancies === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><p className="font-black">Estoque</p><p className="text-xs font-semibold">{!detail.canViewStock ? 'Sem permissão' : physicalMovements.length === 0 ? 'Sem baixa vinculada' : openDiscrepancies ? 'Divergência pendente' : 'Baixa vinculada'}</p></div>
            <div className={`rounded-xl border p-3 ${detail.canViewFinance && confirmedFinancialEntries.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}><p className="font-black">Financeiro</p><p className="text-xs font-semibold">{!detail.canViewFinance ? 'Sem permissão' : confirmedFinancialEntries.length ? 'Lançamento vinculado' : 'Sem lançamento'}</p></div>
          </div>
        </Section>
      </div>
    </PageContainer>
  );
}
