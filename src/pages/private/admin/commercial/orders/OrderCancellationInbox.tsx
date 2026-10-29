import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Clock3, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { CANCELLATION_ACTIVE_STATUSES, CANCELLATION_STATUS_LABELS,
  OrderCancellationRequestService, type CancellationRequest } from '@/services/orderCancellationRequestService';

export function OrderCancellationInbox({ storeId, canReview }: { storeId: string | null; canReview: boolean }) {
  const [items, setItems] = useState<CancellationRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const refresh = useCallback(async () => {
    if (!storeId || !canReview) return;
    setLoading(true);
    try { setItems(await OrderCancellationRequestService.adminRequests(storeId)); }
    catch { /* Do not interrupt ordinary order operations on cancellation inbox issues. */ }
    finally { setLoading(false); }
  }, [storeId, canReview]);
  useEffect(() => {
    if (!storeId || !canReview) return;
    void refresh();
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    const onFocus = () => void refresh();
    window.addEventListener('focus',onFocus);
    return () => { window.clearInterval(interval);window.removeEventListener('focus',onFocus); };
  }, [refresh,storeId,canReview]);

  const outstanding = useMemo(() => items.filter(item => CANCELLATION_ACTIVE_STATUSES.includes(item.status)),[items]);
  if (!canReview || !storeId) return null;
  const format = (date: string) => new Date(date).toLocaleString('pt-BR');
  const decide = async (request: CancellationRequest, status: 'under_review' | 'awaiting_return' | 'rejected') => {
    setBusyId(request.id);
    try {
      await OrderCancellationRequestService.review(request.id,status,notes[request.id]||'');
      await refresh();
      toast.success('Análise da solicitação atualizada.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível registrar a decisão.');
    } finally { setBusyId(null); }
  };
  return (
    <section aria-label="Solicitações de cancelamento da loja"
      className="mb-3 shrink-0 rounded-2xl border border-amber-200 bg-white p-3 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
      <button type="button" aria-expanded={open} onClick={()=>setOpen(x=>!x)}
        className="flex min-h-11 w-full items-center gap-2 text-left text-sm font-black text-slate-900 dark:text-white">
        <AlertCircle className="h-5 w-5 text-amber-600" />
        <span className="flex-1">Solicitações de cancelamento / devolução ({outstanding.length} em análise)</span>
        {open?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
      </button>
      {open && (
        <div className="mt-3 max-h-[min(65vh,600px)] space-y-3 overflow-y-auto border-t border-slate-200 pt-3 dark:border-slate-700">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-300">
              Estas ações registram somente a análise. Não liberam estoque, não cancelam pedidos pagos e não efetuam estornos.
              Reversão física e financeira continuam bloqueadas pelos controles do RC.
            </p>
            <button type="button" onClick={() => void refresh()} disabled={loading}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
              <RefreshCw size={14} className={loading?'animate-spin':''}/>Atualizar
            </button>
          </div>
          {!items.length && <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhuma solicitação encontrada nesta loja.</p>}
          {items.map(item => {
            const actionable = CANCELLATION_ACTIVE_STATUSES.includes(item.status) && item.status !== 'refund_processing';
            return <article key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <strong className="text-sm text-slate-900 dark:text-white">{item.order_code || item.order_id.slice(0,8)}</strong>
                  <p className="mt-1 text-xs text-slate-500">{item.request_type==='post_delivery_occurrence'?'Ocorrência pós-entrega':'Pedido de cancelamento'} · {format(item.requested_at)}</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">{CANCELLATION_STATUS_LABELS[item.status]}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300"><strong>Motivo:</strong> {item.reason}</p>
              <p className="mt-1 text-xs text-slate-500">Pedido: {item.order_status || '—'} · Pagamento: {item.payment_status || '—'}</p>
              {item.decision_note && <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Última decisão: {item.decision_note}</p>}
              {actionable && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Observação / justificativa
                    <textarea rows={2} maxLength={700} value={notes[item.id]||''}
                      onChange={e=>setNotes(x=>({...x,[item.id]:e.target.value}))}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busyId===item.id} onClick={() => void decide(item,'under_review')} className="min-h-10 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-50">
                      {busyId===item.id?<Loader2 className="inline h-4 w-4 animate-spin"/>:<Clock3 className="inline h-4 w-4"/>} Em análise
                    </button>
                    {item.order_status==='out_for_delivery' && <button type="button" disabled={busyId===item.id} onClick={() => void decide(item,'awaiting_return')} className="min-h-10 rounded-xl border border-amber-300 px-3 text-xs font-bold text-amber-700 disabled:opacity-50 dark:text-amber-300">Aguardando retorno</button>}
                    <button type="button" disabled={busyId===item.id || (notes[item.id]||'').trim().length<8} onClick={() => void decide(item,'rejected')} className="min-h-10 rounded-xl border border-red-300 px-3 text-xs font-bold text-red-700 disabled:opacity-50 dark:text-red-300">Recusar com motivo</button>
                  </div>
                </div>
              )}
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
