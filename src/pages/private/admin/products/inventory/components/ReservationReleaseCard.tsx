import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { formatDateTimePtBr } from '@/utils/dateTime';
import { formatNumberPtBr } from '@/utils/export/formatters';
import type { ReservationReleaseEvent } from '../utils/reservationLifecycleEvents';

/** Projeção somente leitura do cancelamento auditado da reserva, sem nova entrada física. */
export function ReservationReleaseCard({ release, expanded, onToggle }: {
  release: ReservationReleaseEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className="flex min-h-16 w-full items-start gap-3 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 sm:p-4">
        <RotateCcw size={18} className="mt-0.5 shrink-0" aria-hidden="true"/>
        <span className="min-w-0 flex-1">
          <strong className="block text-sm">Reserva liberada · {formatNumberPtBr(release.quantity)} un.</strong>
          <span className="mt-1 block text-xs">{release.reason} · {release.orderCode}</span>
          <span className="mt-1 block text-xs opacity-80">{formatDateTimePtBr(release.date)} · {release.location || 'Local não identificado'}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
          <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-bold dark:bg-slate-950/40">Liberada</span>
          {expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
        </span>
      </button>
      {expanded && (
        <div role="region" aria-label="Detalhes da liberação da reserva" className="space-y-2 border-t border-emerald-200 p-3 text-xs dark:border-emerald-800 sm:p-4">
          <p><strong>Reserva criada:</strong> {formatDateTimePtBr(release.createdAt)}</p>
          <p><strong>Reserva liberada:</strong> {formatDateTimePtBr(release.date)}</p>
          <p><strong>Quantidade:</strong> {formatNumberPtBr(release.quantity)} unidades liberadas para novas reservas, respeitando o saldo físico.</p>
          <p><strong>Estoque físico:</strong> inalterado. Não é compra nem nova entrada no estoque.</p>
          <p><strong>Pedido:</strong> {release.orderCode}</p>
          <p><strong>Motivo:</strong> {release.reason}</p>
          <p className="opacity-80">Evento derivado da reserva cancelada, sem efetuar movimentação.</p>
        </div>
      )}
    </article>
  );
}
