import { ArrowRightLeft, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDateTimePtBr } from '@/utils/dateTime';
import { formatNumberPtBr } from '@/utils/export/formatters';
import { getMovementStockPath } from '../utils/productMovementNarrative';
import { getTransferDivergenceReasonLabel, getTransferDivergenceResolutionLabel } from '../utils/productMovementNarrative';
import { summarizeTransferJourney, type ProductTransferJourney } from '../utils/productTransferJourney';

/** Um documento TRF, com vários eventos auditáveis, sem novos ajustes de saldo. */
export function ProductTransferJourneyCard({ journey, expanded, onToggle }: {
  journey: ProductTransferJourney; expanded: boolean; onToggle: () => void;
}) {
  const info=summarizeTransferJourney(journey);
  const hasDifference=info.divergence>0;
  const quantity=(value:number)=>formatNumberPtBr(value);
  const stageTone='rounded-xl border border-slate-200 bg-white/80 p-3 dark:border-slate-700 dark:bg-slate-900/60';
  return <article className={`overflow-hidden rounded-2xl border text-slate-900 shadow-sm dark:text-slate-100 ${hasDifference
    ? 'border-amber-200 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/25'
    : 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'}`}>
    <button type="button" aria-expanded={expanded} onClick={onToggle}
      className="flex min-h-16 w-full items-start gap-3 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 sm:p-4">
      <ArrowRightLeft size={19} className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true"/>
      <span className="min-w-0 flex-1">
        <strong className="block break-words text-sm">Transferência {info.code}</strong>
        <span className="mt-1 block text-xs">{info.source || 'Origem'} → {info.destination || 'Destino'}</span>
        <span className="mt-1 block text-xs">Enviado {quantity(info.shipped)} · Recebido {quantity(info.received)}{hasDifference ? ` · Diferença ${quantity(info.divergence)}` : ''}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className={`max-w-32 rounded-full px-2 py-1 text-center text-[11px] font-bold ${hasDifference
          ? 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100'
          : 'bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100'}`}>{info.status}</span>
        {expanded?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
      </span>
    </button>
    {expanded&&<div role="region" aria-label={`Etapas da transferência ${info.code}`} className="space-y-3 border-t border-current/10 p-3 text-xs sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className={stageTone}>Enviado<strong className="mt-1 block text-sm">{quantity(info.shipped)}</strong></div>
        <div className={stageTone}>Recebido<strong className="mt-1 block text-sm">{quantity(info.received)}</strong></div>
        <div className={stageTone}>Perda<strong className="mt-1 block text-sm">{quantity(info.loss)}</strong></div>
        <div className={stageTone}>Devolvido à origem<strong className="mt-1 block text-sm">{quantity(info.returned)}</strong></div>
      </div>
      <div className="space-y-2">
        {journey.events.map(event=>event.kind==='movement' ? (
          <div key={event.id} className={stageTone}>
            <span className="font-black">{event.movement.type==='exit' ? 'Remessa enviada' : event.movement.type==='entry' ? 'Recebimento registrado' : 'Movimento da transferência'}</span>
            <span className="ml-2 text-slate-600 dark:text-slate-300">{formatDateTimePtBr(event.movement.created_at)}</span>
            <p className="mt-1">Local: {event.movement.location_name || 'Não identificado'} · Quantidade: {quantity(Math.abs(Number(event.movement.quantity||0)))}</p>
            <p>Estoque físico nesse local: <strong>{getMovementStockPath(event.movement)}</strong></p>
          </div>
        ) : (
          <div key={event.id} className="rounded-xl border border-amber-300 bg-amber-100/70 p-3 dark:border-amber-800 dark:bg-amber-950/40">
            <strong className="inline-flex items-center gap-2"><AlertTriangle size={15}/> Conferência com divergência · {quantity(Number(event.divergence.divergence_qty||0))} un.</strong>
            <p className="mt-1">{formatDateTimePtBr(event.divergence.received_at||event.divergence.created_at||'')}</p>
            <p>Resolução: {getTransferDivergenceResolutionLabel(event.divergence.divergence_resolution)}</p>
            <p>Motivo: {getTransferDivergenceReasonLabel(event.divergence.divergence_reason)}</p>
            {event.divergence.divergence_notes&&<p>Observação: {event.divergence.divergence_notes}</p>}
            <p>Perda {quantity(Number(event.divergence.loss_qty||0))} · Retorno {quantity(Number(event.divergence.returned_to_origin_qty||0))} · Falta aceita {quantity(Number(event.divergence.accepted_shortage_qty||0))}</p>
          </div>
        ))}
      </div>
      <p className="text-slate-600 dark:text-slate-300">Esta é a sequência de movimentos registrados. Rascunhos não geram saída física. Quantidades enviadas não devem ser descontadas novamente do estoque disponível.</p>
      <Link to={`/admin/transfers/${journey.transferId}`} className="inline-flex min-h-10 items-center rounded-xl border border-emerald-300 px-3 py-2 font-bold text-emerald-800 underline dark:border-emerald-700 dark:text-emerald-200">
        Abrir documento TRF e conferir status
      </Link>
    </div>}
  </article>;
}
