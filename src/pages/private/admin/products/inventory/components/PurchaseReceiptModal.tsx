import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileWarning,
  History,
  PackageCheck,
  RotateCcw,
  Truck,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import {
  AccountsPayableService,
  type AccountsPayablePaymentOptions,
  type PurchasePaymentTerm,
} from '@/services/accountsPayableService'
import { getActiveStoreId } from '@/utils/activeStore'
import {
  buildPurchaseReceiptProgress,
  type PurchaseReceiptItemLike,
  type PurchaseReceiptLike,
} from '../utils/purchaseReceiptUtils'

type StockLocation = { id: string; name: string; code: string; is_default: boolean }

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

type IssueType = 'shortage' | 'damage' | 'wrong_item' | 'excess' | 'other'
type IssueDisposition =
  | 'awaiting_replacement'
  | 'discount'
  | 'supplier_credit'
  | 'partial_return'
  | 'accepted_closed'
  | 'other'
type IssueScope = 'missing' | 'rejected' | 'excess' | 'existing_pending'

export type PurchaseReceiptIssueSubmit = {
  scope: IssueScope
  issue_type: IssueType
  quantity: number
  disposition: IssueDisposition
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

type IssueRow = {
  id: string
  issue_code: string
  purchase_document_id: string
  purchase_document_item_id: string
  product_id: string
  supplier_id: string
  issue_type: IssueType
  issue_scope: IssueScope
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
  cancellation_reason: string | null
}

type PurchaseFinancialRow = {
  supplier_id: string | null
  payment_term_id: string | null
  payment_method_code: string | null
  preferred_financial_account_id: string | null
  financial_status: string | null
}

type IssueDraft = { issueType: IssueType; disposition: IssueDisposition; note: string }
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
  onReceive: (payload: { locationId: string; notes: string | null; items: PurchaseReceiptSubmitItem[] }) => Promise<void>
  onReverse: (receiptId: string, reason: string) => Promise<void>
}

const ISSUE_TYPES: Array<{ value: IssueType; label: string }> = [
  { value: 'shortage', label: 'Falta' },
  { value: 'damage', label: 'Avaria' },
  { value: 'wrong_item', label: 'Item incorreto' },
  { value: 'excess', label: 'Excesso' },
  { value: 'other', label: 'Outro' },
]

const DISPOSITIONS: Array<{ value: IssueDisposition; label: string; help: string }> = [
  { value: 'awaiting_replacement', label: 'Fornecedor vai repor', help: 'A quantidade continua aguardando mercadoria.' },
  { value: 'discount', label: 'Abatimento / desconto', help: 'Encerra a obrigação física e deixa o acerto financeiro em aberto.' },
  { value: 'supplier_credit', label: 'Crédito / bonificação', help: 'Encerra a obrigação física e registra crédito com o fornecedor.' },
  { value: 'partial_return', label: 'Devolução parcial', help: 'Encerra a obrigação física e aguarda a documentação da devolução.' },
  { value: 'accepted_closed', label: 'Aceitar diferença e encerrar', help: 'Registra a ocorrência e encerra a tratativa.' },
  { value: 'other', label: 'Outra tratativa', help: 'Encerra a obrigação física e exige descrição.' },
]

const TYPE_LABEL: Record<IssueType, string> = {
  shortage: 'Falta', damage: 'Avaria', wrong_item: 'Item incorreto', excess: 'Excesso', other: 'Outro',
}
const DISPOSITION_LABEL = Object.fromEntries(DISPOSITIONS.map((item) => [item.value, item.label])) as Record<IssueDisposition, string>
const STATUS_LABEL: Record<IssueRow['status'], string> = {
  waiting_supplier: 'Aguardando reposição',
  waiting_financial: 'Aguardando acerto financeiro',
  waiting_document: 'Aguardando documento / devolução',
  resolved: 'Resolvida',
  cancelled: 'Cancelada',
}

