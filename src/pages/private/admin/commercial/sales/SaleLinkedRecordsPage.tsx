import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Boxes,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  WalletCards,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import PageContainer from '@/components/common/PageContainer';
import { getActiveStoreId } from '@/utils/activeStore';
import { SaleDetailService, type SaleDetailResult } from '@/services/saleDetailService';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const movementTypeLabels: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  reservation: 'Reserva',
  confirmation: 'Baixa do pedido',
  cancellation: 'Cancelamento de reserva',
  clearance: 'Zeramento',
};

const movementReasonLabels: Record<string, string> = {
  public_order_completed: 'Venda da loja pública concluída',
  direct_sale_completed: 'Venda direta concluída',
  pdv_sale_completed: 'Venda no PDV concluída',
  sale_partial_return: 'Devolução parcial da venda',
  sale_full_cancellation_return: 'Retorno ao estoque por cancelamento da venda',
  return_after_confirm: 'Retorno ao estoque após confirmação',
};

const financeTypeLabels: Record<string, string> = {
  sale: 'Recebimento da venda',
  refund: 'Estorno / devolução',
  adjustment: 'Ajuste financeiro',
  transfer: 'Transferência',
  manual_income: 'Entrada manual',
  manual_expense: 'Saída manual',
  other: 'Outro lançamento',
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : dateTime.format(date);
}

function friendly(map: Record<string, string>, value?: string | null, fallback = 'Não informado') {
  return map[value || ''] || value?.replaceAll('_', ' ') || fallback;
}

