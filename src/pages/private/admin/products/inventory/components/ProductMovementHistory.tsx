import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ArrowRightLeft, History, PackageCheck, AlertTriangle } from 'lucide-react';
import type { ProductStockMovementRow } from '@/services/stockService';
import type { ProductTransferDivergence } from '../services/productLifecycleService';
import type { ProductPurchaseReceiptIssue, ProductPhysicalDiscrepancy } from '../services/productOperationalOccurrencesService';
import { PurchaseIssueCard, PhysicalIssueCard } from './ProductOperationalIssueCards';
import { formatDateTimePtBr } from '@/utils/dateTime';
import { formatNumberPtBr } from '@/utils/export/formatters';
import { getShortDocumentReference, getDocumentReferenceTitle, humanizeTextReferences } from '@/utils/documentReference';
import {
  getMovementOperationLabel, getMovementDirectionLabel,
  getMovementHumanDescription, getMovementOriginLabel,
  getMovementDestinationLabel, getMovementReferenceLabel,
  getMovementStockPath, getMovementToneClass,
  getTransferDivergenceReasonLabel, getTransferDivergenceResolutionLabel,
} from '../utils/productMovementNarrative';

export type ProductTimelineItem =
  | { kind: 'movement'; id: string; movement: ProductStockMovementRow }
  | { kind: 'divergence'; id: string; divergence: ProductTransferDivergence }
  | { kind: 'purchase_issue'; id: string; issue: ProductPurchaseReceiptIssue }
  | { kind: 'physical_issue'; id: string; occurrence: ProductPhysicalDiscrepancy };

export function getTimelineEventKey(item: ProductTimelineItem) {
  return `${item.kind}:${item.id}`;
}

function MovementCard({ movement, expanded, onToggle }: {
  movement: ProductStockMovementRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const kind = String(movement.source ?? '').toLowerCase();
  const type = String(movement.type ?? '').toLowerCase();
  const isTransfer = kind === 'stock_transfer';
  const title = getMovementOperationLabel(movement);
  const quantity = Math.abs(Number(movement.quantity ?? 0));
  const rawReference = movement.transfer_code || movement.purchase_document_number
    || (typeof movement.metadata?.order_code === 'string' ? movement.metadata.order_code : null)
    || movement.source_id || '';
  const reference = getMovementReferenceLabel(movement);
  const transferId = movement.transfer_id;
  const physical = movement.affects_physical !== false && type !== 'reservation';
  return (
    <article className={`overflow-hidden rounded-2xl border shadow-sm ${getMovementToneClass(movement)}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className="flex min-h-16 w-full items-start justify-between gap-3 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500 sm:p-4">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          {isTransfer ? <ArrowRightLeft size={19} className="mt-0.5 shrink-0" aria-hidden="true"/> : <History size={19} className="mt-0.5 shrink-0" aria-hidden="true"/>}
          <span className="min-w-0">
            <strong className="block text-sm">{title} · {formatNumberPtBr(quantity)} un.</strong>
            <span className="mt-1 block text-xs leading-5">{humanizeTextReferences(getMovementHumanDescription(movement))}</span>
            <span className="mt-1 block text-xs opacity-80">
              {formatDateTimePtBr(movement.created_at)}
              {reference ? ` · ${reference}` : ''}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="rounded-lg bg-white/70 px-2 py-1 text-xs font-bold dark:bg-gray-950/40">
            {getMovementDirectionLabel(movement)}
          </span>
          {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
        </span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-current/15 px-3 py-3 text-xs sm:px-4" role="region" aria-label={`Detalhes de ${title}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-950/30">
              <span className="block font-medium opacity-70">Local afetado</span>
              <strong className="mt-1 block">{movement.location_name || 'Não identificado'}</strong>
            </div>
            <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-950/30">
              <span className="block font-medium opacity-70">Origem</span>
              <strong className="mt-1 block">{getMovementOriginLabel(movement)}</strong>
            </div>
            <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-950/30">
              <span className="block font-medium opacity-70">Destino</span>
              <strong className="mt-1 block">{getMovementDestinationLabel(movement)}</strong>
            </div>
          </div>
          <div className="rounded-xl bg-white/70 p-3 dark:bg-gray-950/30">
            <span className="block font-medium opacity-70">{physical ? 'Estoque físico neste local' : 'Efeito no estoque físico'}</span>
            <strong className="mt-1 block text-sm">{getMovementStockPath(movement)}</strong>
            {!physical && <span className="mt-1 block">Reserva ou movimento informativo; não representa nova baixa física.</span>}
            {isTransfer && <span className="mt-1 block">Enviado e recebido são eventos separados: não desconte a remessa duas vezes.</span>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span title={getDocumentReferenceTitle(rawReference)} className="font-semibold break-all">Documento: {reference || 'Não informado'}</span>
            {isTransfer && transferId && (
              <Link to={`/admin/transfers/${transferId}`} className="min-h-9 rounded-lg border border-current/30 px-3 py-2 font-bold underline">
                Abrir transferência
              </Link>
            )}
          </div>
          {movement.reason && <p className="rounded-lg bg-white/60 p-2.5 dark:bg-gray-950/30"><strong>Motivo:</strong> {humanizeTextReferences(movement.reason)}</p>}
        </div>
      )}
    </article>
  );
}

function DivergenceCard({ divergence, expanded, onToggle }: {
  divergence: ProductTransferDivergence;
  expanded: boolean;
  onToggle: () => void;
}) {
  const rawCode = divergence.transfer_code || divergence.transfer_id || '';
  const quantity = Number(divergence.divergence_qty ?? 0);
  const date = divergence.received_at || divergence.created_at;
  const resolution = getTransferDivergenceResolutionLabel(divergence.divergence_resolution);
  return (
    <article className="overflow-hidden rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <button type="button" onClick={onToggle} aria-expanded={expanded}
        className="flex min-h-16 w-full items-start justify-between gap-3 p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600 sm:p-4">
        <span className="flex min-w-0 flex-1 items-start gap-2.5">
          <AlertTriangle size={19} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true"/>
          <span>
            <strong className="block text-sm">Divergência na transferência · {formatNumberPtBr(quantity)} un.</strong>
            <span className="mt-1 block text-xs leading-5">
              {divergence.source_location_name || 'Origem'} → {divergence.destination_location_name || 'Destino'} · {resolution}
            </span>
            <span className="mt-1 block text-xs opacity-85">
              {formatDateTimePtBr(date)} · {getShortDocumentReference(rawCode, { fallbackLabel: 'Transferência' })}
            </span>
          </span>
        </span>
        {expanded ? <ChevronUp size={18} className="shrink-0"/> : <ChevronDown size={18} className="shrink-0"/>}
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-amber-300 p-3 text-xs dark:border-amber-800 sm:p-4" role="region" aria-label="Detalhes da divergência">
          <p className="font-semibold">A diferença já foi registrada na conferência da TRF. Este histórico não gera novo ajuste.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([
              ['Enviado',divergence.shipped_qty], ['Recebido',divergence.received_qty],
              ['Perda',divergence.loss_qty], ['Retorno à origem',divergence.returned_to_origin_qty],
              ['Falta aceita',divergence.accepted_shortage_qty],
            ] as const).map(([title,value])=>(
              <div key={title} className="rounded-lg bg-white/75 p-3 dark:bg-gray-950/35">
                <span className="block opacity-75">{title}</span>
                <strong className="mt-1 block text-sm">{formatNumberPtBr(Number(value ?? 0))}</strong>
              </div>
            ))}
          </div>
          <p><strong>Motivo:</strong> {getTransferDivergenceReasonLabel(divergence.divergence_reason)}</p>
          {divergence.divergence_notes && <p><strong>Observação:</strong> {humanizeTextReferences(divergence.divergence_notes)}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <span title={getDocumentReferenceTitle(rawCode)} className="break-all font-semibold">TRF: {getShortDocumentReference(rawCode, { fallbackLabel: 'Transferência' })}</span>
            {divergence.transfer_id && <Link to={`/admin/transfers/${divergence.transfer_id}`} className="min-h-9 rounded-lg border border-amber-400 px-3 py-2 font-bold underline dark:border-amber-700">Ver TRF completa</Link>}
          </div>
        </div>
      )}
    </article>
  );
}

