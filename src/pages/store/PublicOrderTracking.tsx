import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, PackageCheck, ShoppingBag, Store, XCircle } from 'lucide-react';
import { PublicOrderService, type PublicOrderTrackingResponse } from '@/services/publicOrderService';

const STATUS_LABELS: Record<string, string> = {
  reserved: 'Aguardando confirmação',
  pending: 'Pendente',
  confirmed: 'Confirmado pela loja',
  preparing: 'Em preparação',
  ready: 'Pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

function formatCurrency(value?: number | null) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusIcon(status?: string) {
  if (status === 'completed') return <PackageCheck className="h-6 w-6 text-emerald-600" />;
  if (status === 'cancelled' || status === 'expired') return <XCircle className="h-6 w-6 text-red-600" />;
  if (status === 'confirmed' || status === 'ready') return <CheckCircle2 className="h-6 w-6 text-emerald-600" />;
  return <Clock3 className="h-6 w-6 text-amber-600" />;
}

export default function PublicOrderTracking() {
  const { publicOrderToken } = useParams();
  const [data, setData] = useState<PublicOrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!publicOrderToken) {
        setError('Link de pedido inválido.');
        setLoading(false);
        return;
      }

      try {
        const result = await PublicOrderService.getPublicOrderByToken(publicOrderToken);
        if (!active) return;
        if (!result.ok || !result.order || !result.store) {
          setError('Pedido não encontrado ou link inválido.');
          return;
        }
        setData(result);
      } catch (err) {
        console.error('Erro ao consultar pedido público:', err);
        if (active) setError('Não foi possível carregar o pedido agora.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [publicOrderToken]);

  const shortCode = useMemo(() => {
    const code = data?.order?.order_code || '';
    const suffix = code.split('-').pop();
    return suffix ? `#${suffix}` : code;
  }, [data?.order?.order_code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center text-slate-600">
          <Clock3 className="mx-auto mb-3 h-8 w-8 animate-pulse" />
          Carregando pedido...
        </div>
      </div>
    );
  }

  if (error || !data?.order || !data.store) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-7 text-center shadow-sm">
          <XCircle className="mx-auto mb-4 h-10 w-10 text-red-500" />
          <h1 className="text-xl font-bold text-slate-900">Não foi possível abrir o pedido</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <Link to="/" className="mt-6 inline-flex rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">
            Ir para o início
          </Link>
        </div>
      </div>
    );
  }

  const { order, store } = data;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <main className="mx-auto max-w-2xl space-y-5">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            {store.logo_url ? (
              <img src={store.logo_url} alt={store.name} className="h-14 w-14 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
                <Store className="h-7 w-7 text-emerald-600" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-700">{store.name}</p>
              <h1 className="text-2xl font-black">Pedido {shortCode}</h1>
              <p className="mt-1 text-xs text-slate-500">Código completo: {order.order_code}</p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            {statusIcon(order.status)}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
              <p className="font-bold text-slate-900">{STATUS_LABELS[order.status] || order.status}</p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-bold">Itens do pedido</h2>
          </div>

          <div className="divide-y divide-slate-100">
            {order.items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold text-slate-900">{item.quantity}x {item.name}</p>
                  <p className="text-xs text-slate-500">{formatCurrency(item.unit_price)} cada</p>
                </div>
                <p className="font-bold text-slate-900">{formatCurrency(item.line_total)}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><strong>{formatCurrency(order.subtotal)}</strong></div>
            {Number(order.delivery_fee || 0) > 0 && (
              <div className="flex justify-between"><span className="text-slate-500">Entrega</span><strong>{formatCurrency(order.delivery_fee)}</strong></div>
            )}
            <div className="flex justify-between text-lg"><span className="font-bold">Total</span><strong className="text-emerald-700">{formatCurrency(order.total)}</strong></div>
          </div>
        </section>

        <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-6 text-sm shadow-sm sm:grid-cols-2">
          <div><span className="block text-xs text-slate-500">Cliente</span><strong>{order.customer_name || 'Cliente não identificado'}</strong></div>
          <div><span className="block text-xs text-slate-500">Criado em</span><strong>{formatDateTime(order.created_at)}</strong></div>
          <div><span className="block text-xs text-slate-500">Entrega/retirada</span><strong>{order.delivery_method_name || order.fulfillment_type}</strong></div>
          <div><span className="block text-xs text-slate-500">Pagamento</span><strong>{order.payment_method_name || 'A combinar'}</strong></div>
        </section>

        <div className="text-center">
          <Link to={`/s/${encodeURIComponent(store.slug)}`} className="inline-flex rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700">
            Voltar ao cardápio
          </Link>
        </div>
      </main>
    </div>
  );
}
