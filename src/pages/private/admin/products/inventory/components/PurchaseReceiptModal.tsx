import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  FileWarning,
  History,
  PackageCheck,
  RotateCcw,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  buildPurchaseReceiptProgress,
  type PurchaseReceiptItemLike,
  type PurchaseReceiptLike,
} from '../utils/purchaseReceiptUtils'

type StockLocation = {
  id: string
  name: string
  code: string
  is_default: boolean
}

export type PurchaseReceiptDocumentItem = {
  id: string
  product_id: string
  quantity: number
  unit_cost: number | null
}

export type PurchaseReceiptRow = PurchaseReceiptLike & {
  receipt_code: string
  purchase_document_id: string
  purchase_document_code: string | null
  invoice_number: string | null
  store_id: string
  supplier_id: string
  location_id: string
  location_name: string
  reported_quantity_total: number
  accepted_quantity_total: number
  divergence_count: number
  notes: string | null
  received_by: string
  received_at: string
  reversed_at: string | null
  reversed_by: string | null
  reversal_reason: string | null
  source?: string | null
}

export type PurchaseReceiptItemRow = PurchaseReceiptItemLike & {
  id: string
  purchase_document_id: string
  product_id: string
  ordered_quantity: number
  previously_received_quantity: number
  reported_quantity: number
  accepted_quantity: number
  pending_after_quantity: number
  shortage_quantity: number
  damaged_quantity: number
  wrong_item_quantity: number
  excess_quantity: number
  divergence_note: string | null
  unit_cost: number
}

export type PurchaseReceiptIssueSubmit = {
  scope: 'missing' | 'rejected' | 'excess' | 'existing_pending'
  issue_type: 'shortage' | 'damage' | 'wrong_item' | 'excess' | 'other'
  quantity: number
  disposition:
    | 'awaiting_replacement'
    | 'discount'
    | 'supplier_credit'
    | 'partial_return'
    | 'accepted_closed'
    | 'other'
  note: string | null
}

export type PurchaseReceiptSubmitItem = {
  purchase_document_item_id: string
  received_quantity: number
  accepted_quantity: number
  shortage_quantity: number
  damaged_quantity: number
  wrong_item_quantity: number
  excess_quantity: number
  note: string | null
  issues?: PurchaseReceiptIssueSubmit[]
}

type IssueType = PurchaseReceiptIssueSubmit['issue_type']
type IssueDisposition = PurchaseReceiptIssueSubmit['disposition']

type PurchaseReceiptIssueRow = {
  id: string
  issue_code: string
  purchase_document_id: string
  receipt_id: string | null
  purchase_receipt_item_id: string | null
  purchase_document_item_id: string
  product_id: string
  supplier_id: string
  issue_type: IssueType
  issue_scope: PurchaseReceiptIssueSubmit['scope']
  quantity: number
  disposition: IssueDisposition
  status: 'waiting_supplier' | 'waiting_financial' | 'waiting_document' | 'resolved' | 'cancelled'
  replacement_pending_quantity: number
  physical_closed_quantity: number
  estimated_amount: number
  notes: string | null
  opened_by: string
  opened_at: string
  resolved_by: string | null
  resolved_at: string | null
  resolution_notes: string | null
  resolution_reference: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
}

type IssueDraft = {
  issueType: IssueType
  disposition: IssueDisposition
  note: string
}

type ReceiptFormItem = {
  received: number
  accepted: number
  missingAsIssue: boolean
  missingIssue: IssueDraft
  rejectedIssue: IssueDraft
  excessIssue: IssueDraft
  treatExisting: boolean
  existingQuantity: number
  existingIssue: IssueDraft
}

type Props = {
  open: boolean
  documentId: string
  documentCode: string
  supplierName: string
  items: PurchaseReceiptDocumentItem[]
  receipts: PurchaseReceiptRow[]
  receiptItems: PurchaseReceiptItemRow[]
  stockLocations: StockLocation[]
  productName: (productId: string) => string
  actorName: (userId: string | null) => string
  canReceive: boolean
  canReverse: boolean
  saving: boolean
  onClose: () => void
  onReceive: (payload: {
    locationId: string
    notes: string | null
    items: PurchaseReceiptSubmitItem[]
  }) => Promise<void>
  onReverse: (receiptId: string, reason: string) => Promise<void>
}

const ISSUE_TYPE_OPTIONS: Array<{ value: IssueType; label: string }> = [
  { value: 'shortage', label: 'Falta' },
  { value: 'damage', label: 'Avaria' },
  { value: 'wrong_item', label: 'Item incorreto' },
  { value: 'excess', label: 'Excesso' },
  { value: 'other', label: 'Outro' },
]