export function ProductMovementHistory({ items }: { items: ProductTimelineItem[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const allExpanded = items.length > 0 && items.every(item=>expanded.has(getTimelineEventKey(item)));
  const toggleAll = () => setExpanded(allExpanded ? new Set() : new Set(items.map(getTimelineEventKey)));
  const toggleOne = (key: string) => setExpanded(current=>{
    const next=new Set(current);
    if(next.has(key))next.delete(key);else next.add(key);
    return next;
  });
  return (
    <section className="space-y-2" aria-label="Histórico de movimentações do produto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <PackageCheck size={14} className="mr-1 inline-block" aria-hidden="true"/>
          Resumo por ocorrência. Toque em ↓ para consultar saldo anterior, destino e documento.
        </p>
        <button type="button" onClick={toggleAll} disabled={items.length===0}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-bold text-gray-800 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
          {allExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
          {allExpanded ? 'Recolher tudo' : 'Expandir tudo'}
        </button>
      </div>
      {items.map(item=>{
        const key=getTimelineEventKey(item);
        if (item.kind === 'divergence') return <DivergenceCard key={key} divergence={item.divergence} expanded={expanded.has(key)} onToggle={()=>toggleOne(key)} />;
        if (item.kind === 'purchase_issue') return <PurchaseIssueCard key={key} issue={item.issue} expanded={expanded.has(key)} onToggle={()=>toggleOne(key)} />;
        if (item.kind === 'physical_issue') return <PhysicalIssueCard key={key} issue={item.occurrence} expanded={expanded.has(key)} onToggle={()=>toggleOne(key)} />;
        return <MovementCard key={key} movement={item.movement} expanded={expanded.has(key)} onToggle={()=>toggleOne(key)} />;
      })}
      {items.length===0 && <p className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">Nenhum evento corresponde aos filtros. Limpe ou ajuste os filtros para consultar o histórico.</p>}
    </section>
  );
}