export default function SaleLinkedRecordsPage() {
  const { saleId } = useParams<{ saleId: string }>();
  const storeId = getActiveStoreId();
  const navigate = useNavigate();
  const location = useLocation();
  const [detail, setDetail] = useState<SaleDetailResult | null>(null);
  const [loading, setLoading] = useState(true);

  const mode = useMemo<'stock' | 'cashbook' | 'account'>(() => {
    if (location.pathname.endsWith('/cashbook')) return 'cashbook';
    if (location.pathname.endsWith('/financial-account')) return 'account';
    return 'stock';
  }, [location.pathname]);

  const load = useCallback(async () => {
    if (!storeId || !saleId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setDetail(await SaleDetailService.get(storeId, saleId));
    } catch (error) {
      setDetail(null);
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar os registros desta venda.');
    } finally {
      setLoading(false);
    }
  }, [saleId, storeId]);

  useEffect(() => { void load(); }, [load]);

  const title = mode === 'stock'
    ? 'Movimentações desta venda'
    : mode === 'cashbook'
      ? 'Livro Diário desta venda'
      : 'Conta financeira desta venda';

  const subtitle = mode === 'stock'
    ? 'Somente baixas, retornos, reservas e divergências vinculadas a esta venda.'
    : mode === 'cashbook'
      ? 'Somente os lançamentos do Livro Diário vinculados a esta venda, incluindo estornos.'
      : 'Somente a rota financeira usada por esta venda e por eventuais estornos.';

  if (loading) {
    return <PageContainer title={title} withoutHeader><div className="flex min-h-72 items-center justify-center"><Loader2 className="animate-spin text-teal-600" size={28} /></div></PageContainer>;
  }

  if (!detail) {
    return <PageContainer title={title} withoutHeader><div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><p className="font-black">Registros indisponíveis.</p><button type="button" onClick={() => navigate(-1)} className="mt-4 inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black"><ArrowLeft size={16} />Voltar</button></div></PageContainer>;
  }

  const { order, stock, finance } = detail;

  return (
    <PageContainer title={title} withoutHeader>
      <div className="space-y-5 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <button type="button" onClick={() => navigate(-1)} className="mb-3 inline-flex items-center gap-2 text-sm font-black text-teal-700 dark:text-teal-300"><ArrowLeft size={16} />Voltar</button>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-600 dark:text-teal-300">{order.order_code || 'Venda'}</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{title}</h1>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-400">{subtitle}</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><RefreshCw size={16} />Atualizar</button>
        </div>

        {mode === 'stock' && (
          <>
            {!detail.canViewStock ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Seu perfil não possui permissão para visualizar o estoque desta venda.</div>
            ) : (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-4 flex items-center gap-2"><Boxes className="text-teal-600 dark:text-teal-300" size={19} /><h2 className="font-black">Movimentações físicas vinculadas</h2></div>
                  {stock.movements.length === 0 ? <p className="text-sm font-semibold text-slate-500">Nenhuma movimentação vinculada.</p> : <div className="space-y-2">{stock.movements.map((movement) => (
                    <div key={movement.id} className="grid gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800 md:grid-cols-[minmax(200px,1fr)_120px_150px_170px] md:items-center">
                      <div><p className="font-black">{movement.product_name}</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{movement.reason || friendly(movementReasonLabels, movement.reason_code, 'Movimentação vinculada')}</p><p className="mt-1 text-[11px] font-bold text-slate-400">{friendly(movementTypeLabels, movement.type)} · {formatDate(movement.created_at)}</p></div>
                      <div><p className="text-xs font-bold text-slate-400">Quantidade</p><p className={`font-black ${movement.quantity < 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</p></div>
                      <div><p className="text-xs font-bold text-slate-400">Saldo físico</p><p className="font-black">{movement.previous_stock ?? '—'} → {movement.new_stock ?? '—'}</p></div>
                      <div><p className="text-xs font-bold text-slate-400">Local</p><p className="font-black">{movement.location_name || movement.from_location_name || movement.to_location_name || 'Não informado'}</p></div>
                    </div>
                  ))}</div>}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="mb-3 flex items-center gap-2"><PackageCheck className="text-blue-600 dark:text-blue-300" size={18} /><h2 className="font-black">Reservas vinculadas</h2></div>
                  {stock.reservations.length === 0 ? <p className="text-sm font-semibold text-slate-500">Esta venda não utilizou reserva.</p> : <div className="flex flex-wrap gap-2">{stock.reservations.map((reservation) => <span key={reservation.id} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold dark:border-slate-700">{reservation.product_name} · {reservation.quantity} un. · {reservation.status === 'consumed' ? 'Consumida' : reservation.status === 'cancelled' ? 'Cancelada' : reservation.status === 'expired' ? 'Expirada' : 'Ativa'} · {reservation.location_name || 'Local não informado'}</span>)}</div>}
                </section>

                {stock.discrepancies.length > 0 && <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20"><h2 className="font-black text-amber-900 dark:text-amber-200">Divergências vinculadas</h2><div className="mt-3 space-y-2">{stock.discrepancies.map((item) => <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-3 text-sm dark:border-amber-900 dark:bg-slate-900"><strong>{item.status === 'waiting_stock_count' ? 'Aguardando contagem física' : item.status === 'under_review' ? 'Em análise' : item.status === 'resolved' ? 'Resolvida' : item.status === 'cancelled' ? 'Cancelada' : 'Aberta'}</strong>{item.resolution_notes && <p className="mt-1 text-xs font-semibold text-slate-500">{item.resolution_notes}</p>}</div>)}</div></section>}

                <div className="flex flex-wrap gap-2"><Link to="/admin/stock/movements" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700">Abrir movimentações completas <ExternalLink size={14} /></Link><Link to={`/admin/sales/${order.id}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white">Detalhe da venda</Link></div>
              </>
            )}
          </>
        )}

        {mode === 'cashbook' && (
          <>
            {!detail.canViewFinance ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Seu perfil não possui permissão para visualizar o financeiro desta venda.</div>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-2"><ReceiptText className="text-teal-600 dark:text-teal-300" size={19} /><h2 className="font-black">Lançamentos vinculados</h2></div>
                {finance.entries.length === 0 ? <p className="text-sm font-semibold text-slate-500">Nenhum lançamento do Livro Diário vinculado.</p> : <div className="space-y-2">{finance.entries.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-black">{entry.entry_code || 'Lançamento'}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{friendly(financeTypeLabels, entry.type)} · {formatDate(entry.occurred_at)}</p><p className="mt-1 text-sm font-semibold">{entry.description}</p></div><p className={`text-xl font-black ${entry.direction === 'out' ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{entry.direction === 'out' ? '-' : '+'}{currency.format(entry.amount)}</p></div>
                    <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800 sm:grid-cols-2 lg:grid-cols-4"><span>Forma: <strong>{entry.payment_method_name || entry.payment_method_code || 'Não informada'}</strong></span><span>Status: <strong>{entry.status === 'confirmed' ? 'Confirmado' : entry.status === 'cancelled' ? 'Cancelado' : 'Rascunho'}</strong></span><span>Conta: <strong>{entry.destination_financial_account_name || entry.source_financial_account_name || 'Não distribuído'}</strong></span><span>Saldo: <strong>{entry.affects_balance ? 'Afeta saldo' : 'Não afeta saldo'}</strong></span></div>
                  </div>
                ))}</div>}
              </section>
            )}
            <div className="flex flex-wrap gap-2"><Link to="/admin/cashbook" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700">Abrir Livro Diário completo <ExternalLink size={14} /></Link><Link to={`/admin/sales/${order.id}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white">Detalhe da venda</Link></div>
          </>
        )}

        {mode === 'account' && (
          <>
            {!detail.canViewFinance ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Seu perfil não possui permissão para visualizar as contas financeiras desta venda.</div>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-4 flex items-center gap-2"><WalletCards className="text-teal-600 dark:text-teal-300" size={19} /><h2 className="font-black">Rota financeira da venda</h2></div>
                {finance.entries.length === 0 ? <p className="text-sm font-semibold text-slate-500">Nenhuma conta financeira vinculada.</p> : <div className="space-y-2">{finance.entries.map((entry) => {
                  const isOut = entry.direction === 'out';
                  const accountName = isOut
                    ? entry.source_financial_account_name || entry.destination_financial_account_name
                    : entry.destination_financial_account_name || entry.source_financial_account_name;
                  return <div key={entry.id} className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"><div className="flex flex-col gap-2 sm:flex-row sm:justify-between"><div><p className="font-black">{accountName || 'Não distribuído'}</p><p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">{entry.entry_code || 'Lançamento'} · {entry.payment_method_name || entry.payment_method_code || 'Forma não informada'} · {formatDate(entry.occurred_at)}</p><p className="mt-1 text-sm font-bold">{friendly(financeTypeLabels, entry.type)}</p></div><p className={`text-xl font-black ${isOut ? 'text-red-600 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>{isOut ? '-' : '+'}{currency.format(entry.amount)}</p></div></div>;
                })}</div>}
                {finance.routeAudit.length > 0 && <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800"><h3 className="font-black">Histórico de alterações de rota</h3><div className="mt-2 space-y-2">{finance.routeAudit.map((audit) => <div key={audit.id} className="rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-600 dark:bg-slate-950 dark:text-slate-300"><strong>{formatDate(audit.created_at)}</strong> · {audit.old_destination_financial_account_name || audit.old_source_financial_account_name || 'Não distribuído'} → {audit.new_destination_financial_account_name || audit.new_source_financial_account_name || 'Não distribuído'}{audit.reason ? ` · ${audit.reason}` : ''}</div>)}</div></div>}
              </section>
            )}
            <div className="flex flex-wrap gap-2"><Link to="/admin/financial-accounts?tab=balances" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-black dark:border-slate-700"><CircleDollarSign size={15} />Abrir Contas financeiras <ExternalLink size={14} /></Link><Link to={`/admin/sales/${order.id}`} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-black text-white">Detalhe da venda</Link></div>
          </>
        )}
      </div>
    </PageContainer>
  );
}
