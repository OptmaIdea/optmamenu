import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Boxes,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  List,
  Loader2,
  MapPin,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShoppingBag,
  Undo2,
  WalletCards,
  X,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId } from '@/utils/activeStore';
import {
  FinancialAccountsService,
  type FinancialAccountBalance,
  type FinancialPaymentMethod,
} from '@/services/financialAccountsService';
import {
  SaleDetailService,
  type SaleAdjustmentReason,
  type SaleAdjustmentType,
  type SaleDetailItem,
  type SaleDetailResult,
  type SaleJson,
} from '@/services/saleDetailService';
import SalePartialReturnQuotePreview from './SalePartialReturnQuotePreview';
import SaleRefundFinanceFields from './SaleRefundFinanceFields';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const channelLabels: Record<string, string> = {
  public_store: 'Loja pública', whatsapp: 'WhatsApp', direct: 'Venda direta', in_person: 'PDV', pdv: 'PDV',
  phone: 'Telefone', qr_table: 'Mesa / QR', other: 'Outro',
};
const orderStatusLabels: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmada', preparing: 'Em preparo', ready: 'Pronta',
  completed: 'Concluída', cancelled: 'Cancelada', expired: 'Expirada',
};
const paymentStatusLabels: Record<string, string> = {
  paid: 'Pago', pending: 'Pendente', failed: 'Falhou', refund_pending: 'Estorno pendente',
  refunded: 'Estornado integralmente', partially_refunded: 'Estorno parcial', cancelled: 'Cancelado',
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
const discrepancyLabels: Record<string, string> = {
  open: 'Aberta', under_review: 'Em análise', waiting_stock_count: 'Aguardando contagem física',
  resolved: 'Resolvida', cancelled: 'Cancelada',
};
const adjustmentTypeLabels: Record<SaleAdjustmentType, string> = {
  full_cancellation: 'Cancelamento / estorno total',
  partial_return: 'Devolução parcial',
};
const reasonLabels: Record<SaleAdjustmentReason, string> = {
  customer_withdrew: 'Cliente desistiu',
  customer_return: 'Cliente devolveu produto(s)',
  sale_entered_by_mistake: 'Venda ou baixa lançada por engano',
  duplicate_sale: 'Venda duplicada',
  wrong_item: 'Produto/item incorreto',
  quality_issue: 'Problema de qualidade',
  other: 'Outro motivo',
};
const adjustmentReasons = Object.entries(reasonLabels) as Array<[SaleAdjustmentReason, string]>;

type FocusMode = 'stock' | 'cashbook' | 'account';
type AdjustmentForm = {
  type: SaleAdjustmentType;
  reasonCode: SaleAdjustmentReason;
  notes: string;
  refundAccountId: string;
  refundPaymentMethodCode: string;
  quantities: Record<string, number>;
};

function friendly(map: Record<string, string>, value?: string | null, fallback = 'Não informado') {
  return map[value || ''] || value?.replaceAll('_', ' ') || fallback;
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
        <div>
          <h2 className="font-black text-slate-900 dark:text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
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
  const discount = Math.max((basePrice - appliedPrice) * item.quantity, 0) + item.discount;
  return { basePrice, appliedPrice, pricingSource, groupName, discount };
}

function accountAcceptsMethod(account: FinancialAccountBalance, method?: FinancialPaymentMethod) {
  if (!method) return true;
  const accepted = account.accepted_payment_methods || [];
  return accepted.length === 0 || accepted.includes(method.code) || accepted.includes(method.base_code);
}

export default function SaleDetailPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const storeId = getActiveStoreId();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedFocus = searchParams.get('focus');
  const focus: FocusMode | null = ['stock', 'cashbook', 'account'].includes(requestedFocus || '') ? requestedFocus as FocusMode : null;
  const [detail, setDetail] = useState<SaleDetailResult | null>(null);
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccountBalance[]>([]);
  const [financialPaymentMethods, setFinancialPaymentMethods] = useState<FinancialPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm | null>(null);
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);

  const load = useCallback(async () => {
    if (!storeId || !saleId) { setLoading(false); return; }
    try {
      setLoading(true);
      const next = await SaleDetailService.get(storeId, saleId);
      setDetail(next);
      if (next.canAdjustSale) {
        try {
          const balances = await FinancialAccountsService.getBalances(storeId);
          setFinancialAccounts(balances.accounts.filter((account) => account.active));
          setFinancialPaymentMethods(balances.paymentMethods.filter((method) => method.affects_cashbook));
        } catch {
          setFinancialAccounts([]);
          setFinancialPaymentMethods([]);
        }
      } else {
        setFinancialAccounts([]);
        setFinancialPaymentMethods([]);
      }
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

  const returnedByItem = useMemo(() => {
    const result: Record<string, number> = {};
    for (const adjustment of detail?.adjustments || []) {
      if (adjustment.status !== 'completed') continue;
      for (const item of adjustment.items) result[item.order_item_id] = (result[item.order_item_id] || 0) + item.quantity;
    }
    return result;
  }, [detail]);

  if (loading) {
    return <PageContainer title="Detalhe da venda" withoutHeader><div className="flex min-h-80 items-center justify-center"><Loader2 size={30} className="animate-spin text-teal-600" /></div></PageContainer>;
  }

  if (!detail) {
    return (
      <PageContainer title="Detalhe da venda" withoutHeader>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30">
          <p className="font-black text-red-800 dark:text-red-200">Venda indisponível.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-black text-red-700 dark:bg-slate-900 dark:text-red-300"><ArrowLeft size={16} />Voltar</button>
            <Link to="/admin/sales" className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-black text-red-700 dark:border-red-900 dark:bg-slate-900 dark:text-red-300"><List size={16} />Abrir todas as vendas</Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  const { order, items, stock, finance } = detail;
  const completed = order.status === 'completed';
  const paymentPaid = order.payment_status === 'paid';
  const physicalMovements = stock.movements.filter((movement) => movement.affects_physical);
  const consumedReservations = stock.reservations.filter((reservation) => reservation.status === 'consumed').length;
  const openDiscrepancies = stock.discrepancies.filter((item) => !['resolved', 'closed', 'cancelled'].includes(item.status)).length;
  const confirmedFinancialEntries = finance.entries.filter((entry) => entry.status === 'confirmed' && entry.affects_balance);
  const customerLabel = textValue(order.customer_snapshot, 'display_label') || order.customer_name || 'Cliente de balcão';
  const originalFinancialEntry = finance.entries.find((entry) => entry.type === 'sale' && entry.direction === 'in' && entry.status === 'confirmed');
  const originalAccountId = originalFinancialEntry?.destination_financial_account_id || originalFinancialEntry?.source_financial_account_id || '';

  function goBack() {
    navigate(-1);
  }

  function openAdjustment(type: SaleAdjustmentType) {
    const originalMethodCode = originalFinancialEntry?.payment_method_code || order.payment_method_code || '';
    const method = financialPaymentMethods.find((candidate) => candidate.code === originalMethodCode)
      || financialPaymentMethods.find((candidate) => candidate.base_code === originalMethodCode)
      || financialPaymentMethods[0];
    const compatibleAccounts = financialAccounts.filter((account) => accountAcceptsMethod(account, method));
    const preferredAccount = compatibleAccounts.find((account) => account.id === originalAccountId)
      || compatibleAccounts.find((account) => account.id === method?.preferred_financial_account_id)
      || compatibleAccounts[0];

    setAdjustmentForm({
      type,
      reasonCode: type === 'full_cancellation' ? 'customer_withdrew' : 'customer_return',
      notes: '',
      refundAccountId: preferredAccount?.id || '',
      refundPaymentMethodCode: method?.code || '',
      quantities: {},
    });
  }

  async function submitAdjustment() {
    if (!storeId || !saleId || !adjustmentForm) return;
    if (!adjustmentForm.refundPaymentMethodCode) return toast.error('Selecione a forma efetiva da devolução.');
    if (!adjustmentForm.refundAccountId) return toast.error('Selecione a conta financeira de onde sairá o estorno.');
    if (adjustmentForm.notes.trim().length < 3) return toast.error('Descreva a justificativa do cancelamento/devolução.');

    const selectedItems = items
      .map((item) => ({ orderItemId: item.id, quantity: adjustmentForm.quantities[item.id] || 0 }))
      .filter((item) => item.quantity > 0);
    if (adjustmentForm.type === 'partial_return' && selectedItems.length === 0) return toast.error('Informe a quantidade devolvida em ao menos um item.');

    try {
      setAdjustmentSaving(true);
      const result = await SaleDetailService.adjust({
        storeId,
        orderId: saleId,
        adjustmentType: adjustmentForm.type,
        reasonCode: adjustmentForm.reasonCode,
        reasonNotes: adjustmentForm.notes,
        items: selectedItems,
        refundAccountId: adjustmentForm.refundAccountId,
        refundPaymentMethodCode: adjustmentForm.refundPaymentMethodCode,
      });
      toast.success(`${adjustmentForm.type === 'full_cancellation' ? 'Cancelamento/estorno' : 'Devolução parcial'} registrado: ${currency.format(result.refundAmount)} via ${result.refundPaymentMethodName || 'forma selecionada'}.`);
      if (result.stockWarningCount > 0) toast.warning('O financeiro foi estornado, mas parte da quantidade não possuía baixa física vinculada. Confira o bloco de estoque.');
      setAdjustmentForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível ajustar a venda.');
    } finally {
      setAdjustmentSaving(false);
    }
  }

  const selectedReturnItems = adjustmentForm?.type === 'partial_return'
    ? items.map((item) => ({ orderItemId: item.id, quantity: adjustmentForm.quantities[item.id] || 0 })).filter((item) => item.quantity > 0)
    : [];

  if (focus) {
    const focusTitle = focus === 'stock' ? 'Movimentações desta venda' : focus === 'cashbook' ? 'Livro Diário desta venda' : 'Conta financeira desta venda';
    return (
      <PageContainer title={focusTitle} withoutHeader>
        <div className="space-y-5 text-slate-900 dark:text-slate-100">
          <div>
            <div className="mb-3 flex flex-wrap gap-3">
              <button type="button" onClick={goBack} className="inline-flex items-center gap-2 text-sm font-black text-teal-700 dark:text-teal-300"><ArrowLeft size={16} />Voltar</button>
              <Link to="/admin/sales" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 dark:text-slate-300"><List size={16} />Abrir todas as vendas</Link>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-600 dark:text-teal-300">{order.order_code || 'Venda'}</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{focusTitle}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">Exibindo somente os registros vinculados a esta venda.</p>
          </div>

          {focus === 'stock' && <Section title="Estoque vinculado" subtitle="Baixas, retornos, reservas e divergências desta venda." icon={<Boxes size={18} />}>
            {!detail.canViewStock ? <p className="text-sm font-bold text-slate-500">Sem permissão para estoque.</p> : <>
              <div className="space-y-2">{stock.movements.length === 0 ? <p className="text-sm font-bold text-slate-500">Nenhuma movimentação vinculada.</p> : stock.movements.map((movement) => <div key={movement.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800 md:grid-cols-[minmax(200px,1fr)_90px_130px_160px]"><div><p className="font-black">{movement.product_name}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{movement.reason || 'Movimentação vinculada à venda'}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{formatDate(movement.created_at)}</p></div><div><p className="text-xs font-bold text-slate-400">Qtd.</p><p className={`font-black ${movement.quantity < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</p></div><div><p className="text-xs font-bold text-slate-400">Saldo</p><p className="font-black">{movement.previous_stock ?? '—'} → {movement.new_stock ?? '—'}</p></div><div><p className="text-xs font-bold text-slate-400">Local</p><p className="font-black">{movement.location_name || movement.from_location_name || movement.to_location_name || 'Não informado'}</p></div></div>)}</div>
              {stock.reservations.length > 0 && <div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-sm font-black"><PackageCheck size={16} />Reservas</h3><div className="flex flex-wrap gap-2">{stock.reservations.map((reservation) => <span key={reservation.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{reservation.product_name} · {reservation.quantity} un. · {friendly(reservationLabels, reservation.status)} · {reservation.location_name || 'Local não informado'}</span>)}</div></div>}
              {stock.discrepancies.length > 0 && <div className="mt-5 space-y-2">{stock.discrepancies.map((discrepancy) => <div key={discrepancy.id} className={`rounded-xl border p-3 text-sm ${['resolved', 'cancelled'].includes(discrepancy.status) ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}><p className="font-black">Divergência · {friendly(discrepancyLabels, discrepancy.status)}</p>{discrepancy.resolution_notes && <p className="mt-1 text-xs font-semibold">{discrepancy.resolution_notes}</p>}</div>)}</div>}
            </>}
          </Section>}

          {focus === 'cashbook' && <Section title="Livro Diário vinculado" subtitle="Recebimentos e estornos desta venda." icon={<ReceiptText size={18} />}>
            {!detail.canViewFinance ? <p className="text-sm font-bold text-slate-500">Sem permissão para financeiro.</p> : finance.entries.length === 0 ? <p className="text-sm font-bold text-slate-500">Nenhum lançamento vinculado.</p> : <div className="space-y-2">{finance.entries.map((entry) => <div key={entry.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><p className="font-black">{entry.entry_code || 'Lançamento'}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(entry.occurred_at)} · {entry.description}</p></div><p className={`text-xl font-black ${entry.direction === 'out' ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{entry.direction === 'out' ? '-' : '+'}{currency.format(entry.amount)}</p></div><div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800 sm:grid-cols-3"><span>Tipo: <strong>{entry.type === 'refund' ? 'Estorno / devolução' : entry.type === 'sale' ? 'Venda' : entry.type}</strong></span><span>Forma: <strong>{entry.payment_method_name || entry.payment_method || entry.payment_method_code || 'Não informada'}</strong></span><span>Conta: <strong>{entry.destination_financial_account_name || entry.source_financial_account_name || 'Não distribuído'}</strong></span></div></div>)}</div>}
          </Section>}

          {focus === 'account' && <Section title="Conta financeira vinculada" subtitle="Rota financeira da venda e de seus estornos." icon={<WalletCards size={18} />}>
            {!detail.canViewFinance ? <p className="text-sm font-bold text-slate-500">Sem permissão para financeiro.</p> : finance.entries.length === 0 ? <p className="text-sm font-bold text-slate-500">Nenhuma conta vinculada.</p> : <div className="space-y-2">{finance.entries.map((entry) => { const accountName = entry.direction === 'out' ? entry.source_financial_account_name || entry.destination_financial_account_name : entry.destination_financial_account_name || entry.source_financial_account_name; return <div key={entry.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><p className="font-black">{accountName || 'Não distribuído'}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{entry.entry_code || 'Lançamento'} · {entry.payment_method_name || entry.payment_method || entry.payment_method_code || 'Forma não informada'} · {formatDate(entry.occurred_at)}</p></div><p className={`text-xl font-black ${entry.direction === 'out' ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{entry.direction === 'out' ? '-' : '+'}{currency.format(entry.amount)}</p></div></div>; })}</div>}
            {finance.routeAudit.length > 0 && <div className="mt-5"><h3 className="mb-2 flex items-center gap-2 text-sm font-black"><Clock3 size={16} />Histórico de alteração de rota</h3><div className="space-y-2">{finance.routeAudit.map((audit) => <div key={audit.id} className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300"><strong>{formatDate(audit.created_at)}</strong> · {audit.old_destination_financial_account_name || audit.old_source_financial_account_name || 'Não distribuído'} → {audit.new_destination_financial_account_name || audit.new_source_financial_account_name || 'Não distribuído'}{audit.reason ? ` · ${audit.reason}` : ''}</div>)}</div></div>}
          </Section>}

          <div className="flex flex-wrap gap-2">
            <Link to={`/admin/sales/${order.id}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white">Detalhe completo da venda</Link>
            <Link to="/admin/sales" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700"><List size={14} />Todas as vendas</Link>
            {focus === 'stock' && <Link to="/admin/stock/movements" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700">Todas as movimentações <ExternalLink size={14} /></Link>}
            {focus === 'cashbook' && <Link to="/admin/cashbook" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700">Livro Diário completo <ExternalLink size={14} /></Link>}
            {focus === 'account' && <Link to="/admin/financial-accounts?tab=balances" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700">Contas financeiras completas <ExternalLink size={14} /></Link>}
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Detalhe da venda" withoutHeader>
      <div className="space-y-5 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 flex flex-wrap gap-3">
              <button type="button" onClick={goBack} className="inline-flex items-center gap-2 text-sm font-black text-teal-700 dark:text-teal-300"><ArrowLeft size={16} />Voltar</button>
              <Link to="/admin/sales" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 dark:text-slate-300"><List size={16} />Abrir todas as vendas</Link>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-black text-slate-900 dark:text-white">{order.order_code || order.id.slice(0, 8)}</h1>
              <StatusPill tone={completed ? 'green' : order.status === 'cancelled' ? 'red' : 'amber'}>{friendly(orderStatusLabels, order.status)}</StatusPill>
              <StatusPill tone={order.payment_status === 'refunded' ? 'red' : paymentPaid ? 'green' : 'amber'}>{friendly(paymentStatusLabels, order.payment_status)}</StatusPill>
              {detail.fullyRefunded && <StatusPill tone="red">Venda estornada após conclusão</StatusPill>}
              {!detail.fullyRefunded && detail.totalRefunded > 0 && <StatusPill tone="amber">Devolução parcial</StatusPill>}
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">Uma única leitura da venda, do pedido ao estoque e ao financeiro.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {detail.canAdjustSale && !detail.fullyRefunded && <button type="button" onClick={() => openAdjustment('partial_return')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-black text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><Undo2 size={16} />Devolução parcial</button>}
            {detail.canAdjustSale && !detail.fullyRefunded && <button type="button" onClick={() => openAdjustment('full_cancellation')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-black text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><RotateCcw size={16} />Cancelar / estornar venda</button>}
            <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw size={16} />Atualizar</button>
          </div>
        </div>

        {detail.totalRefunded > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">Total já estornado: <strong>{currency.format(detail.totalRefunded)}</strong> · Ainda estornável: <strong>{currency.format(detail.remainingRefundable)}</strong>. A venda original permanece no histórico e cada reversão é registrada separadamente.</div>}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total da venda</p><p className="mt-2 text-2xl font-black text-slate-900 dark:text-white">{currency.format(order.total)}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Bruto {currency.format(grossSubtotal)} · desconto {currency.format(totalDiscount)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Canal</p><p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{friendly(channelLabels, order.sales_channel)}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{friendly(fulfillmentLabels, order.fulfillment_type)}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estoque</p><p className="mt-2 text-lg font-black text-emerald-700 dark:text-emerald-300">{detail.canViewStock ? `${physicalMovements.length} movimentação(ões)` : 'Sem acesso'}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{detail.canViewStock ? (openDiscrepancies ? `${openDiscrepancies} divergência(s) pendente(s)` : 'Sem divergência pendente') : 'Permissão necessária'}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financeiro</p><p className="mt-2 text-lg font-black text-emerald-700 dark:text-emerald-300">{detail.canViewFinance ? `${confirmedFinancialEntries.length} lançamento(s)` : 'Sem acesso'}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{detail.canViewFinance && originalFinancialEntry?.destination_financial_account_name ? `Conta: ${originalFinancialEntry.destination_financial_account_name}` : 'Rota abaixo'}</p></div>
        </div>

        <Section title="Resumo da venda" subtitle="Identidade operacional e sequência de conclusão." icon={<ShoppingBag size={18} />}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div><p className="text-xs font-black uppercase text-slate-400">Cliente</p><p className="mt-1 font-black">{customerLabel}</p>{order.customer_phone && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{order.customer_phone}</p>}</div>
            <div><p className="text-xs font-black uppercase text-slate-400">Pagamento</p><p className="mt-1 font-black">{order.payment_method_name || order.payment_method_code || 'Não informado'}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{friendly(paymentStatusLabels, order.payment_status)}</p></div>
            <div><p className="text-xs font-black uppercase text-slate-400">Atendimento</p><p className="mt-1 font-black">{friendly(fulfillmentLabels, order.fulfillment_type)}</p>{order.table_code && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Mesa/comanda: {order.table_code}</p>}</div>
            <div><p className="text-xs font-black uppercase text-slate-400">Conclusão</p><p className="mt-1 font-black">{formatDate(order.completed_at)}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Criada {formatDate(order.created_at)}</p></div>
          </div>
          {(order.delivery_address || order.notes) && <div className="mt-4 grid gap-3 md:grid-cols-2">{order.delivery_address && <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="flex items-center gap-1 text-xs font-black uppercase text-slate-400"><MapPin size={13} />Endereço</p><p className="mt-1 text-sm font-semibold">{order.delivery_address}</p></div>}{order.notes && <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-black uppercase text-slate-400">Observações</p><p className="mt-1 text-sm font-semibold">{order.notes}</p></div>}</div>}
        </Section>

        <Section title="Itens e formação de preço" subtitle="Snapshot comercial preservado no momento da venda." icon={<ReceiptText size={18} />}>
          <div className="space-y-2">{items.map((item) => {
            const pricing = itemPricing(item);
            const returned = returnedByItem[item.id] || 0;
            return <div key={item.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800 md:grid-cols-2 xl:grid-cols-[minmax(210px,1fr)_70px_110px_110px_150px_130px]">
              <div><p className="font-black">{item.product_name}</p>{pricing.groupName && <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{pricing.groupName}</p>}{returned > 0 && <p className="mt-1 text-xs font-black text-amber-700 dark:text-amber-300">Devolvido/estornado: {returned} un.</p>}{item.product_id && <Link to={`/admin/products/${item.product_id}/lifecycle`} className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-teal-700 dark:text-teal-300">Vida do produto <ExternalLink size={11} /></Link>}</div>
              <div><p className="text-xs font-bold text-slate-400">Qtd.</p><p className="font-black">{item.quantity}</p></div>
              <div><p className="text-xs font-bold text-slate-400">Preço-base</p><p className="font-black">{currency.format(pricing.basePrice)}</p></div>
              <div><p className="text-xs font-bold text-slate-400">Aplicado</p><p className="font-black text-teal-700 dark:text-teal-300">{currency.format(pricing.appliedPrice)}</p></div>
              <div><p className="text-xs font-bold text-slate-400">Regra</p><p className="text-sm font-bold">{friendly(pricingLabels, pricing.pricingSource, 'Preço-base')}</p></div>
              <div className="xl:text-right"><p className="text-xs font-bold text-slate-400">Total</p><p className="font-black">{currency.format(item.line_total)}</p>{pricing.discount > 0 && <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">-{currency.format(pricing.discount)}</p>}</div>
            </div>;
          })}</div>
          <div className="mt-4 grid gap-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-800 sm:grid-cols-3"><p>Bruto: <strong>{currency.format(grossSubtotal)}</strong></p><p>Desconto: <strong className="text-emerald-700 dark:text-emerald-300">{currency.format(totalDiscount)}</strong></p><p>Total: <strong className="text-lg">{currency.format(order.total)}</strong></p></div>
        </Section>

        <Section title="Estoque" subtitle="Reserva, baixa física e divergências vinculadas à venda." icon={<Boxes size={18} />}>
          {!detail.canViewStock ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500 dark:bg-slate-950">Seu perfil pode visualizar a venda, mas não os dados de estoque.</p> : <>
            <div className="mb-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"><p className="text-[10px] font-black uppercase">Movimentações físicas</p><p className="mt-1 text-xl font-black">{physicalMovements.length}</p></div><div className="rounded-xl bg-blue-50 p-3 text-blue-800 dark:bg-blue-950/30 dark:text-blue-300"><p className="text-[10px] font-black uppercase">Reservas consumidas</p><p className="mt-1 text-xl font-black">{consumedReservations}/{stock.reservations.length}</p></div><div className={`rounded-xl p-3 ${openDiscrepancies ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300' : 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}><p className="text-[10px] font-black uppercase">Divergências pendentes</p><p className="mt-1 text-xl font-black">{openDiscrepancies}</p></div></div>
            <div className="space-y-2">{stock.movements.map((movement) => <div key={movement.id} className="grid gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800 md:grid-cols-[minmax(180px,1fr)_100px_150px_160px] md:items-center"><div><p className="font-black">{movement.product_name}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{movement.reason || 'Movimentação vinculada à venda'}</p></div><div><p className="text-xs font-bold text-slate-400">Qtd.</p><p className={`font-black ${movement.quantity < 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</p></div><div><p className="text-xs font-bold text-slate-400">Saldo físico</p><p className="font-black">{movement.previous_stock ?? '—'} → {movement.new_stock ?? '—'}</p></div><div><p className="text-xs font-bold text-slate-400">Local</p><p className="font-black">{movement.location_name || movement.to_location_name || movement.from_location_name || 'Não informado'}</p></div></div>)}</div>
            {stock.discrepancies.length > 0 && <div className="mt-5 space-y-2">{stock.discrepancies.map((discrepancy) => <div key={discrepancy.id} className={`rounded-xl border p-3 text-sm ${['resolved', 'cancelled'].includes(discrepancy.status) ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'}`}><p className="flex items-center gap-2 font-black"><AlertTriangle size={16} />Divergência · {friendly(discrepancyLabels, discrepancy.status)}</p><p className="mt-1 text-xs font-semibold">{discrepancy.location_name || 'Local não informado'} · {formatDate(discrepancy.created_at)}</p>{discrepancy.resolution_notes && <p className="mt-1 text-xs font-semibold">Anotação: {discrepancy.resolution_notes}</p>}</div>)}</div>}
            <div className="mt-4 flex flex-wrap gap-2"><Link to={`/admin/sales/${order.id}?focus=stock`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black dark:border-slate-700">Movimentações desta venda <ExternalLink size={13} /></Link>{openDiscrepancies > 0 && <Link to={`/admin/stock/divergences?orderId=${order.id}&status=all&returnTo=${encodeURIComponent(`/admin/sales/${order.id}`)}`} className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-black text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">Tratar divergência <ExternalLink size={13} /></Link>}</div>
          </>}
        </Section>

        <Section title="Financeiro" subtitle="Livro Diário, forma recebida, conta financeira e histórico de ajuste." icon={<CircleDollarSign size={18} />}>
          {!detail.canViewFinance ? <p className="rounded-xl bg-slate-50 p-4 text-sm font-bold text-slate-500 dark:bg-slate-950">Seu perfil pode visualizar a venda, mas não os dados financeiros.</p> : <>
            {finance.entries.length === 0 ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"><AlertTriangle size={16} className="mr-2 inline" />Nenhum lançamento financeiro vinculado.</div> : <div className="space-y-2">{finance.entries.map((entry) => { const accountName = entry.destination_financial_account_name || entry.source_financial_account_name || 'Não distribuído'; return <div key={entry.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex flex-col gap-3 md:flex-row md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-black">{entry.entry_code || 'Lançamento financeiro'}</p><StatusPill tone={entry.status === 'confirmed' ? 'green' : entry.status === 'cancelled' ? 'red' : 'amber'}>{friendly(financeStatusLabels, entry.status)}</StatusPill></div><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(entry.occurred_at)} · {entry.description}</p></div><p className={`text-xl font-black ${entry.direction === 'out' ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{entry.direction === 'out' ? '-' : '+'}{currency.format(entry.amount)}</p></div><div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 text-sm dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs font-bold text-slate-400">Forma</p><p className="font-black">{entry.payment_method_name || entry.payment_method || entry.payment_method_code || 'Não informada'}</p></div><div><p className="text-xs font-bold text-slate-400">Conta</p><p className="font-black">{accountName}</p></div><div><p className="text-xs font-bold text-slate-400">Saldo</p><p className="font-black">{entry.affects_balance ? 'Afeta saldo' : 'Não afeta saldo'}</p></div><div><p className="text-xs font-bold text-slate-400">Origem</p><p className="font-black">{entry.type === 'refund' ? 'Estorno / devolução' : entry.source === 'order' ? 'Venda / pedido' : entry.source || 'Não informada'}</p></div></div></div>; })}</div>}
            <div className="mt-4 flex flex-wrap gap-2"><Link to={`/admin/sales/${order.id}?focus=cashbook`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black dark:border-slate-700"><ReceiptText size={14} />Livro Diário desta venda <ExternalLink size={13} /></Link><Link to={`/admin/sales/${order.id}?focus=account`} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black dark:border-slate-700"><WalletCards size={14} />Conta financeira desta venda <ExternalLink size={13} /></Link></div>
          </>}
        </Section>

        {detail.adjustments.length > 0 && <Section title="Cancelamentos e devoluções" subtitle="Histórico auditável das reversões feitas depois da conclusão da venda." icon={<RotateCcw size={18} />}>
          <div className="space-y-2">{detail.adjustments.map((adjustment) => {
            const refundMethod = textValue(adjustment.metadata, 'refund_payment_method_name');
            const pricingAdjustment = numericValue(adjustment.metadata, 'pricing_recalculation_adjustment');
            return <div key={adjustment.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><p className="font-black">{adjustmentTypeLabels[adjustment.adjustment_type]}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{formatDate(adjustment.created_at)} · {reasonLabels[adjustment.reason_code]}</p><p className="mt-1 text-sm font-semibold">{adjustment.reason_notes}</p>{refundMethod && <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">Forma devolvida: {refundMethod}</p>}{pricingAdjustment != null && pricingAdjustment > 0.005 && <p className="mt-1 text-xs font-bold text-amber-700 dark:text-amber-300">Reprecificação por perda de faixa: {currency.format(pricingAdjustment)}</p>}</div><p className="text-xl font-black text-red-700 dark:text-red-300">-{currency.format(adjustment.refund_amount)}</p></div>{adjustment.items.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{adjustment.items.map((item) => <span key={item.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold dark:bg-slate-950">{item.product_name} · {item.quantity} un. · estoque retornado {item.stock_returned_quantity}</span>)}</div>}</div>;
          })}</div>
        </Section>}

        <Section title="Checklist da venda" subtitle="Conferência funcional rápida." icon={<BadgeCheck size={18} />}>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-xl border p-3 ${completed ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><p className="font-black">Venda</p><p className="text-xs font-semibold">{detail.fullyRefunded ? 'Concluída e posteriormente estornada' : completed ? 'Concluída' : friendly(orderStatusLabels, order.status)}</p></div>
            <div className={`rounded-xl border p-3 ${paymentPaid ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300'}`}><p className="font-black">Pagamento</p><p className="text-xs font-semibold">{friendly(paymentStatusLabels, order.payment_status)}</p></div>
            <div className={`rounded-xl border p-3 ${detail.canViewStock && physicalMovements.length > 0 && openDiscrepancies === 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}><p className="font-black">Estoque</p><p className="text-xs font-semibold">{!detail.canViewStock ? 'Sem permissão' : physicalMovements.length === 0 ? 'Sem baixa vinculada' : openDiscrepancies ? 'Divergência pendente' : 'Movimentação vinculada'}</p></div>
            <div className={`rounded-xl border p-3 ${detail.canViewFinance && confirmedFinancialEntries.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'}`}><p className="font-black">Financeiro</p><p className="text-xs font-semibold">{!detail.canViewFinance ? 'Sem permissão' : confirmedFinancialEntries.length ? `${confirmedFinancialEntries.length} lançamento(s) vinculado(s)` : 'Sem lançamento'}</p></div>
          </div>
        </Section>
      </div>

      {adjustmentForm && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white shadow-2xl dark:bg-slate-900 sm:rounded-3xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
              <div><h2 className="text-xl font-black text-slate-900 dark:text-white">{adjustmentTypeLabels[adjustmentForm.type]}</h2><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">A venda original não é apagada. O sistema registra a reversão no estoque, no Livro Diário e na conta financeira.</p></div>
              <button type="button" onClick={() => setAdjustmentForm(null)} className="rounded-xl border border-slate-200 p-2 text-slate-500 dark:border-slate-700"><X size={16} /></button>
            </div>
            <div className="space-y-4 p-5">
              <label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-400">Motivo</span><select value={adjustmentForm.reasonCode} onChange={(event) => setAdjustmentForm((current) => current ? { ...current, reasonCode: event.target.value as SaleAdjustmentReason } : current)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-bold dark:border-slate-700 dark:bg-slate-950">{adjustmentReasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="block"><span className="text-xs font-black uppercase tracking-widest text-slate-400">Justificativa / o que ocorreu</span><textarea value={adjustmentForm.notes} onChange={(event) => setAdjustmentForm((current) => current ? { ...current, notes: event.target.value } : current)} rows={3} placeholder="Ex.: cliente devolveu 1 unidade lacrada; produto retornou ao estoque físico." className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label>

              <SaleRefundFinanceFields
                accounts={financialAccounts}
                paymentMethods={financialPaymentMethods}
                refundAccountId={adjustmentForm.refundAccountId}
                refundPaymentMethodCode={adjustmentForm.refundPaymentMethodCode}
                onChange={(next) => setAdjustmentForm((current) => current ? { ...current, ...next } : current)}
              />
              {(financialAccounts.length === 0 || financialPaymentMethods.length === 0) && <p className="text-xs font-bold text-red-600 dark:text-red-300">É necessário ter forma de pagamento e conta financeira ativas para registrar a devolução.</p>}

              {adjustmentForm.type === 'partial_return' ? <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Itens devolvidos</p>
                <div className="mt-2 space-y-2">{items.map((item) => {
                  const remaining = Math.max(item.quantity - (returnedByItem[item.id] || 0), 0);
                  const originalUnitNet = item.quantity > 0 ? item.line_total / item.quantity : 0;
                  return <div key={item.id} className={`grid gap-3 rounded-xl border p-3 dark:border-slate-700 sm:grid-cols-[minmax(180px,1fr)_120px_140px] sm:items-center ${remaining === 0 ? 'opacity-50' : ''}`}><div><p className="font-black">{item.product_name}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Disponível: {remaining}/{item.quantity} · preço líquido original {currency.format(originalUnitNet)} por un.</p></div><label className="text-xs font-black text-slate-500">Quantidade<input type="number" min={0} max={remaining} step={1} disabled={remaining === 0} value={adjustmentForm.quantities[item.id] || ''} onChange={(event) => { const parsed = Math.max(0, Math.min(remaining, Number.parseInt(event.target.value || '0', 10) || 0)); setAdjustmentForm((current) => current ? { ...current, quantities: { ...current.quantities, [item.id]: parsed } } : current); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" /></label><div className="sm:text-right"><p className="text-xs font-bold text-slate-400">Valor original selecionado</p><p className="font-black text-slate-800 dark:text-slate-100">{currency.format(originalUnitNet * (adjustmentForm.quantities[item.id] || 0))}</p></div></div>;
                })}</div>
                <SalePartialReturnQuotePreview storeId={storeId || ''} orderId={saleId || ''} items={selectedReturnItems} />
              </div> : <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><p className="font-black">Estorno total restante: {currency.format(detail.remainingRefundable)}</p><p className="mt-1 font-semibold">O estoque retorna somente para quantidades que tiveram baixa física vinculada. Divergências sem baixa não geram estoque fictício.</p></div>}
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 p-5 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setAdjustmentForm(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700">Voltar sem alterar</button>
              <button type="button" onClick={() => void submitAdjustment()} disabled={adjustmentSaving || !adjustmentForm.refundPaymentMethodCode || !adjustmentForm.refundAccountId || financialAccounts.length === 0 || financialPaymentMethods.length === 0} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50 ${adjustmentForm.type === 'full_cancellation' ? 'bg-red-600' : 'bg-amber-600'}`}>{adjustmentSaving ? <Loader2 size={15} className="animate-spin" /> : adjustmentForm.type === 'full_cancellation' ? <RotateCcw size={15} /> : <Undo2 size={15} />}{adjustmentForm.type === 'full_cancellation' ? 'Confirmar cancelamento e estorno' : 'Confirmar devolução parcial'}</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