const numeric = (value: unknown) => {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}
const qty = (value: unknown) => numeric(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const money = (value: unknown) => numeric(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
const draft = (issueType: IssueType, disposition: IssueDisposition): IssueDraft => ({ issueType, disposition, note: '' })
const emptyItem = (): ReceiptFormItem => ({
  received: 0,
  accepted: 0,
  missingAsIssue: false,
  missingIssue: draft('shortage', 'awaiting_replacement'),
  rejectedIssue: draft('damage', 'awaiting_replacement'),
  excessIssue: draft('excess', 'partial_return'),
  treatExisting: false,
  existingQuantity: 0,
  existingIssue: draft('shortage', 'awaiting_replacement'),
})
const draftValid = (value: IssueDraft) =>
  (value.issueType !== 'other' && value.disposition !== 'other') || value.note.trim().length >= 3

function IssueEditor({
  title,
  quantity,
  value,
  onChange,
  types = ISSUE_TYPES,
}: {
  title: string
  quantity: number
  value: IssueDraft
  onChange: (value: IssueDraft) => void
  types?: Array<{ value: IssueType; label: string }>
}) {
  const treatment = DISPOSITIONS.find((item) => item.value === value.disposition)
  return (
    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/25">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="text-sm text-amber-950 dark:text-amber-100">{title}</b>
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{qty(quantity)} un.</span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">O que aconteceu?
          <select value={value.issueType} onChange={(event) => onChange({ ...value, issueType: event.target.value as IssueType })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
            {types.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Como será resolvido?
          <select value={value.disposition} onChange={(event) => onChange({ ...value, disposition: event.target.value as IssueDisposition })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
            {DISPOSITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{treatment?.help}</p>
      <label className="mt-2 block text-xs font-semibold text-slate-700 dark:text-slate-200">Observação {(value.issueType === 'other' || value.disposition === 'other') ? '(obrigatória)' : '(opcional)'}
        <input value={value.note} onChange={(event) => onChange({ ...value, note: event.target.value })} placeholder="Ex.: unidade derretida; crédito confirmado..." className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
      </label>
    </div>
  )
}

export default function PurchaseReceiptModal(props: Props) {
  const {
    open, documentId, documentCode, supplierName, items, receipts, receiptItems, stockLocations,
    productName, actorName, canReceive, canReverse, saving, onClose, onReceive, onReverse,
  } = props
  const navigate = useNavigate()
  const storeId = getActiveStoreId()
  const { hasPermission } = usePermissions(storeId)
  const canManageFinancial = hasPermission('accounts_payable.manage') || hasPermission('purchases.create')
  const initializedDocumentRef = useRef<string | null>(null)

  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [formItems, setFormItems] = useState<Record<string, ReceiptFormItem>>({})
  const [issues, setIssues] = useState<IssueRow[]>([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [reverseReceiptId, setReverseReceiptId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [actionIssueId, setActionIssueId] = useState<string | null>(null)
  const [actionMode, setActionMode] = useState<'treatment' | 'resolve' | 'cancel' | null>(null)
  const [actionDisposition, setActionDisposition] = useState<IssueDisposition>('awaiting_replacement')
  const [actionNotes, setActionNotes] = useState('')
  const [actionReference, setActionReference] = useState('')
  const [issueSaving, setIssueSaving] = useState(false)

  const [paymentTerms, setPaymentTerms] = useState<PurchasePaymentTerm[]>([])
  const [paymentOptions, setPaymentOptions] = useState<AccountsPayablePaymentOptions>({ financial_accounts: [], payment_methods: [] })
  const [financialRow, setFinancialRow] = useState<PurchaseFinancialRow | null>(null)
  const [paymentTermId, setPaymentTermId] = useState('')
  const [paymentMethodCode, setPaymentMethodCode] = useState('')
  const [preferredFinancialAccountId, setPreferredFinancialAccountId] = useState('')
  const [financialLoading, setFinancialLoading] = useState(false)
  const [financialSaving, setFinancialSaving] = useState(false)

  const progress = useMemo(() => buildPurchaseReceiptProgress(items, receipts, receiptItems), [items, receiptItems, receipts])

  const physicalClosures = useMemo(() => {
    const map = new Map<string, number>()
    issues.forEach((issue) => {
      if (issue.status !== 'cancelled' && issue.issue_type !== 'excess') {
        map.set(issue.purchase_document_item_id, (map.get(issue.purchase_document_item_id) ?? 0) + numeric(issue.physical_closed_quantity))
      }
    })
    return map
  }, [issues])

  const pendingFor = useCallback((item: PurchaseReceiptDocumentItem) => {
    const received = numeric(progress.get(item.id)?.received)
    return Math.max(0, numeric(item.quantity) - received - (physicalClosures.get(item.id) ?? 0))
  }, [physicalClosures, progress])

  const pendingItems = useMemo(() => items.filter((item) => pendingFor(item) > 0), [items, pendingFor])

  const receiptItemsByReceipt = useMemo(() => {
    const map = new Map<string, PurchaseReceiptItemRow[]>()
    receiptItems.forEach((item) => map.set(item.receipt_id, [...(map.get(item.receipt_id) ?? []), item]))
    return map
  }, [receiptItems])

  const paymentTermName = useMemo(
    () => paymentTerms.find((term) => term.id === paymentTermId)?.name || 'Não definida',
    [paymentTermId, paymentTerms]
  )
  const paymentMethodName = useMemo(
    () => paymentOptions.payment_methods.find((method) => method.code === paymentMethodCode)?.name || 'Não definida',
    [paymentMethodCode, paymentOptions.payment_methods]
  )
  const preferredAccountName = useMemo(
    () => paymentOptions.financial_accounts.find((account) => account.id === preferredFinancialAccountId)?.name || 'Definida somente na baixa',
    [paymentOptions.financial_accounts, preferredFinancialAccountId]
  )

  const loadIssues = useCallback(async () => {
    if (!open || !documentId) return
    setIssuesLoading(true)
    try {
      const { data, error } = await supabase.from('purchase_receipt_issues').select('*').eq('purchase_document_id', documentId).order('opened_at', { ascending: false })
      if (error) throw error
      const next = (data ?? []) as IssueRow[]
      setIssues((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    } catch (error) {
      console.error('Error loading purchase receipt issues:', error)
      toast.error('Não foi possível carregar as ressalvas desta compra.')
    } finally {
      setIssuesLoading(false)
    }
  }, [documentId, open])

  const loadFinancial = useCallback(async () => {
    if (!open || !documentId || !storeId) return
    setFinancialLoading(true)
    try {
      const [docResult, terms, options] = await Promise.all([
        supabase.from('purchase_documents').select('supplier_id,payment_term_id,payment_method_code,preferred_financial_account_id,financial_status').eq('id', documentId).eq('store_id', storeId).single(),
        AccountsPayableService.listPaymentTerms(storeId, false),
        AccountsPayableService.listPaymentOptions(storeId),
      ])
      if (docResult.error) throw docResult.error
      const row = docResult.data as PurchaseFinancialRow
      let termId = row.payment_term_id || ''
      let methodCode = row.payment_method_code || ''
      if (!termId && row.supplier_id) {
        const suggestion = await AccountsPayableService.suggestSupplierPaymentTerm(storeId, row.supplier_id)
        const suggestedTerm = typeof suggestion?.payment_term_id === 'string' ? suggestion.payment_term_id : ''
        const suggestedMethod = typeof suggestion?.payment_method_code === 'string' ? suggestion.payment_method_code : ''
        termId = suggestedTerm || terms.find((term) => term.is_default)?.id || terms[0]?.id || ''
        methodCode = suggestedMethod || terms.find((term) => term.id === termId)?.payment_method_code || ''
      }
      setFinancialRow(row)
      setPaymentTerms(terms)
      setPaymentOptions(options)
      setPaymentTermId(termId)
      setPaymentMethodCode(methodCode)
      setPreferredFinancialAccountId(row.preferred_financial_account_id || '')
    } catch (error) {
      console.error('Error loading purchase financial terms:', error)
      toast.error('Não foi possível carregar a condição financeira desta compra.')
    } finally {
      setFinancialLoading(false)
    }
  }, [documentId, open, storeId])

  useEffect(() => {
    if (!open) {
      initializedDocumentRef.current = null
      return
    }
    if (initializedDocumentRef.current === documentId) return
    initializedDocumentRef.current = documentId
    setLocationId(stockLocations.find((item) => item.is_default)?.id || stockLocations[0]?.id || '')
    setNotes('')
    setReverseReceiptId(null)
    setReverseReason('')
    setFormItems(Object.fromEntries(items.map((item) => [item.id, { ...emptyItem(), existingQuantity: Math.max(0, numeric(item.quantity) - numeric(progress.get(item.id)?.received)) }])))
    void loadIssues()
    void loadFinancial()
  }, [documentId, items, loadFinancial, loadIssues, open, progress, stockLocations])

  const patchItem = (itemId: string, patch: Partial<ReceiptFormItem>) =>
    setFormItems((current) => ({ ...current, [itemId]: { ...(current[itemId] ?? emptyItem()), ...patch } }))

  const changeReceived = (itemId: string, received: number, pending: number) => {
    setFormItems((current) => {
      const previous = current[itemId] ?? emptyItem()
      const syncAccepted = previous.accepted === previous.received || (previous.accepted === 0 && previous.received === 0)
      return {
        ...current,
        [itemId]: {
          ...previous,
          received: Math.max(0, received),
          accepted: syncAccepted ? Math.min(Math.max(0, received), pending) : previous.accepted,
          treatExisting: false,
        },
      }
    })
  }

  const fillItem = (item: PurchaseReceiptDocumentItem) => {
    const pending = pendingFor(item)
    patchItem(item.id, { received: pending, accepted: pending, treatExisting: false })
  }

  const fillAll = () => setFormItems((current) => {
    const next = { ...current }
    pendingItems.forEach((item) => {
      const pending = pendingFor(item)
      next[item.id] = { ...(current[item.id] ?? emptyItem()), received: pending, accepted: pending, treatExisting: false }
    })
    return next
  })

  const changePaymentTerm = (termId: string) => {
    setPaymentTermId(termId)
    const method = paymentTerms.find((term) => term.id === termId)?.payment_method_code
    if (method) setPaymentMethodCode(method)
  }

  const saveFinancialTerms = async () => {
    if (!storeId || !paymentTermId || financialSaving) {
      if (!paymentTermId) toast.warning('Selecione a condição de pagamento da compra.')
      return
    }
    setFinancialSaving(true)
    try {
      await AccountsPayableService.setPurchaseFinancialTerms({
        purchaseDocumentId: documentId,
        paymentTermId,
        paymentMethodCode: paymentMethodCode || null,
        preferredFinancialAccountId: preferredFinancialAccountId || null,
        paymentTermSource: financialRow?.payment_term_id ? 'manual' : 'manual',
      })
      toast.success('Condição financeira da compra salva.')
      await loadFinancial()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a condição financeira.')
    } finally {
      setFinancialSaving(false)
    }
  }

  const issuesFor = useCallback((item: PurchaseReceiptDocumentItem, value: ReceiptFormItem) => {
    const pending = pendingFor(item)
    const received = numeric(value.received)
    const accepted = numeric(value.accepted)
    const missing = received > 0 ? Math.max(0, pending - Math.min(received, pending)) : 0
    const rejected = Math.max(0, Math.min(received, pending) - accepted)
    const excess = Math.max(0, received - pending)
    const result: PurchaseReceiptIssueSubmit[] = []
    if (value.treatExisting && received === 0 && accepted === 0 && value.existingQuantity > 0) {
      result.push({ scope: 'existing_pending', issue_type: value.existingIssue.issueType, quantity: Math.min(pending, value.existingQuantity), disposition: value.existingIssue.disposition, note: value.existingIssue.note.trim() || null })
    }
    if (missing > 0 && value.missingAsIssue) result.push({ scope: 'missing', issue_type: value.missingIssue.issueType, quantity: missing, disposition: value.missingIssue.disposition, note: value.missingIssue.note.trim() || null })
    if (rejected > 0) result.push({ scope: 'rejected', issue_type: value.rejectedIssue.issueType, quantity: rejected, disposition: value.rejectedIssue.disposition, note: value.rejectedIssue.note.trim() || null })
    if (excess > 0) result.push({ scope: 'excess', issue_type: 'excess', quantity: excess, disposition: value.excessIssue.disposition, note: value.excessIssue.note.trim() || null })
    return result
  }, [pendingFor])

  const validation = useMemo(() => {
    let hasPayload = false
    let invalid = false
    let hasIssue = false
    let completes = pendingItems.length > 0
    pendingItems.forEach((item) => {
      const pending = pendingFor(item)
      const value = formItems[item.id] ?? emptyItem()
      const received = numeric(value.received)
      const accepted = numeric(value.accepted)
      const rejected = Math.max(0, Math.min(received, pending) - accepted)
      const excess = Math.max(0, received - pending)
      const missing = received > 0 ? Math.max(0, pending - Math.min(received, pending)) : 0
      const issueList = issuesFor(item, value)
      const closedNow = issueList.filter((issue) => issue.issue_type !== 'excess' && issue.disposition !== 'awaiting_replacement').reduce((sum, issue) => sum + issue.quantity, 0)
      if (received > 0 || accepted > 0 || value.treatExisting) hasPayload = true
      if (accepted < 0 || received < 0 || accepted > received || accepted > pending) invalid = true
      if (rejected > 0 && !draftValid(value.rejectedIssue)) invalid = true
      if (excess > 0 && !draftValid(value.excessIssue)) invalid = true
      if (missing > 0 && value.missingAsIssue && !draftValid(value.missingIssue)) invalid = true
      if (value.treatExisting && (value.existingQuantity <= 0 || value.existingQuantity > pending || !draftValid(value.existingIssue))) invalid = true
      if (issueList.length) hasIssue = true
      if (accepted + closedNow < pending) completes = false
    })
    return { hasPayload, invalid, hasIssue, completes }
  }, [formItems, issuesFor, pendingFor, pendingItems])

  const submit = async () => {
    if (!locationId || !validation.hasPayload || validation.invalid || saving) return
    const payload = pendingItems.map((item) => {
      const value = formItems[item.id] ?? emptyItem()
      const itemIssues = issuesFor(item, value)
      const byType = (type: IssueType) => itemIssues.filter((issue) => issue.issue_type === type).reduce((sum, issue) => sum + issue.quantity, 0)
      return {
        purchase_document_item_id: item.id,
        received_quantity: Math.max(0, numeric(value.received)),
        accepted_quantity: Math.max(0, numeric(value.accepted)),
        shortage_quantity: byType('shortage'),
        damaged_quantity: byType('damage'),
        wrong_item_quantity: byType('wrong_item'),
        excess_quantity: byType('excess'),
        note: null,
        issues: itemIssues,
      } satisfies PurchaseReceiptSubmitItem
    }).filter((item) => item.received_quantity > 0 || item.accepted_quantity > 0 || (item.issues?.length ?? 0) > 0)
    await onReceive({ locationId, notes: notes.trim() || null, items: payload })
    setNotes('')
    setFormItems(Object.fromEntries(items.map((item) => [item.id, emptyItem()])))
    await loadIssues()
    await loadFinancial()
  }

  const beginIssueAction = (issue: IssueRow, mode: 'treatment' | 'resolve' | 'cancel') => {
    setActionIssueId(issue.id)
    setActionMode(mode)
    setActionDisposition(issue.disposition)
    setActionNotes('')
    setActionReference('')
  }
  const closeIssueAction = () => {
    setActionIssueId(null)
    setActionMode(null)
    setActionNotes('')
    setActionReference('')
  }

  const saveIssueAction = async (issue: IssueRow) => {
    if (!actionMode || issueSaving) return
    if ((actionMode === 'resolve' || actionMode === 'cancel') && actionNotes.trim().length < 3) {
      toast.error(actionMode === 'resolve' ? 'Descreva como a ressalva foi resolvida.' : 'Informe o motivo do cancelamento.')
      return
    }
    setIssueSaving(true)
    try {
      if (actionMode === 'treatment') {
        const { error } = await supabase.rpc('update_purchase_receipt_issue_treatment', {
          p_issue_id: issue.id,
          p_disposition: actionDisposition,
          p_notes: actionNotes.trim() || null,
          p_resolution_reference: actionReference.trim() || null,
        })
        if (error) throw error
        toast.success('Tratativa atualizada e auditada.')
        closeIssueAction()
        await loadIssues()
        return
      }
      if (actionMode === 'resolve') {
        const { error } = await supabase.rpc('resolve_purchase_receipt_issue', {
          p_issue_id: issue.id,
          p_resolution_notes: actionNotes.trim(),
          p_resolution_reference: actionReference.trim() || null,
        })
        if (error) throw error
        toast.success('Ressalva resolvida e preservada no histórico.')
        closeIssueAction()
        await loadIssues()
        return
      }
      const { error } = await supabase.rpc('cancel_purchase_receipt_issue', { p_issue_id: issue.id, p_reason: actionNotes.trim() })
      if (error) throw error
      toast.success('Ressalva cancelada sem apagar o histórico.')
      closeIssueAction()
      await loadIssues()
    } catch (error) {
      console.error('Error handling purchase receipt issue:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar a ressalva.')
    } finally {
      setIssueSaving(false)
    }
  }

  const reverse = async () => {
    if (!reverseReceiptId || reverseReason.trim().length < 3 || saving) return
    await onReverse(reverseReceiptId, reverseReason.trim())
    setReverseReceiptId(null)
    setReverseReason('')
    await loadIssues()
  }

  if (!open) return null
  const activeIssues = issues.filter((issue) => !['resolved', 'cancelled'].includes(issue.status))
  const replacementOpen = activeIssues.reduce((sum, issue) => sum + numeric(issue.replacement_pending_quantity), 0)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-2 backdrop-blur-[2px] sm:p-4">
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-300 bg-white shadow-2xl ring-1 ring-black/10 dark:border-slate-500 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.85)] dark:ring-2 dark:ring-teal-400/20">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 sm:px-6">
          <div><h2 className="text-lg font-semibold text-slate-950 dark:text-white">Receber compra</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{documentCode} · {supplierName}</p></div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-950" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-5 p-4 sm:p-6">
          <section className="rounded-2xl border border-teal-200 bg-teal-50/70 p-4 dark:border-teal-800 dark:bg-teal-950/20">
            <div className="flex items-start gap-3">
              <BadgeDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-teal-700 dark:text-teal-300" />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-950 dark:text-white">Condição financeira da compra</h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">A condição e a forma de pagamento ficam ligadas à compra. A conta efetiva que terá a saída pode ser escolhida depois, no momento da baixa em Contas a Pagar.</p>
              </div>
            </div>
            {financialLoading ? (
              <p className="mt-3 text-sm text-slate-500">Carregando condição financeira...</p>
            ) : canManageFinancial ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Condição de pagamento
                  <select value={paymentTermId} onChange={(event) => changePaymentTerm(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                    <option value="">Selecione...</option>
                    {paymentTerms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Forma de pagamento
                  <select value={paymentMethodCode} onChange={(event) => setPaymentMethodCode(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                    <option value="">Definir depois</option>
                    {paymentOptions.payment_methods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Conta prevista <span className="font-normal text-slate-500">(opcional)</span>
                  <select value={preferredFinancialAccountId} onChange={(event) => setPreferredFinancialAccountId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2.5 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                    <option value="">Escolher somente na baixa</option>
                    {paymentOptions.financial_accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                </label>
                <div className="md:col-span-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">A conta prevista não obriga a baixa nessa conta. O financeiro poderá escolher outra conta quando efetivamente pagar.</p>
                  <button type="button" disabled={financialSaving || !paymentTermId} onClick={() => void saveFinancialTerms()} className="shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{financialSaving ? 'Salvando...' : 'Salvar condição financeira'}</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-teal-200 bg-white p-3 dark:border-teal-800 dark:bg-slate-950"><p className="text-[10px] font-bold uppercase text-slate-400">Condição</p><p className="mt-1 font-semibold">{paymentTermName}</p></div>
                <div className="rounded-xl border border-teal-200 bg-white p-3 dark:border-teal-800 dark:bg-slate-950"><p className="text-[10px] font-bold uppercase text-slate-400">Forma</p><p className="mt-1 font-semibold">{paymentMethodName}</p></div>
                <div className="rounded-xl border border-teal-200 bg-white p-3 dark:border-teal-800 dark:bg-slate-950"><p className="text-[10px] font-bold uppercase text-slate-400">Conta prevista</p><p className="mt-1 font-semibold">{preferredAccountName}</p></div>
                {!financialRow?.payment_term_id && <p className="sm:col-span-3 text-xs font-semibold text-amber-700 dark:text-amber-300">A condição financeira ainda precisa ser definida por um usuário com permissão financeira. Isso não impede o registro físico do recebimento.</p>}
              </div>
            )}
          </section>

          {activeIssues.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex gap-3"><FileWarning className="mt-0.5 h-5 w-5 shrink-0" /><div><b>{activeIssues.length} ressalva(s) em tratamento.</b><p className="mt-1">{replacementOpen > 0 ? `${qty(replacementOpen)} un. aguardam reposição física.` : 'Nenhuma mercadoria está aguardando reposição; restam apenas tratativas comerciais/documentais.'}</p></div></div>
            </div>
          )}

          {canReceive && pendingItems.length > 0 ? (
            <>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
                <div className="flex gap-3"><PackageCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><b>Registre o que aconteceu nesta entrega.</b><p className="mt-1">Se a diferença ainda será entregue, deixe-a aguardando mercadoria. Se houver avaria, falta aceita, item incorreto, excesso, crédito, abatimento ou devolução, registre uma ressalva.</p></div></div>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="min-w-0 flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">1. Local que recebe esta entrega
                    <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white sm:max-w-xl">
                      <option value="">Selecione o local</option>
                      {stockLocations.map((location) => <option key={location.id} value={location.id}>{location.name}{location.is_default ? ' · padrão' : ''}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={fillAll} className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-semibold text-emerald-800 dark:border-emerald-700 dark:text-emerald-200">Receber todo o saldo em aberto</button>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">2. Conferência dos itens</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">“Chegou agora” é o que o fornecedor apresentou. “Entra no estoque” é somente o que foi aceito.</p>
                <div className="mt-3 space-y-3">
                  {pendingItems.map((item) => {
                    const pending = pendingFor(item)
                    const progressItem = progress.get(item.id)
                    const value = formItems[item.id] ?? { ...emptyItem(), existingQuantity: pending }
                    const received = numeric(value.received)
                    const accepted = numeric(value.accepted)
                    const missing = received > 0 ? Math.max(0, pending - Math.min(received, pending)) : 0
                    const rejected = Math.max(0, Math.min(received, pending) - accepted)
                    const excess = Math.max(0, received - pending)
                    const invalidAccepted = accepted > pending || accepted > received
                    const hasPriorReceipt = numeric(progressItem?.received) > 0
                    return (
                      <article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                          <div><b className="text-slate-950 dark:text-white">{productName(item.product_id)}</b><div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-slate-100 px-2 py-1.5 dark:bg-slate-900">Pedido <b>{qty(item.quantity)}</b></span><span className="rounded-lg bg-slate-100 px-2 py-1.5 dark:bg-slate-900">Já entrou <b>{qty(progressItem?.received)}</b></span><span className="rounded-lg bg-amber-50 px-2 py-1.5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">Em aberto <b>{qty(pending)}</b></span></div></div>
                          <button type="button" onClick={() => fillItem(item)} className="h-fit rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-700 dark:text-emerald-200">Receber tudo deste item</button>
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Chegou agora<input type="number" min={0} step={1} value={value.received || ''} onChange={(event) => changeReceived(item.id, Number(event.target.value || 0), pending)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-950 dark:border-slate-600 dark:bg-slate-900 dark:text-white" /></label>
                          <label className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Entra no estoque<input type="number" min={0} max={pending} step={1} value={value.accepted || ''} onChange={(event) => patchItem(item.id, { accepted: Number(event.target.value || 0), treatExisting: false })} className={`mt-1 w-full rounded-xl border bg-white p-3 text-base text-slate-950 dark:bg-slate-900 dark:text-white ${invalidAccepted ? 'border-rose-500 ring-1 ring-rose-400' : 'border-emerald-300 dark:border-emerald-700'}`} /></label>
                        </div>
                        {invalidAccepted && <p className="mt-2 rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-200"><AlertTriangle className="mr-1 inline h-4 w-4" />O estoque não pode receber mais do que chegou nem mais do que o saldo em aberto.</p>}

                        {missing > 0 && (
                          <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 dark:border-blue-800 dark:bg-blue-950/20">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm text-blue-950 dark:text-blue-100">{qty(missing)} un. não vieram.</b><p className="text-xs text-blue-700 dark:text-blue-300">Por padrão, ficam aguardando próxima entrega.</p></div><button type="button" onClick={() => patchItem(item.id, { missingAsIssue: !value.missingAsIssue })} className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-800 dark:border-blue-700 dark:text-blue-200">{value.missingAsIssue ? 'Aguardar entrega' : 'Tratar como ressalva'}</button></div>
                            {value.missingAsIssue && <IssueEditor title="Tratativa do que não veio" quantity={missing} value={value.missingIssue} onChange={(next) => patchItem(item.id, { missingIssue: next })} types={ISSUE_TYPES.filter((option) => ['shortage', 'other'].includes(option.value))} />}
                          </div>
                        )}
                        {rejected > 0 && <IssueEditor title="Chegou, mas não entra no estoque" quantity={rejected} value={value.rejectedIssue} onChange={(next) => patchItem(item.id, { rejectedIssue: next })} types={ISSUE_TYPES.filter((option) => ['damage', 'wrong_item', 'other'].includes(option.value))} />}
                        {excess > 0 && <IssueEditor title="Veio além do pedido e não entra por esta compra" quantity={excess} value={value.excessIssue} onChange={(next) => patchItem(item.id, { excessIssue: { ...next, issueType: 'excess' } })} types={[{ value: 'excess', label: 'Excesso' }]} />}

                        {received === 0 && hasPriorReceipt && (
                          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm text-slate-900 dark:text-white">Esse saldo já estava em aberto.</b><p className="text-xs text-slate-500 dark:text-slate-400">Se ele não será mais entregue normalmente, transforme-o em uma ressalva auditável.</p></div><button type="button" onClick={() => patchItem(item.id, { treatExisting: !value.treatExisting, existingQuantity: pending })} className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:text-amber-200">{value.treatExisting ? 'Cancelar tratativa' : 'Tratar saldo existente'}</button></div>
                            {value.treatExisting && <><label className="mt-3 block max-w-40 text-xs font-semibold text-slate-700 dark:text-slate-200">Quantidade<input type="number" min={1} max={pending} step={1} value={value.existingQuantity || ''} onChange={(event) => patchItem(item.id, { existingQuantity: Number(event.target.value || 0) })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" /></label><IssueEditor title="Destino desse saldo" quantity={value.existingQuantity || pending} value={value.existingIssue} onChange={(next) => patchItem(item.id, { existingIssue: next })} /></>}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/60">
                <label className="text-sm font-medium text-slate-800 dark:text-slate-100">3. Observação geral<textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white" /></label>
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">{validation.completes ? <><b>Resultado:</b> a obrigação física ficará concluída. {validation.hasIssue && 'As ressalvas comerciais/documentais continuam auditadas até a solução.'}</> : <><b>Resultado:</b> só o que for aceito entra no estoque; entregas/reposições futuras continuam em aberto.</>}</div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm dark:border-slate-600">Voltar</button><button type="button" disabled={saving || !locationId || !validation.hasPayload || validation.invalid} onClick={() => void submit()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{saving ? 'Registrando...' : validation.hasIssue ? 'Registrar com ressalva' : validation.completes ? 'Registrar e concluir compra' : 'Registrar entrega parcial'}</button></div>
              </section>
            </>
          ) : pendingItems.length === 0 ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">A obrigação física desta compra está concluída. Novas quantidades estão bloqueadas; ressalvas abertas continuam em tratamento abaixo.</div> : <div className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-700">Você não possui permissão para registrar recebimentos.</div>}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/50">
            <div className="flex items-start justify-between gap-3"><div className="flex gap-2"><FileWarning className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-300" /><div><h3 className="font-semibold text-slate-950 dark:text-white">Ressalvas e tratativas</h3><p className="text-xs text-slate-500 dark:text-slate-400">Reposições, abatimentos, créditos e devoluções ficam aqui até a resolução.</p></div></div><span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-bold dark:bg-slate-800">{issues.length}</span></div>
            {issuesLoading ? <p className="mt-3 text-sm text-slate-500">Carregando...</p> : issues.length === 0 ? <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700">Nenhuma ressalva formal registrada.</p> : <div className="mt-3 space-y-3">{issues.map((issue) => {
              const actionOpen = actionIssueId === issue.id
              const openIssue = !['resolved', 'cancelled'].includes(issue.status)
              return <article key={issue.id} className={`rounded-xl border p-3 ${issue.status === 'resolved' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20' : issue.status === 'cancelled' ? 'border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-900' : 'border-amber-200 bg-white dark:border-amber-800 dark:bg-slate-950'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap gap-2"><b className="text-slate-950 dark:text-white">{issue.issue_code}</b><span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">{TYPE_LABEL[issue.issue_type]} · {qty(issue.quantity)} un.</span><span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold dark:bg-slate-800">{STATUS_LABEL[issue.status]}</span></div><p className="mt-1 text-sm font-semibold">{productName(issue.product_id)} · {DISPOSITION_LABEL[issue.disposition]}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dateTime(issue.opened_at)} · {actorName(issue.opened_by)} · impacto {money(issue.estimated_amount)}</p>{issue.replacement_pending_quantity > 0 && <p className="mt-1 text-xs font-bold text-blue-700 dark:text-blue-300"><Truck className="mr-1 inline h-3.5 w-3.5" />Aguardando reposição: {qty(issue.replacement_pending_quantity)} un.</p>}{issue.notes && <p className="mt-2 text-sm">{issue.notes}</p>}{issue.resolution_notes && <p className="mt-2 rounded-lg bg-emerald-100/70 p-2 text-xs dark:bg-emerald-950/50">Solução: {issue.resolution_notes}{issue.resolution_reference ? ` · Ref.: ${issue.resolution_reference}` : ''}</p>}{issue.cancellation_reason && <p className="mt-2 text-xs text-slate-500">Cancelada: {issue.cancellation_reason}</p>}</div>
                {openIssue && <button type="button" onClick={() => { onClose(); navigate(`/admin/stock/divergences?issue=${encodeURIComponent(issue.issue_code)}`) }} className="h-fit rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white">Tratar pendência</button>}
                {openIssue && canReceive && <div className="flex h-fit flex-wrap gap-2"><button type="button" onClick={() => beginIssueAction(issue, 'treatment')} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold dark:border-slate-600">Alterar tratativa</button>{issue.status !== 'waiting_supplier' && <button type="button" onClick={() => beginIssueAction(issue, 'resolve')} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white">Registrar solução</button>}{canReverse && <button type="button" onClick={() => beginIssueAction(issue, 'cancel')} className="rounded-lg border border-rose-300 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:border-rose-700 dark:text-rose-200">Cancelar</button>}</div>}</div>
                {actionOpen && <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">{actionMode === 'treatment' && <label className="text-xs font-semibold">Nova tratativa<select value={actionDisposition} onChange={(event) => setActionDisposition(event.target.value as IssueDisposition)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white">{DISPOSITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}<label className="mt-2 block text-xs font-semibold">{actionMode === 'cancel' ? 'Motivo' : actionMode === 'resolve' ? 'Como foi resolvida?' : 'Observação'}<textarea rows={2} value={actionNotes} onChange={(event) => setActionNotes(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" /></label>{actionMode !== 'cancel' && <label className="mt-2 block text-xs font-semibold">Referência (opcional)<input value={actionReference} onChange={(event) => setActionReference(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white" /></label>}<div className="mt-3 flex justify-end gap-2"><button type="button" onClick={closeIssueAction} className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-600">Voltar</button><button type="button" disabled={issueSaving} onClick={() => void saveIssueAction(issue)} className={`rounded-lg px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${actionMode === 'cancel' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{issueSaving ? 'Salvando...' : 'Confirmar'}</button></div></div>}
              </article>
            })}</div>}
          </section>

          <section>
            <button type="button" onClick={() => setHistoryOpen((value) => !value)} className="mb-3 flex w-full items-start justify-between text-left"><div className="flex gap-2"><History className="mt-0.5 h-5 w-5 text-teal-600 dark:text-teal-300" /><div><h3 className="font-semibold">Histórico de recebimentos</h3><p className="text-xs text-slate-500 dark:text-slate-400">Entregas, tratativas e reversões permanecem auditáveis.</p></div></div>{historyOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}</button>
            {historyOpen && (receipts.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">Nenhum recebimento registrado.</p> : <div className="space-y-3">{receipts.map((receipt) => {
              const reversed = receipt.status === 'reversed'
              const treatmentOnly = receipt.source === 'purchase_issue_treatment'
              const reversing = reverseReceiptId === receipt.id
              return <article key={receipt.id} className={`rounded-2xl border p-4 ${reversed ? 'border-rose-200 bg-rose-50/60 dark:border-rose-800 dark:bg-rose-950/20' : treatmentOnly ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/20' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950'}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap gap-2"><b>{receipt.receipt_code}</b><span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold dark:bg-slate-800">{reversed ? 'Revertido' : treatmentOnly ? 'Tratativa' : 'Válido'}</span></div><p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{receipt.location_name} · {dateTime(receipt.received_at)} · {actorName(receipt.received_by)}</p>{!treatmentOnly && <p className="mt-1 text-xs text-slate-500">Chegou: {qty(receipt.reported_quantity_total)} · Entrou no estoque: {qty(receipt.accepted_quantity_total)}</p>}{receipt.notes && <p className="mt-2 text-sm">{receipt.notes}</p>}</div>{!reversed && canReverse && <button type="button" onClick={() => { setReverseReceiptId(receipt.id); setReverseReason('') }} className="h-fit rounded-xl border border-rose-300 px-3 py-2 text-xs font-semibold text-rose-700 dark:border-rose-700 dark:text-rose-200"><RotateCcw className="mr-1 inline h-4 w-4" />Desfazer registro</button>}</div>
                <div className="mt-3 grid gap-2 lg:grid-cols-2">{(receiptItemsByReceipt.get(receipt.id) ?? []).map((entry) => <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900"><b>{productName(entry.product_id)}</b><p className="mt-1">{treatmentOnly ? 'Tratativa registrada sem movimentação física.' : `Chegou ${qty(entry.reported_quantity)} · entrou ${qty(entry.accepted_quantity)}`}</p></div>)}</div>
                {reversed && <p className="mt-3 rounded-lg bg-rose-100 p-2 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">Desfeito em {dateTime(receipt.reversed_at)} por {actorName(receipt.reversed_by)}. {receipt.reversal_reason}</p>}
                {reversing && <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-950/30"><p className="text-xs text-rose-900 dark:text-rose-100"><AlertTriangle className="mr-1 inline h-4 w-4" />A reversão retira o estoque aceito e invalida as ressalvas da compra, sem apagar o histórico.</p><textarea rows={2} value={reverseReason} onChange={(event) => setReverseReason(event.target.value)} className="mt-2 w-full rounded-lg border border-rose-300 bg-white p-2 text-sm dark:border-rose-700 dark:bg-slate-950 dark:text-white" placeholder="Motivo obrigatório" /><div className="mt-2 flex justify-end gap-2"><button type="button" onClick={() => setReverseReceiptId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs dark:border-slate-600">Voltar</button><button type="button" disabled={saving || reverseReason.trim().length < 3} onClick={() => void reverse()} className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Confirmar reversão</button></div></div>}
              </article>
            })}</div>)}
          </section>
        </div>
      </div>
    </div>
  )
}