const DISPOSITION_OPTIONS: Array<{ value: IssueDisposition; label: string; help: string }> = [
  { value: 'awaiting_replacement', label: 'Fornecedor vai repor', help: 'A quantidade continua aguardando mercadoria.' },
  { value: 'discount', label: 'Abatimento / desconto', help: 'Encerra a obrigação física e mantém acerto financeiro aberto.' },
  { value: 'supplier_credit', label: 'Crédito / bonificação', help: 'Encerra a obrigação física e mantém crédito com o fornecedor.' },
  { value: 'partial_return', label: 'Devolução parcial', help: 'Encerra a obrigação física e mantém a documentação da devolução em tratamento.' },
  { value: 'accepted_closed', label: 'Aceitar diferença e encerrar', help: 'Registra a ocorrência e encerra a tratativa sem nova mercadoria.' },
  { value: 'other', label: 'Outra tratativa', help: 'Encerra a obrigação física e exige uma descrição.' },
]

const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  shortage: 'Falta',
  damage: 'Avaria',
  wrong_item: 'Item incorreto',
  excess: 'Excesso',
  other: 'Outro',
}

const DISPOSITION_LABELS: Record<IssueDisposition, string> = Object.fromEntries(
  DISPOSITION_OPTIONS.map((option) => [option.value, option.label])
) as Record<IssueDisposition, string>

const ISSUE_STATUS_LABELS: Record<PurchaseReceiptIssueRow['status'], string> = {
  waiting_supplier: 'Aguardando reposição',
  waiting_financial: 'Aguardando acerto financeiro',
  waiting_document: 'Aguardando documento / devolução',
  resolved: 'Resolvida',
  cancelled: 'Cancelada',
}

const numeric = (value: number | string | null | undefined) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatQty = (value: number | string | null | undefined) =>
  numeric(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

const formatMoney = (value: number | string | null | undefined) =>
  numeric(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

const issueDraft = (issueType: IssueType, disposition: IssueDisposition): IssueDraft => ({
  issueType,
  disposition,
  note: '',
})

const emptyFormItem = (): ReceiptFormItem => ({
  received: 0,
  accepted: 0,
  missingAsIssue: false,
  missingIssue: issueDraft('shortage', 'awaiting_replacement'),
  rejectedIssue: issueDraft('damage', 'awaiting_replacement'),
  excessIssue: issueDraft('excess', 'partial_return'),
  treatExisting: false,
  existingQuantity: 0,
  existingIssue: issueDraft('shortage', 'awaiting_replacement'),
})

function issueNeedsNote(draft: IssueDraft) {
  return draft.issueType === 'other' || draft.disposition === 'other'
}

function issueDraftValid(draft: IssueDraft) {
  return !issueNeedsNote(draft) || draft.note.trim().length >= 3
}

function IssueEditor({
  title,
  quantity,
  draft,
  onChange,
  allowedTypes = ISSUE_TYPE_OPTIONS,
}: {
  title: string
  quantity: number
  draft: IssueDraft
  onChange: (next: IssueDraft) => void
  allowedTypes?: Array<{ value: IssueType; label: string }>
}) {
  const selectedDisposition = DISPOSITION_OPTIONS.find((option) => option.value === draft.disposition)
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-amber-950 dark:text-amber-100">{title}</div>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
          {formatQty(quantity)} un.
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          O que aconteceu?
          <select
            value={draft.issueType}
            onChange={(event) => onChange({ ...draft, issueType: event.target.value as IssueType })}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            {allowedTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Como será resolvido?
          <select
            value={draft.disposition}
            onChange={(event) => onChange({ ...draft, disposition: event.target.value as IssueDisposition })}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            {DISPOSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{selectedDisposition?.help}</p>
      <label className="mt-2 block text-xs font-semibold text-slate-700 dark:text-slate-200">
        Observação {issueNeedsNote(draft) ? '(obrigatória)' : '(opcional)'}
        <input
          value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })}
          placeholder="Ex.: embalagem rompida; fornecedor confirmou crédito..."
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
        />
      </label>
    </div>
  )
}

