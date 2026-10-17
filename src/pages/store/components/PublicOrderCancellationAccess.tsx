import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { AuthService } from '@/services/customerAuth';
import { CustomerService } from '@/services/customerService';
import { CustomerOrderCancellationPanel } from '@/pages/store/components/CustomerOrderCancellationPanel';
import { OrderCancellationRequestService, type CancellationRequest } from '@/services/orderCancellationRequestService';

type OwnOrder = { id: string; order_code?: string | null; status?: string|null; payment_status?: string|null };

export function PublicOrderCancellationAccess({
  orderCode, storeSlug, status,
}: { orderCode: string; storeSlug: string; status: string }) {
  const [ownOrder, setOwnOrder] = useState<OwnOrder | null>(null);
  const [requests, setRequests] = useState<CancellationRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => setRequests(await OrderCancellationRequestService.myRequests()),[]);
  const verify = async () => {
    setBusy(true);
    try {
      // A public tracking token is NOT permission to mutate or read cancellation records.
      // Resolve the actual owner using the independently authenticated customer JWT.
      const session = await AuthService.restoreSession();
      if (!session?.customer) {
        setOwnOrder(null);
        setChecked(true);
        return;
      }
      const orders = await CustomerService.getOrders() as OwnOrder[];
      const candidate = orders.find(x=>x.order_code===orderCode) || null;
      setOwnOrder(candidate);
      if (candidate) await refresh();
      setChecked(true);
    } catch {
      setOwnOrder(null);
      setChecked(true);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!ownOrder) return;
    const t = window.setInterval(() => { if (document.visibilityState==='visible') void refresh().catch(()=>undefined); },15000);
    return () => window.clearInterval(t);
  },[ownOrder,refresh]);

  if (status==='cancelled') return null;
  return (
    <section aria-label="Cancelar pedido ou relatar ocorrência" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <ShieldCheck size={18} className="text-emerald-600"/> Cancelamento e ocorrências
      </div>
      {!ownOrder && (
        <div className="mt-3 space-y-3 text-sm text-slate-600">
          <p>O link público permite acompanhar o pedido, mas solicitar cancelamento exige entrar na conta do cliente desta loja.</p>
          <button type="button" disabled={busy} onClick={() => void verify()}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 font-bold text-white disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin"/>} Verificar minha conta
          </button>
          {checked && <p className="text-xs">Nenhuma sessão desta conta foi encontrada ou este pedido não está no seu histórico.</p>}
          <Link className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-200 px-3 text-center font-bold text-emerald-700"
            to={`/loja/${encodeURIComponent(storeSlug)}`}>
            Entrar na loja e abrir Meus pedidos
          </Link>
        </div>
      )}
      {ownOrder && (
        <CustomerOrderCancellationPanel
          orderId={ownOrder.id}
          orderStatus={ownOrder.status}
          paymentStatus={ownOrder.payment_status}
          requests={requests}
          onChanged={refresh}
        />
      )}
    </section>
  );
}
