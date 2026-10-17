import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, Clock3, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  CANCELLATION_ACTIVE_STATUSES, CANCELLATION_STATUS_LABELS,
  OrderCancellationRequestService, type CancellationRequest,
} from '@/services/orderCancellationRequestService';

function dateLabel(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

export function CustomerOrderCancellationPanel({
  orderId, orderStatus, paymentStatus, requests, onChanged,
}: {
  orderId: string;
  orderStatus: string | null | undefined;
  paymentStatus?: string | null;
  requests: CancellationRequest[];
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const related = requests.filter(r => r.order_id === orderId)
    .sort((a,b) => Date.parse(b.requested_at) - Date.parse(a.requested_at));
  const active = related.find(r => CANCELLATION_ACTIVE_STATUSES.includes(r.status));
  const latest = active || related[0];
  if (orderStatus === 'cancelled') return null;
  const isCompleted = orderStatus === 'completed';
  const isSimple = orderStatus === 'reserved' && ['pending','failed',null,undefined].includes(paymentStatus);
  const title = isCompleted ? 'Relatar ocorrência / solicitar devolução' : 'Solicitar cancelamento';
  async function submit() {
    setBusy(true);
    try {
      const result = await OrderCancellationRequestService.request(orderId, reason);
      await onChanged();
      setReason('');
      setOpen(false);
      toast.success(result.already_exists ? 'Já existe uma solicitação em andamento.' : 'Sua solicitação foi recebida para análise da loja.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section aria-label="Solicitação de cancelamento do pedido" className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
      {latest && (
        <div aria-live="polite" className="space-y-2">
          <p className="font-bold text-slate-900 dark:text-slate-100">
            {latest.request_type === 'post_delivery_occurrence' ? 'Ocorrência / devolução' : 'Cancelamento solicitado'}
          </p>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{CANCELLATION_STATUS_LABELS[latest.status]}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Solicitado em {dateLabel(latest.requested_at)}</p>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300"><strong>Motivo:</strong> {latest.reason}</p>
          {latest.decision_note && <p className="whitespace-pre-wrap break-words text-sm text-slate-700 dark:text-slate-300"><strong>Resposta da loja:</strong> {latest.decision_note}</p>}
          {!!latest.events?.length && (
            <details className="rounded-xl bg-slate-50 p-2 dark:bg-slate-900">
              <summary className="cursor-pointer font-semibold">Histórico da solicitação</summary>
              <ol className="mt-2 space-y-2 border-l-2 border-emerald-200 pl-3 dark:border-emerald-800">
                {latest.events.map(event => (
                  <li key={event.id} className="text-xs text-slate-600 dark:text-slate-300">
                    <strong>{CANCELLATION_STATUS_LABELS[event.status]}</strong> · {dateLabel(event.at)}
                    {event.note && <p className="mt-0.5 whitespace-pre-wrap break-words">{event.note}</p>}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {active && <p className="text-xs text-amber-800 dark:text-amber-300">Solicitação em andamento. O pedido, o estoque e o pagamento não foram alterados automaticamente.</p>}
        </div>
      )}
      {!active && (
        <div className={latest ? 'mt-3 border-t border-slate-200 pt-3 dark:border-slate-700' : ''}>
          <button type="button" onClick={() => setOpen(x => !x)} aria-expanded={open}
            className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-left font-bold text-slate-700 dark:border-slate-700 dark:text-slate-200">
            {title} {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {open && (
            <div className="mt-3 space-y-3">
              <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                {isCompleted
                  ? 'Pedidos concluídos exigem análise de ocorrência ou devolução. Esta solicitação não desfaz a entrega.'
                  : isSimple
                    ? 'Se o pedido ainda está reservado e não foi pago, você também pode usar Cancelar pedido para liberar a reserva imediatamente.'
                    : 'A loja avaliará seu pedido. Pagamentos confirmados dependem de estorno real; pedidos em rota exigem retorno e conferência física. Nenhuma operação é cancelada automaticamente.'}
              </p>
              <label className="block font-bold text-slate-700 dark:text-slate-200">
                Motivo da solicitação
                <textarea value={reason} onChange={e=>setReason(e.target.value.slice(0,700))}
                  rows={3} maxLength={700} placeholder="Explique o motivo (mínimo 8 caracteres)"
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </label>
              <button type="button" onClick={() => void submit()} disabled={busy || reason.trim().length<8}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 font-black text-white disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                {busy ? 'Enviando…' : 'Enviar para análise da loja'}
              </button>
            </div>
          )}
        </div>
      )}
      {latest?.status==='rejected' && <p className="mt-2 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300"><AlertCircle size={14}/> Você pode enviar nova solicitação com mais informações.</p>}
    </section>
  );
}