export default function PurchaseReceiptModal({
  open,
  documentId,
  documentCode,
  supplierName,
  items,
  receipts,
  receiptItems,
  stockLocations,
  productName,
  actorName,
  canReceive,
  canReverse,
  saving,
  onClose,
  onReceive,
  onReverse,
}: Props) {
  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [formItems, setFormItems] = useState<Record<string, ReceiptFormItem>>({})
  const [historyOpen, setHistoryOpen] = useState(true)
  const [issues, setIssues] = useState<PurchaseReceiptIssueRow[]>([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [reverseReceiptId, setReverseReceiptId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [issueActionId, setIssueActionId] = useState<string | null>(null)
  const [issueActionMode, setIssueActionMode] = useState<'treatment' | 'resolve' | 'cancel' | null>(null)
  const [issueActionDisposition, setIssueActionDisposition] = useState<IssueDisposition>('awaiting_replacement')
  const [issueActionNotes, setIssueActionNotes] = useState('')
  const [issueActionReference, setIssueActionReference] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)

  const progress = useMemo(
    () => buildPurchaseReceiptProgress(items, receipts, receiptItems),
    [items, receiptItems, receipts]
  )

  const activePhysicalClosures = useMemo(() => {
    const map = new Map<string, number>()
    issues.forEach((issue) => {
      if (issue.status === 'cancelled' || issue.issue_type === 'excess') return
      map.set(issue.purchase_document_item_id, (map.get(issue.purchase_document_item_id) ?? 0) + numeric(issue.physical_closed_quantity))
    })
    return map
  }, [issues])

  const getPending = useCallback((item: PurchaseReceiptDocumentItem) => {
    const itemProgress = progress.get(item.id)
    const received = numeric(itemProgress?.received)
    const closed = activePhysicalClosures.get(item.id) ?? 0
    return Math.max(0, numeric(item.quantity) - received - closed)
  }, [activePhysicalClosures, progress])

  const pendingItems = useMemo(() => items.filter((item) => getPending(item) > 0), [getPending, items])

  const receiptItemsByReceipt = useMemo(() => {
    const map = new Map<string, PurchaseReceiptItemRow[]>()
    receiptItems.forEach((item) => {
      const list = map.get(item.receipt_id) ?? []
      list.push(item)
      map.set(item.receipt_id, list)
    })
    return map
  }, [receiptItems])

  const loadIssues = useCallback(async () => {
    if (!open || !documentId) return
    setIssuesLoading(true)
    try {
      const { data, error } = await supabase
        .from('purchase_receipt_issues')
        .select('*')
        .eq('purchase_document_id', documentId)
        .order('opened_at', { ascending: false })
      if (error) throw error
      setIssues((data ?? []) as PurchaseReceiptIssueRow[])
    } catch (error) {
      console.error('Error loading purchase receipt issues:', error)
      toast.error('Não foi possível carregar as ressalvas desta compra.')
    } finally {
      setIssuesLoading(false)
    }
  }, [documentId, open])

  useEffect(() => {
    if (!open) return
    setLocationId(stockLocations.find((location) => location.is_default)?.id || stockLocations[0]?.id || '')
    setNotes('')
    setReverseReceiptId(null)
    setReverseReason('')
    setFormItems(Object.fromEntries(items.map((item) => [item.id, { ...emptyFormItem(), existingQuantity: getPending(item) }])))
    void loadIssues()
  }, [documentId, getPending, items, loadIssues, open, stockLocations])

  useEffect(() => {
    if (open) void loadIssues()
  }, [loadIssues, open, receipts])

  const updateItem = (itemId: string, patch: Partial<ReceiptFormItem>) => {
    setFormItems((current) => ({ ...current, [itemId]: { ...(current[itemId] ?? emptyFormItem()), ...patch } }))
  }

  const updateReceived = (itemId: string, received: number, pending: number) => {
    setFormItems((current) => {
      const previous = current[itemId] ?? emptyFormItem()
      const keepAcceptedInSync = previous.accepted === previous.received || (previous.accepted === 0 && previous.received === 0)
      return {
        ...current,
        [itemId]: {
          ...previous,
          received: Math.max(0, received),
          accepted: keepAcceptedInSync ? Math.min(Math.max(0, received), pending) : previous.accepted,
          treatExisting: false,
        },
      }
    })
  }

  const fillPending = (item: PurchaseReceiptDocumentItem) => {
    const pending = getPending(item)
    updateItem(item.id, { received: pending, accepted: pending, treatExisting: false })
  }

  const fillAllPending = () => {
    setFormItems((current) => {
      const next = { ...current }
      pendingItems.forEach((item) => {
        const pending = getPending(item)
        next[item.id] = { ...(current[item.id] ?? emptyFormItem()), received: pending, accepted: pending, treatExisting: false }
      })
      return next
    })
  }

  const buildIssuesForItem = (item: PurchaseReceiptDocumentItem, value: ReceiptFormItem) => {
    const pending = getPending(item)
    const received = Math.max(0, numeric(value.received))
    const accepted = Math.max(0, numeric(value.accepted))
    const missing = received > 0 ? Math.max(0, pending - Math.min(received, pending)) : 0
    const rejected = Math.max(0, Math.min(received, pending) - accepted)
    const excess = Math.max(0, received - pending)
    const result: PurchaseReceiptIssueSubmit[] = []

    if (value.treatExisting && received === 0 && accepted === 0 && value.existingQuantity > 0) {
      result.push({
        scope: 'existing_pending',
        issue_type: value.existingIssue.issueType,
        quantity: Math.min(pending, Math.max(0, numeric(value.existingQuantity))),
        disposition: value.existingIssue.disposition,
        note: value.existingIssue.note.trim() || null,
      })
    }
    if (missing > 0 && value.missingAsIssue) {
      result.push({ scope: 'missing', issue_type: value.missingIssue.issueType, quantity: missing, disposition: value.missingIssue.disposition, note: value.missingIssue.note.trim() || null })
    }
    if (rejected > 0) {
      result.push({ scope: 'rejected', issue_type: value.rejectedIssue.issueType, quantity: rejected, disposition: value.rejectedIssue.disposition, note: value.rejectedIssue.note.trim() || null })
    }
    if (excess > 0) {
      result.push({ scope: 'excess', issue_type: 'excess', quantity: excess, disposition: value.excessIssue.disposition, note: value.excessIssue.note.trim() || null })
    }
    return result
  }

  const validation = useMemo(() => {
    let hasPayload = false
    let invalid = false
    let willComplete = pendingItems.length > 0
    let hasIssue = false

    pendingItems.forEach((item) => {
      const pending = getPending(item)
      const value = formItems[item.id] ?? emptyFormItem()
      const received = numeric(value.received)
      const accepted = numeric(value.accepted)
      const rejected = Math.max(0, Math.min(received, pending) - accepted)
      const excess = Math.max(0, received - pending)
      const missing = received > 0 ? Math.max(0, pending - Math.min(received, pending)) : 0
      const itemIssues = buildIssuesForItem(item, value)
      const physicallyClosedNow = itemIssues
        .filter((issue) => issue.issue_type !== 'excess' && issue.disposition !== 'awaiting_replacement')
        .reduce((sum, issue) => sum + issue.quantity, 0)

      if (received > 0 || accepted > 0 || value.treatExisting) hasPayload = true
      if (accepted > pending || accepted > received || received < 0 || accepted < 0) invalid = true
      if (rejected > 0 && !issueDraftValid(value.rejectedIssue)) invalid = true
      if (excess > 0 && !issueDraftValid(value.excessIssue)) invalid = true
      if (missing > 0 && value.missingAsIssue && !issueDraftValid(value.missingIssue)) invalid = true
      if (value.treatExisting && (!value.existingQuantity || value.existingQuantity > pending || !issueDraftValid(value.existingIssue))) invalid = true
      if (itemIssues.length > 0) hasIssue = true
      if (accepted + physicallyClosedNow < pending) willComplete = false
    })

    return { hasPayload, invalid, willComplete, hasIssue }
  }, [formItems, getPending, pendingItems])

  const submit = async () => {
    if (!locationId || !validation.hasPayload || validation.invalid || saving) return
    const payload = pendingItems
      .map((item) => {
        const value = formItems[item.id] ?? emptyFormItem()
        const issuesForItem = buildIssuesForItem(item, value)
        const sumType = (type: IssueType) => issuesForItem.filter((issue) => issue.issue_type === type).reduce((sum, issue) => sum + issue.quantity, 0)
        return {
          purchase_document_item_id: item.id,
          received_quantity: Math.max(0, numeric(value.received)),
          accepted_quantity: Math.max(0, numeric(value.accepted)),
          shortage_quantity: sumType('shortage'),
          damaged_quantity: sumType('damage'),
          wrong_item_quantity: sumType('wrong_item'),
          excess_quantity: sumType('excess'),
          note: null,
          issues: issuesForItem,
        } satisfies PurchaseReceiptSubmitItem
      })
      .filter((item) => item.received_quantity > 0 || item.accepted_quantity > 0 || (item.issues?.length ?? 0) > 0)

    await onReceive({ locationId, notes: notes.trim() || null, items: payload })
    await loadIssues()
  }

  const startIssueAction = (issue: PurchaseReceiptIssueRow, mode: 'treatment' | 'resolve' | 'cancel') => {
    setIssueActionId(issue.id)
    setIssueActionMode(mode)
    setIssueActionDisposition(issue.disposition)
    setIssueActionNotes('')
    setIssueActionReference('')
  }

  const closeIssueAction = () => {
    setIssueActionId(null)
    setIssueActionMode(null)
    setIssueActionNotes('')
    setIssueActionReference('')
  }

  const submitIssueAction = async (issue: PurchaseReceiptIssueRow) => {
    if (!issueActionMode || issueSaving) return
    setIssueSaving(true)
    try {
      if (issueActionMode === 'treatment') {
        const { error } = await supabase.rpc('update_purchase_receipt_issue_treatment', {
          p_issue_id: issue.id,
          p_disposition: issueActionDisposition,
          p_notes: issueActionNotes.trim() || null,
          p_resolution_reference: issueActionReference.trim() || null,
        })
        if (error) throw error
        toast.success('Tratativa atualizada e auditada.')
        await loadIssues()
        window.location.reload()
        return
      }
      if (issueActionMode === 'resolve') {
        if (issueActionNotes.trim().length < 3) {
          toast.error('Descreva como a ressalva foi resolvida.')
          return
        }
        const { error } = await supabase.rpc('resolve_purchase_receipt_issue', {
          p_issue_id: issue.id,
          p_resolution_notes: issueActionNotes.trim(),
          p_resolution_reference: issueActionReference.trim() || null,
        })
        if (error) throw error
        toast.success('Ressalva resolvida e mantida no histórico.')
        closeIssueAction()
        await loadIssues()
        return
      }
      if (issueActionMode === 'cancel') {
        if (issueActionNotes.trim().length < 3) {
          toast.error('Informe o motivo do cancelamento.')
          return
        }
        const { error } = await supabase.rpc('cancel_purchase_receipt_issue', {
          p_issue_id: issue.id,
          p_reason: issueActionNotes.trim(),
        })
        if (error) throw error
        toast.success('Ressalva cancelada sem apagar o histórico.')
        await loadIssues()
        window.location.reload()
      }
    } catch (error) {
      console.error('Error handling purchase receipt issue:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a ressalva.')
    } finally {
      setIssueSaving(false)
    }
  }

  const confirmReverse = async () => {
    if (!reverseReceiptId || reverseReason.trim().length < 3 || saving) return
    await onReverse(reverseReceiptId, reverseReason.trim())
    setReverseReceiptId(null)
    setReverseReason('')
    await loadIssues()
  }

  if (!open) return null

  const activeIssues = issues.filter((issue) => !['resolved', 'cancelled'].includes(issue.status))
  const waitingReplacement = activeIssues.reduce((sum, issue) => sum + numeric(issue.replacement_pending_quantity), 0)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-[2px] sm:p-4">
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-2xl ring-1 ring-black/10 dark:border-slate-500 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.85)] dark:ring-2 dark:ring-teal-400/20">
        <div className="sticky top-0 z-20 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Receber compra</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{documentCode} · {supplierName}</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Fechar recebimento">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {activeIssues.length > 0 ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex items-start gap-3">
                <FileWarning className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="font-semibold">Esta compra possui {activeIssues.length} ressalva(s) em tratamento.</div>
                  <div className="mt-1 text-amber-800 dark:text-amber-200">
                    {waitingReplacement > 0 ? `${formatQty(waitingReplacement)} un. ainda aguardam reposição física. ` : 'Não há reposição física pendente nas ressalvas abertas. '}
                    Abatimentos, créditos e devoluções permanecem auditados até a solução ser registrada.
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {canReceive && pendingItems.length > 0 ? (
            <>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
                <div className="flex items-start gap-3">
                  <PackageCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">Registre somente o que aconteceu nesta entrega.</div>
                    <div className="mt-1 text-blue-800 dark:text-blue-200">Se a diferença ainda será entregue, ela continua aguardando mercadoria. Se não será entregue normalmente, registre uma ressalva e escolha a tratativa.</div>
                  </div>
                </div>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <label className="mb-1 block text-sm font-semibold text-slate-900 dark:text-slate-100">1. Onde esta entrega será armazenada?</label>
                    <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:max-w-xl">
                      <option value="">Selecione o local</option>
                      {stockLocations.map((location) => <option key={location.id} value={location.id}>{location.name} ({location.code}){location.is_default ? ' · padrão' : ''}</option>)}
                    </select>
                  </div>
                  <button type="button" onClick={fillAllPending} className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-900 dark:text-emerald-200 dark:hover:bg-emerald-950/40">Receber todo o saldo em aberto</button>
                </div>
              </section>

              <section>
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-white">2. O que aconteceu com cada item?</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">“Chegou agora” é o que o fornecedor apresentou. “Entra no estoque” é somente o que você aceitou fisicamente.</p>
                </div>
                <div className="space-y-3">
                  {pendingItems.map((item) => {
                    const itemProgress = progress.get(item.id)
                    const pending = getPending(item)
                    const value = formItems[item.id] ?? { ...emptyFormItem(), existingQuantity: pending }
                    const received = numeric(value.received)
                    const accepted = numeric(value.accepted)
                    const missing = received > 0 ? Math.max(0, pending - Math.min(received, pending)) : 0
                    const rejected = Math.max(0, Math.min(received, pending) - accepted)
                    const excess = Math.max(0, received - pending)
                    const invalidAccepted = accepted > pending || accepted > received
                    const hasPriorReceipt = numeric(itemProgress?.received) > 0

                    return (
                      <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="font-semibold text-slate-950 dark:text-white">{productName(item.product_id)}</div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-lg bg-slate-100 px-2 py-1.5 dark:bg-slate-900">Pedido <b>{formatQty(item.quantity)}</b></span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1.5 dark:bg-slate-900">Já entrou <b>{formatQty(itemProgress?.received)}</b></span>
                              <span className="rounded-lg bg-amber-50 px-2 py-1.5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Em aberto <b>{formatQty(pending)}</b></span>
                            </div>
                          </div>
                          <button type="button" onClick={() => fillPending(item)} className="self-start rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40">Receber tudo deste item</button>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Chegou agora
                            <input type="number" min={0} step={1} value={value.received || ''} onChange={(event) => updateReceived(item.id, Number(event.target.value || 0), pending)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" placeholder="0" />
                          </label>
                          <label className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Entra no estoque
                            <input type="number" min={0} max={pending} step={1} value={value.accepted || ''} onChange={(event) => updateItem(item.id, { accepted: Number(event.target.value || 0), treatExisting: false })} className={`mt-1 w-full rounded-xl border bg-white p-3 text-base text-slate-950 dark:bg-slate-900 dark:text-white ${invalidAccepted ? 'border-rose-500 ring-1 ring-rose-400' : 'border-emerald-300 dark:border-emerald-700'}`} placeholder="0" />
                          </label>
                        </div>

                        {invalidAccepted ? <div className="mt-2 flex items-start gap-2 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-700 dark:bg-rose-950/30 dark:text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />O estoque só pode receber quantidade que chegou e nunca acima do saldo em aberto.</div> : null}

                        {missing > 0 ? (
                          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-800 dark:bg-blue-950/20">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div><b className="text-sm text-blue-950 dark:text-blue-100">{formatQty(missing)} un. não vieram nesta entrega.</b><p className="text-xs text-blue-700 dark:text-blue-300">Por padrão, ficam aguardando próxima entrega.</p></div>
                              <button type="button" onClick={() => updateItem(item.id, { missingAsIssue: !value.missingAsIssue })} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-800 dark:border-blue-700 dark:text-blue-200">{value.missingAsIssue ? 'Manter aguardando entrega' : 'Tratar como ressalva'}</button>
                            </div>
                            {value.missingAsIssue ? <IssueEditor title="Tratativa do que não veio" quantity={missing} draft={value.missingIssue} onChange={(next) => updateItem(item.id, { missingIssue: next })} allowedTypes={ISSUE_TYPE_OPTIONS.filter((option) => ['shortage', 'other'].includes(option.value))} /> : null}
                          </div>
                        ) : null}

                        {rejected > 0 ? <IssueEditor title={`${formatQty(rejected)} un. chegaram, mas não serão aceitas no estoque`} quantity={rejected} draft={value.rejectedIssue} onChange={(next) => updateItem(item.id, { rejectedIssue: next })} allowedTypes={ISSUE_TYPE_OPTIONS.filter((option) => ['damage', 'wrong_item', 'other'].includes(option.value))} /> : null}
                        {excess > 0 ? <IssueEditor title={`${formatQty(excess)} un. vieram além do pedido e não entrarão por esta compra`} quantity={excess} draft={value.excessIssue} onChange={(next) => updateItem(item.id, { excessIssue: { ...next, issueType: 'excess' } })} allowedTypes={[{ value: 'excess', label: 'Excesso' }]} /> : null}

                        {received === 0 && hasPriorReceipt ? (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div><b className="text-sm text-slate-900 dark:text-white">Esse saldo já estava em aberto.</b><p className="text-xs text-slate-500 dark:text-slate-400">Use esta opção se ele não representa mais uma entrega futura e precisa virar avaria, abatimento, crédito ou outra ressalva.</p></div>
                              <button type="button" onClick={() => updateItem(item.id, { treatExisting: !value.treatExisting, existingQuantity: value.existingQuantity || pending })} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:text-amber-200">{value.treatExisting ? 'Cancelar tratativa' : 'Tratar saldo existente'}</button>
                            </div>
                            {value.treatExisting ? (
                              <div className="mt-3">
                                <label className="block max-w-40 text-xs font-semibold text-slate-700 dark:text-slate-200">Quantidade a tratar
                                  <input type="number" min={1} max={pending} step={1} value={value.existingQuantity || ''} onChange={(event) => updateItem(item.id, { existingQuantity: Number(event.target.value || 0) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
                                </label>
                                <IssueEditor title="Defina o destino desse saldo" quantity={value.existingQuantity || pending} draft={value.existingIssue} onChange={(next) => updateItem(item.id, { existingIssue: next })} />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                <label className="block text-sm font-medium text-slate-800 dark:text-slate-100">3. Observação geral deste recebimento
                  <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" placeholder="Opcional. Ex.: entrega parcial referente à primeira viagem do fornecedor." />
                </label>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {validation.willComplete ? <span><b>Resultado:</b> a obrigação física deste pedido ficará concluída. {validation.hasIssue ? 'As ressalvas comerciais/documentais continuam em tratamento até serem resolvidas.' : 'A compra ficará Confirmada.'}</span> : <span><b>Resultado:</b> somente o que for aceito entra no estoque. Quantidades para entrega/reposição futura continuam em aberto.</span>}
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-800">Voltar</button>
                  <button type="button" disabled={saving || !locationId || !validation.hasPayload || validation.invalid} onClick={() => void submit()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{saving ? 'Registrando...' : validation.hasIssue ? 'Registrar com ressalva' : validation.willComplete ? 'Registrar e concluir compra' : 'Registrar entrega parcial'}</button>
                </div>
              </section>
            </>
          ) : pendingItems.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">A obrigação física desta compra está concluída. Não é possível acrescentar novas quantidades. Ressalvas abertas continuam abaixo até a solução final.</div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">Você não possui permissão para registrar recebimentos nesta compra.</div>
          )}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2"><FileWarning className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Ressalvas e tratativas</h3><p className="text-xs text-slate-500 dark:text-slate-400">Avarias, faltas, créditos, abatimentos, devoluções e reposições ficam aqui até a resolução.</p></div></div>
              <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{issues.length}</span>
            </div>
            {issuesLoading ? <p className="mt-3 text-sm text-slate-500">Carregando ressalvas...</p> : issues.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Nenhuma ressalva formal registrada.</p> : (
              <div className="mt-3 space-y-3">
                {issues.map((issue) => {
                  const actionOpen = issueActionId === issue.id
                  const isOpen = !['resolved', 'cancelled'].includes(issue.status)
                  return (
                    <article key={issue.id} className={`rounded-xl border p-3 ${issue.status === 'cancelled' ? 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900' : issue.status === 'resolved' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20' : 'border-amber-200 bg-white dark:border-amber-800 dark:bg-slate-950'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2"><b className="text-slate-950 dark:text-white">{issue.issue_code}</b><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{ISSUE_TYPE_LABELS[issue.issue_type]} · {formatQty(issue.quantity)} un.</span><span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{ISSUE_STATUS_LABELS[issue.status]}</span></div>
                          <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{productName(issue.product_id)} · {DISPOSITION_LABELS[issue.disposition]}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aberta em {formatDateTime(issue.opened_at)} por {actorName(issue.opened_by)} · impacto estimado {formatMoney(issue.estimated_amount)}</p>
                          {issue.replacement_pending_quantity > 0 ? <p className="mt-1 text-xs font-bold text-blue-700 dark:text-blue-300"><Truck className="mr-1 inline h-3.5 w-3.5" />Aguardando reposição: {formatQty(issue.replacement_pending_quantity)} un.</p> : null}
                          {issue.notes ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{issue.notes}</p> : null}
                          {issue.resolution_notes ? <p className="mt-2 rounded-lg bg-emerald-100/70 p-2 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">Solução: {issue.resolution_notes}{issue.resolution_reference ? ` · Ref.: ${issue.resolution_reference}` : ''}</p> : null}
                          {issue.cancellation_reason ? <p className="mt-2 text-xs text-slate-500">Cancelada: {issue.cancellation_reason}</p> : null}
                        </div>
                        {isOpen && canReceive ? <div className="flex flex-wrap gap-2"><button type="button" onClick={() => startIssueAction(issue, 'treatment')} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-600">Alterar tratativa</button>{issue.status !== 'waiting_supplier' ? <button type="button" onClick={() => startIssueAction(issue, 'resolve')} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">Registrar solução</button> : null}{canReverse ? <button type="button" onClick={() => startIssueAction(issue, 'cancel')} className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-700 dark:text-rose-200">Cancelar ressalva</button> : null}</div> : null}
                      </div>
                      {actionOpen ? (
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                          {issueActionMode === 'treatment' ? <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200">Nova tratativa<select value={issueActionDisposition} onChange={(event) => setIssueActionDisposition(event.target.value as IssueDisposition)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white">{DISPOSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label> : null}
                          <label className="mt-2 block text-xs font-semibold text-slate-700 dark:text-slate-200">{issueActionMode === 'cancel' ? 'Motivo' : issueActionMode === 'resolve' ? 'Como foi resolvida?' : 'Observação da mudança'}<textarea rows={2} value={issueActionNotes} onChange={(event) => setIssueActionNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" /></label>
                          {issueActionMode !== 'cancel' ? <label className="mt-2 block text-xs font-semibold text-slate-700 dark:text-slate-200">Referência do acerto (opcional)<input value={issueActionReference} onChange={(event) => setIssueActionReference(event.target.value)} placeholder="Ex.: crédito, nota de devolução, acordo..." className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" /></label> : null}
                          <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={closeIssueAction} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600">Voltar</button><button type="button" disabled={issueSaving} onClick={() => void submitIssueAction(issue)} className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${issueActionMode === 'cancel' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{issueSaving ? 'Salvando...' : 'Confirmar'}</button></div>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          <section>
            <button type="button" onClick={() => setHistoryOpen((value) => !value)} className="mb-3 flex w-full items-start justify-between gap-3 text-left">
              <div className="flex items-start gap-2"><History className="mt-0.5 h-5 w-5 text-teal-600 dark:text-teal-300" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Histórico de recebimentos</h3><p className="text-xs text-slate-500 dark:text-slate-400">Cada entrega e tratativa fica registrada com local, usuário, data e eventual reversão.</p></div></div>{historyOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {historyOpen ? receipts.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Nenhum recebimento registrado ainda.</div> : (
              <div className="space-y-3">
                {receipts.map((receipt) => {
                  const currentItems = receiptItemsByReceipt.get(receipt.id) ?? []
                  const reversed = receipt.status === 'reversed'
                  const reversing = reverseReceiptId === receipt.id
                  const treatmentOnly = receipt.source === 'purchase_issue_treatment'
                  return (
                    <article key={receipt.id} className={`rounded-2xl border p-4 ${reversed ? 'border-rose-200 bg-rose-50/60 dark:border-rose-800/70 dark:bg-rose-950/20' : treatmentOnly ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-950 dark:text-white">{receipt.receipt_code}</span><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${reversed ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200' : treatmentOnly ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'}`}>{reversed ? 'Revertido' : treatmentOnly ? 'Tratativa' : 'Válido'}</span></div><div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{receipt.location_name} · {formatDateTime(receipt.received_at)} · {actorName(receipt.received_by)}</div>{!treatmentOnly ? <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Chegou: {formatQty(receipt.reported_quantity_total)} · Entrou no estoque: {formatQty(receipt.accepted_quantity_total)}</div> : null}{receipt.notes ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{receipt.notes}</p> : null}</div>
                        {!reversed && canReverse ? <button type="button" onClick={() => { setReverseReceiptId(receipt.id); setReverseReason('') }} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/40"><RotateCcw className="h-4 w-4" />Desfazer registro</button> : null}
                      </div>
                      <div className="mt-3 grid gap-2 lg:grid-cols-2">{currentItems.map((entry) => <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"><div className="font-semibold text-slate-950 dark:text-white">{productName(entry.product_id)}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1"><span>Pedido: {formatQty(entry.ordered_quantity)}</span>{!treatmentOnly ? <><span>Chegou: {formatQty(entry.reported_quantity)}</span><span className="font-semibold text-emerald-700 dark:text-emerald-300">Entrou: {formatQty(entry.accepted_quantity)}</span></> : <span>Tratativa registrada sem movimentação física</span>}</div></div>)}</div>
                      {reversed ? <div className="mt-3 rounded-xl border border-rose-200 bg-white/70 p-3 text-xs text-rose-800 dark:border-rose-800 dark:bg-slate-950 dark:text-rose-200">Desfeito em {formatDateTime(receipt.reversed_at)} por {actorName(receipt.reversed_by)}. Motivo: {receipt.reversal_reason || '—'}</div> : null}
                      {reversing ? <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/30"><div className="mb-2 flex items-start gap-2 text-xs text-rose-900 dark:text-rose-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Desfazer retira do estoque o que entrou e invalida as ressalvas vinculadas à compra, sem apagar nenhum histórico.</div><textarea rows={2} value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} className="w-full rounded-lg border border-rose-300 bg-white p-2 text-sm dark:border-rose-700 dark:bg-slate-950 dark:text-white" placeholder="Motivo obrigatório" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => { setReverseReceiptId(null); setReverseReason('') }} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-600">Voltar</button><button type="button" disabled={saving || reverseReason.trim().length < 3} onClick={() => void confirmReverse()} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirmar reversão</button></div></div> : null}
                    </article>
                  )
                })}
              </div>
            ) : null}
          </section>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
            <div className="flex items-start gap-2"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0" /><span>Abatimentos e créditos preservam o valor original da compra/NF. O valor da ressalva fica separado e só é encerrado quando você registrar o acerto correspondente.</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
