import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { formatDateTimePtBr } from '@/utils/dateTime';
import { formatNumberPtBr } from '@/utils/export/formatters';
import {
  getPhysicalDiscrepancyQuantity,
  type ProductPurchaseReceiptIssue,
  type ProductPhysicalDiscrepancy,
} from '../services/productOperationalOccurrencesService';

const issueTypes: Record<string, string> = {
  shortage: 'Falta na compra', damage: 'Avaria na compra',
  wrong_item: 'Produto incorreto', excess: 'Excesso na compra', other: 'Ressalva na compra',
};
const statusLabels: Record<string, string> = {
  waiting_supplier: 'Aguardando fornecedor', waiting_document: 'Aguardando documento',
  waiting_financial: 'Aguardando financeiro', under_review: 'Em análise',
  waiting_stock_count: 'Aguardando contagem', open: 'Aberta', resolved: 'Resolvida', cancelled: 'Cancelada',
};
const dispositionLabels: Record<string, string> = {
  awaiting_replacement: 'Reposição pelo fornecedor', discount: 'Abatimento',
  supplier_credit: 'Crédito do fornecedor', partial_return: 'Devolução parcial',
  accepted_closed: 'Diferença aceita', other: 'Outro tratamento',
};
const number = (value: unknown) => formatNumberPtBr(Number(value ?? 0));
const panel = 'rounded-xl bg-white/80 p-3 dark:bg-slate-950/40';
const badge = 'rounded-full border border-current/20 px-2 py-1 text-[11px] font-bold';

export function PurchaseIssueCard({ issue, expanded, onToggle }: {
  issue: ProductPurchaseReceiptIssue; expanded: boolean; onToggle: () => void;
}) {
  return <article className="overflow-hidden rounded-xl border border-sky-200 bg-sky-50 text-slate-900 dark:border-sky-800 dark:bg-slate-900 dark:text-slate-100">
    <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-16 w-full items-start gap-2 p-3 text-left">
      <ClipboardList size={19} className="mt-1 shrink-0 text-sky-700 dark:text-sky-300" />
      <span className="min-w-0 flex-1">
        <strong className="block text-sm">{issueTypes[issue.issue_type] || 'Ressalva de compra'} · {number(issue.quantity)} un.</strong>
        <span className="mt-1 block text-xs">{issue.supplier_name || 'Fornecedor não informado'} · {issue.issue_code}</span>
        <span className="mt-1 block text-xs opacity-70">{formatDateTimePtBr(issue.opened_at)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className={badge}>{statusLabels[issue.issue_status] || 'Registrada'}</span>
        {expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
      </span>
    </button>
    {expanded && <div role="region" className="space-y-3 border-t border-sky-200 p-3 text-xs dark:border-slate-700">
      <p>Ressalva da compra — somente consulta; não gera outra movimentação de estoque.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className={panel}>Quantidade: <strong>{number(issue.quantity)}</strong></div>
        <div className={panel}>Reposição pendente: <strong>{number(issue.replacement_pending_quantity)}</strong></div>
        <div className={panel}>Quantidade encerrada: <strong>{number(issue.physical_closed_quantity)}</strong></div>
      </div>
      <p><strong>Tratamento:</strong> {dispositionLabels[issue.disposition || ''] || 'Não informado'}</p>
      <p><strong>Documento:</strong> {issue.document_code || issue.issue_code}{issue.invoice_number ? ` · NF ${issue.invoice_number}` : ''}</p>
      {issue.notes && <p className={panel}><strong>Observação:</strong> {issue.notes}</p>}
      {issue.resolution_notes && <p className={panel}><strong>Resolução:</strong> {issue.resolution_notes}</p>}
      {issue.resolved_at && <p>Resolvida em {formatDateTimePtBr(issue.resolved_at)}</p>}
      <Link className="inline-flex min-h-10 items-center rounded-lg border border-sky-300 px-3 py-2 font-bold underline dark:border-sky-700" to={`/admin/stock/divergences?issue=${encodeURIComponent(issue.issue_code)}`}>Consultar na central de Divergências</Link>
    </div>}
  </article>;
}

export function PhysicalIssueCard({ issue, expanded, onToggle }: {
  issue: ProductPhysicalDiscrepancy; expanded: boolean; onToggle: () => void;
}) {
  const missing=getPhysicalDiscrepancyQuantity(issue);
  return <article className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50 text-slate-900 dark:border-amber-800 dark:bg-slate-900 dark:text-slate-100">
    <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex min-h-16 w-full items-start gap-2 p-3 text-left">
      <AlertTriangle size={19} className="mt-1 shrink-0 text-amber-700 dark:text-amber-300"/>
      <span className="min-w-0 flex-1">
        <strong className="block text-sm">Divergência física{missing > 0 ? ` · falta ${number(missing)} un.` : ''}</strong>
        <span className="mt-1 block text-xs">{issue.order_code || 'Sem pedido'} · {issue.location_name || 'Local não informado'}</span>
        <span className="mt-1 block text-xs opacity-70">{formatDateTimePtBr(issue.created_at)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className={badge}>{statusLabels[issue.status] || 'Registrada'}</span>
        {expanded ? <ChevronUp size={17}/> : <ChevronDown size={17}/>}
      </span>
    </button>
    {expanded && <div role="region" className="space-y-3 border-t border-amber-200 p-3 text-xs dark:border-slate-700">
      <p>Ocorrência já registrada; esta consulta não provoca nova baixa.</p>
      {issue.items.map((item,i)=><div key={i} className="grid grid-cols-3 gap-2">
        <div className={panel}>Solicitado: <strong>{number(item.requested_quantity ?? item.requested)}</strong></div>
        <div className={panel}>Disponível no evento: <strong>{number(item.available_quantity ?? item.available)}</strong></div>
        <div className={panel}>Falta: <strong>{number(item.shortage_quantity ?? item.shortage)}</strong></div>
      </div>)}
      {issue.opening_notes && <p className={panel}><strong>Descrição:</strong> {issue.opening_notes}</p>}
      {issue.resolution_notes && <p className={panel}><strong>Tratamento:</strong> {issue.resolution_notes}</p>}
      {issue.resolved_at && <p>Resolvida em {formatDateTimePtBr(issue.resolved_at)}</p>}
      <Link className="inline-flex min-h-10 items-center rounded-lg border border-amber-300 px-3 py-2 font-bold underline dark:border-amber-700" to="/admin/stock/divergences">Consultar central de Divergências</Link>
    </div>}
  </article>;
}
