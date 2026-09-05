import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowUpDown,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  History,
  PackageCheck,
  Pencil,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'

import AlertBanner from '@/components/common/AlertBanner'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import PageContainer from '@/components/common/PageContainer'
import StatsCard from '@/components/common/StatsCard'
import { usePermissions } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabase'
import type { Supplier } from '@/pages/private/admin/products/suppliers/types/supplier.types'
import {
  formatDateOnlyPtBr,
  formatDateTimeForExportPtBr,
  getLocalDateInputValue,
} from '@/utils/dateTime'
import { buildCsv, downloadCsv, formatCsvNumberBR } from '@/utils/csv'
import { getActiveStoreId } from '@/utils/activeStore'

import OperationalTimeline from './components/OperationalTimeline'
import PurchaseReceiptModal, {
  type PurchaseReceiptItemRow,
  type PurchaseReceiptRow,
  type PurchaseReceiptSubmitItem,
} from './components/PurchaseReceiptModal'
import { PurchaseQuotationsPanel } from './components/PurchaseQuotationsPanel'
import { PurchaseSuggestionsPanel } from './components/PurchaseSuggestionsPanel'
import { useInventory } from './hooks/useInventory'
import { useOperationalTimeline } from './hooks/useOperationalTimeline'
import { buildPurchaseReceiptProgress } from './utils/purchaseReceiptUtils'
import { isSupplierPurchaseEligible } from './utils/supplierStatusUtils'

type PurchaseDocumentStatus =
  | 'draft'
  | 'partially_received'
  | 'confirmed'
  | 'canceled'
  | 'cancelled'

type PurchaseDocument = {
  id: string
  store_id: string
  supplier_id: string | null
  status: PurchaseDocumentStatus
  issue_date: string | null
  invoice_number: string | null
  notes: string | null
  created_at: string
  total_amount: number | null
  cancelled_at?: string | null
  cancel_reason?: string | null
  document_code?: string | null
}

type PurchaseDocumentOrigin = {
  quotationCode: string
  roundCode: string | null
}

type PurchaseSortKey = 'supplier' | 'document' | 'issue_date' | 'status' | 'total'
type SortDirection = 'asc' | 'desc'
type StockLocation = { id: string; name: string; code: string; is_default: boolean }

type PurchaseDocumentItemInput = {
  id?: string
  product_id: string
  quantity: number
  unit_cost: number | null
}

type PurchaseDocumentItemRow = {
  id: string
  purchase_document_id: string
  product_id: string
  quantity: number
  unit_cost: number | null
  total_cost: number | null
}

type InventoryProductLike = {
  id: string
  name: string
  active?: boolean | null
  discontinued?: boolean | null
  is_discontinued?: boolean | null
  last_entry_unit_cost?: number | null
}

type ProfileRow = { id: string; name: string | null }

const money = (value: number | null | undefined) =>
  (value ?? 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message
    if (typeof msg === 'string' && msg.trim()) return msg
  }
  return fallback
}

const shortId = (value?: string | null) => (value ? value.slice(0, 8) : '—')
const formatDatePtBr = (value?: string | null) => formatDateOnlyPtBr(value, '')

const getPurchaseDocumentStatusLabel = (status?: string | null) => {
  switch (status) {
    case 'draft':
      return 'Rascunho'
    case 'partially_received':
      return 'Parcialmente recebida'
    case 'confirmed':
      return 'Confirmada'
    case 'cancelled':
    case 'canceled':
      return 'Cancelada'
    default:
      return status || 'Não informado'
  }
}

const getStatusBadgeClass = (status?: string | null) => {
  if (status === 'confirmed') {
    return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  }
  if (status === 'partially_received') {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
  }
  if (status === 'cancelled' || status === 'canceled') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
  }
  return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
}

export default function PurchaseDocumentsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { products: inventoryProducts } = useInventory()

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [documents, setDocuments] = useState<PurchaseDocument[]>([])
  const [documentItems, setDocumentItems] = useState<PurchaseDocumentItemRow[]>([])
  const [documentOrigins, setDocumentOrigins] = useState<Record<string, PurchaseDocumentOrigin>>({})
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([])
  const [purchaseReceipts, setPurchaseReceipts] = useState<PurchaseReceiptRow[]>([])
  const [purchaseReceiptItems, setPurchaseReceiptItems] = useState<PurchaseReceiptItemRow[]>([])
  const [profileNames, setProfileNames] = useState<Record<string, string>>({})
  const [pageError, setPageError] = useState<string | null>(null)

  const [draftOpen, setDraftOpen] = useState(false)
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [editingReadOnly, setEditingReadOnly] = useState(false)
  const [editingStatus, setEditingStatus] = useState<PurchaseDocumentStatus | null>(null)
  const [draftSupplierId, setDraftSupplierId] = useState('')
  const [draftIssueDate, setDraftIssueDate] = useState(() => getLocalDateInputValue())
  const [draftInvoiceNumber, setDraftInvoiceNumber] = useState('')
  const [draftNotes, setDraftNotes] = useState('')
  const [draftItems, setDraftItems] = useState<PurchaseDocumentItemInput[]>([
    { product_id: '', quantity: 1, unit_cost: null },
  ])
  const [autoOpenedDocId, setAutoOpenedDocId] = useState<string | null>(null)

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<PurchaseDocument | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [receiveTargetId, setReceiveTargetId] = useState<string | null>(null)

  const [sortConfig, setSortConfig] = useState<{ key: PurchaseSortKey; direction: SortDirection }>({
    key: 'issue_date',
    direction: 'desc',
  })
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    supplierId: searchParams.get('supplier_id') || '',
    productId: searchParams.get('product_id') || '',
    invoiceNumber: '',
  })

  const activeStoreId = getActiveStoreId()
  const { hasPermission } = usePermissions(activeStoreId)
  const canCreatePurchase = hasPermission('purchases.create')
  const canConfirmPurchase = hasPermission('purchases.confirm')
  const canCancelPurchase = hasPermission('purchases.cancel')
  const canViewQuotations = hasPermission('quotes.view')
  const canManageQuotations = hasPermission('quotes.manage')

  const {
    events: purchaseDocumentTimelineEvents,
    loading: loadingPurchaseDocumentTimeline,
    refetch: refetchPurchaseDocumentTimeline,
  } = useOperationalTimeline({
    enabled: Boolean(draftOpen && editingDocId),
    storeId,
    entityType: 'purchase_document',
    relatedPurchaseDocumentId: editingDocId,
    limit: 50,
  })

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'))
  }, [])

  const products = useMemo(
    () =>
      ((inventoryProducts ?? []) as InventoryProductLike[]).filter(
        (product) =>
          product.active !== false &&
          product.discontinued !== true &&
          product.is_discontinued !== true
      ),
    [inventoryProducts]
  )

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products])
  const eligibleSuppliers = useMemo(
    () => suppliers.filter(isSupplierPurchaseEligible),
    [suppliers]
  )

  const itemsByDocument = useMemo(() => {
    const map = new Map<string, PurchaseDocumentItemRow[]>()
    documentItems.forEach((item) => {
      const list = map.get(item.purchase_document_id) ?? []
      list.push(item)
      map.set(item.purchase_document_id, list)
    })
    return map
  }, [documentItems])

  const receiptsByDocument = useMemo(() => {
    const map = new Map<string, PurchaseReceiptRow[]>()
    purchaseReceipts.forEach((receipt) => {
      const list = map.get(receipt.purchase_document_id) ?? []
      list.push(receipt)
      map.set(receipt.purchase_document_id, list)
    })
    map.forEach((list) => list.sort((a, b) => b.received_at.localeCompare(a.received_at)))
    return map
  }, [purchaseReceipts])

  const receiptItemsByDocument = useMemo(() => {
    const map = new Map<string, PurchaseReceiptItemRow[]>()
    purchaseReceiptItems.forEach((item) => {
      const list = map.get(item.purchase_document_id) ?? []
      list.push(item)
      map.set(item.purchase_document_id, list)
    })
    return map
  }, [purchaseReceiptItems])

  const productName = useCallback(
    (id: string | null) => (id ? productMap.get(id)?.name ?? shortId(id) : '—'),
    [productMap]
  )

  const supplierName = useCallback(
    (id: string | null) => (id ? suppliers.find((supplier) => supplier.id === id)?.name ?? shortId(id) : '—'),
    [suppliers]
  )

  const actorName = useCallback(
    (id: string | null) => (id ? profileNames[id] || `Usuário ${shortId(id)}` : '—'),
    [profileNames]
  )

  const filteredDocuments = useMemo(
    () =>
      documents.filter((doc) => {
        const issueDate = doc.issue_date ? new Date(`${doc.issue_date}T00:00:00`) : null
        if (filters.dateFrom) {
          const from = new Date(`${filters.dateFrom}T00:00:00`)
          if (!issueDate || issueDate < from) return false
        }
        if (filters.dateTo) {
          const to = new Date(`${filters.dateTo}T23:59:59`)
          if (!issueDate || issueDate > to) return false
        }
        if (filters.status && doc.status !== filters.status) return false
        if (filters.supplierId && doc.supplier_id !== filters.supplierId) return false
        if (filters.productId) {
          const hasProduct = (itemsByDocument.get(doc.id) ?? []).some(
            (item) => item.product_id === filters.productId
          )
          if (!hasProduct) return false
        }
        if (filters.invoiceNumber.trim()) {
          const term = filters.invoiceNumber.trim().toLowerCase()
          const origin = documentOrigins[doc.id]
          const matches = [
            doc.invoice_number,
            doc.document_code,
            origin?.quotationCode,
            origin?.roundCode,
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(term))
          if (!matches) return false
        }
        return true
      }),
    [documentOrigins, documents, filters, itemsByDocument]
  )

  const sortedDocuments = useMemo(() => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1
    return [...filteredDocuments].sort((left, right) => {
      const values: Record<PurchaseSortKey, [string | number, string | number]> = {
        supplier: [supplierName(left.supplier_id).toLowerCase(), supplierName(right.supplier_id).toLowerCase()],
        document: [
          (left.document_code || left.invoice_number || left.id).toLowerCase(),
          (right.document_code || right.invoice_number || right.id).toLowerCase(),
        ],
        issue_date: [left.issue_date || left.created_at, right.issue_date || right.created_at],
        status: [getPurchaseDocumentStatusLabel(left.status), getPurchaseDocumentStatusLabel(right.status)],
        total: [Number(left.total_amount || 0), Number(right.total_amount || 0)],
      }
      const [a, b] = values[sortConfig.key]
      const result =
        typeof a === 'number' && typeof b === 'number'
          ? a - b
          : String(a).localeCompare(String(b), 'pt-BR', { numeric: true })
      return result * direction
    })
  }, [filteredDocuments, sortConfig, supplierName])

  const stats = useMemo(() => {
    const drafts = filteredDocuments.filter((doc) => doc.status === 'draft').length
    const partial = filteredDocuments.filter((doc) => doc.status === 'partially_received').length
    const confirmed = filteredDocuments.filter((doc) => doc.status === 'confirmed').length
    const totalConfirmed = filteredDocuments
      .filter((doc) => doc.status === 'confirmed')
      .reduce((sum, doc) => sum + Number(doc.total_amount || 0), 0)
    return { drafts, partial, confirmed, totalConfirmed }
  }, [filteredDocuments])

  const currentDraftTotal = useMemo(
    () =>
      draftItems.reduce(
        (sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_cost || 0),
        0
      ),
    [draftItems]
  )

  const canSaveDraft = useMemo(
    () => Boolean(storeId && draftSupplierId && draftItems.some((item) => item.product_id && item.quantity > 0)),
    [draftItems, draftSupplierId, storeId]
  )

  const receiveTarget = useMemo(
    () => (receiveTargetId ? documents.find((doc) => doc.id === receiveTargetId) ?? null : null),
    [documents, receiveTargetId]
  )

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setPageError(null)
    try {
      const selectedStoreId = getActiveStoreId()
      if (!selectedStoreId) throw new Error('Loja não encontrada')
      setStoreId(selectedStoreId)

      const [supplierRes, documentRes, itemRes, quotationRes, roundRes, locationRes, receiptRes, receiptItemRes] =
        await Promise.all([
          supabase
            .from('suppliers')
            .select('id, name, active, blocked, homologation_status')
            .eq('store_id', selectedStoreId)
            .order('name', { ascending: true }),
          supabase
            .from('purchase_documents')
            .select('*')
            .eq('store_id', selectedStoreId)
            .order('created_at', { ascending: false }),
          supabase
            .from('purchase_document_items')
            .select('id, purchase_document_id, product_id, quantity, unit_cost, total_cost')
            .eq('store_id', selectedStoreId),
          supabase
            .from('purchase_quotations')
            .select('converted_purchase_document_id, quotation_code, quotation_round_id')
            .eq('store_id', selectedStoreId)
            .not('converted_purchase_document_id', 'is', null),
          supabase
            .from('purchase_quotation_rounds')
            .select('id, round_code')
            .eq('store_id', selectedStoreId),
          supabase
            .from('stock_locations')
            .select('id, name, code, is_default')
            .eq('store_id', selectedStoreId)
            .eq('active', true)
            .order('is_default', { ascending: false })
            .order('sort_order', { ascending: true }),
          supabase
            .from('purchase_receipts')
            .select('*')
            .eq('store_id', selectedStoreId)
            .order('received_at', { ascending: false }),
          supabase
            .from('purchase_receipt_items')
            .select('*')
            .eq('store_id', selectedStoreId),
        ])

      const results = [supplierRes, documentRes, itemRes, quotationRes, roundRes, locationRes, receiptRes, receiptItemRes]
      const firstError = results.find((result) => result.error)?.error
      if (firstError) throw firstError

      const nextReceipts = (receiptRes.data ?? []) as PurchaseReceiptRow[]
      setSuppliers((supplierRes.data ?? []) as Supplier[])
      setDocuments((documentRes.data ?? []) as PurchaseDocument[])
      setDocumentItems((itemRes.data ?? []) as PurchaseDocumentItemRow[])
      setStockLocations((locationRes.data ?? []) as StockLocation[])
      setPurchaseReceipts(nextReceipts)
      setPurchaseReceiptItems((receiptItemRes.data ?? []) as PurchaseReceiptItemRow[])

      const roundCodes = new Map((roundRes.data ?? []).map((round) => [round.id, round.round_code]))
      setDocumentOrigins(
        Object.fromEntries(
          (quotationRes.data ?? [])
            .filter((quotation) => quotation.converted_purchase_document_id)
            .map((quotation) => [
              quotation.converted_purchase_document_id,
              {
                quotationCode: quotation.quotation_code,
                roundCode: quotation.quotation_round_id
                  ? roundCodes.get(quotation.quotation_round_id) ?? null
                  : null,
              },
            ])
        )
      )

      const actorIds = Array.from(
        new Set(
          nextReceipts
            .flatMap((receipt) => [receipt.received_by, receipt.reversed_by])
            .filter((id): id is string => Boolean(id))
        )
      )
      if (actorIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', actorIds)
        setProfileNames(
          Object.fromEntries(
            ((profiles ?? []) as ProfileRow[]).map((profile) => [
              profile.id,
              profile.name?.trim() || `Usuário ${shortId(profile.id)}`,
            ])
          )
        )
      } else {
        setProfileNames({})
      }
    } catch (error) {
      console.error('Error loading purchase documents:', error)
      setPageError(getErrorMessage(error, 'Erro ao carregar compras'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  useEffect(() => {
    const supplierIdFromUrl = searchParams.get('supplier_id') || ''
    const productIdFromUrl = searchParams.get('product_id') || ''
    setFilters((current) =>
      current.supplierId === supplierIdFromUrl && current.productId === productIdFromUrl
        ? current
        : { ...current, supplierId: supplierIdFromUrl, productId: productIdFromUrl }
    )
  }, [searchParams])

  const resetDraft = useCallback(() => {
    setEditingDocId(null)
    setEditingReadOnly(false)
    setEditingStatus(null)
    setDraftSupplierId('')
    setDraftIssueDate(getLocalDateInputValue())
    setDraftInvoiceNumber('')
    setDraftNotes('')
    setDraftItems([{ product_id: '', quantity: 1, unit_cost: null }])
  }, [])

  const closeDraftModal = useCallback(() => {
    setDraftOpen(false)
    setAutoOpenedDocId(searchParams.get('open'))
    if (!searchParams.has('open')) return
    const next = new URLSearchParams(searchParams)
    next.delete('open')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const openNewDraft = useCallback(() => {
    if (!canCreatePurchase) {
      toast.error('Você não tem permissão para criar compras.')
      return
    }
    resetDraft()
    setDraftOpen(true)
  }, [canCreatePurchase, resetDraft])

  const openDocument = useCallback(
    (doc: PurchaseDocument, readOnly = false) => {
      const items = itemsByDocument.get(doc.id) ?? []
      setEditingDocId(doc.id)
      setEditingStatus(doc.status)
      setEditingReadOnly(doc.status !== 'draft' || readOnly)
      setDraftSupplierId(doc.supplier_id ?? '')
      setDraftIssueDate(doc.issue_date ?? getLocalDateInputValue())
      setDraftInvoiceNumber(doc.invoice_number ?? '')
      setDraftNotes(doc.notes ?? '')
      setDraftItems(
        items.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_cost: item.unit_cost == null ? null : Number(item.unit_cost),
        }))
      )
      setDraftOpen(true)
    },
    [itemsByDocument]
  )

  useEffect(() => {
    const openId = searchParams.get('open')
    if (!openId || loading || autoOpenedDocId === openId) return
    const target = documents.find((doc) => doc.id === openId)
    if (!target) return
    setAutoOpenedDocId(openId)
    openDocument(target, true)
  }, [autoOpenedDocId, documents, loading, openDocument, searchParams])

  const addDraftItem = useCallback(
    () => setDraftItems((current) => [...current, { product_id: '', quantity: 1, unit_cost: null }]),
    []
  )
  const removeDraftItem = useCallback(
    (index: number) => setDraftItems((current) => current.filter((_, itemIndex) => itemIndex !== index)),
    []
  )
  const updateDraftItem = useCallback((index: number, patch: Partial<PurchaseDocumentItemInput>) => {
    setDraftItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    )
  }, [])

  const createOrUpdateDraft = useCallback(async () => {
    if (!canCreatePurchase) {
      toast.error('Você não tem permissão para editar compras.')
      return
    }
    if (!canSaveDraft) {
      toast.error('Selecione o fornecedor e adicione ao menos 1 item válido.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('save_purchase_document_draft_atomic', {
        p_document_id: editingDocId,
        p_supplier_id: draftSupplierId,
        p_issue_date: draftIssueDate || null,
        p_invoice_number: draftInvoiceNumber.trim() || null,
        p_notes: draftNotes.trim() || null,
        p_items: draftItems
          .filter((item) => item.product_id && item.quantity > 0)
          .map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost ?? 0,
          })),
      })
      if (error) throw error
      toast.success(editingDocId ? 'Documento atualizado.' : 'Documento criado.')
      setDraftOpen(false)
      resetDraft()
      await fetchAll()
      await refetchPurchaseDocumentTimeline()
    } catch (error) {
      console.error('Error saving purchase document:', error)
      toast.error(getErrorMessage(error, 'Erro ao salvar documento'))
    } finally {
      setSaving(false)
    }
  }, [
    canCreatePurchase,
    canSaveDraft,
    draftInvoiceNumber,
    draftIssueDate,
    draftItems,
    draftNotes,
    draftSupplierId,
    editingDocId,
    fetchAll,
    refetchPurchaseDocumentTimeline,
    resetDraft,
  ])

  const deleteDraft = useCallback(
    async (docId: string) => {
      if (!canCancelPurchase) {
        toast.error('Você não tem permissão para excluir rascunhos de compra.')
        return
      }
      if (!window.confirm('Excluir este rascunho é irreversível. Deseja continuar?')) return
      setSaving(true)
      try {
        const { error } = await supabase.rpc('delete_purchase_document_draft', {
          p_document_id: docId,
        })
        if (error) throw error
        toast.success('Rascunho removido.')
        if (editingDocId === docId) {
          setDraftOpen(false)
          resetDraft()
        }
        await fetchAll()
        await refetchPurchaseDocumentTimeline()
      } catch (error) {
        console.error('Error deleting purchase draft:', error)
        toast.error(getErrorMessage(error, 'Erro ao remover rascunho'))
      } finally {
        setSaving(false)
      }
    },
    [canCancelPurchase, editingDocId, fetchAll, refetchPurchaseDocumentTimeline, resetDraft]
  )

  const openCancelModal = useCallback((doc: PurchaseDocument) => {
    setCancelTarget(doc)
    setCancelReason('')
    setCancelOpen(true)
  }, [])

  const cancelPurchaseDocument = useCallback(async () => {
    if (!cancelTarget) return
    if (!canCancelPurchase) {
      toast.error('Você não tem permissão para cancelar compras.')
      return
    }
    if (cancelReason.trim().length < 3) {
      toast.error('Informe um motivo com pelo menos 3 caracteres.')
      return
    }
    if (
      !window.confirm(
        'O cancelamento reverterá todas as parcelas ativas, ajustará o estoque e preservará todo o histórico. Deseja continuar?'
      )
    ) {
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('cancel_purchase_document', {
        p_document_id: cancelTarget.id,
        p_reason: cancelReason.trim(),
      })
      if (error) throw error
      toast.success('Compra cancelada com reversão auditável do estoque.')
      setCancelOpen(false)
      setCancelTarget(null)
      setCancelReason('')
      setDraftOpen(false)
      resetDraft()
      await fetchAll()
      await refetchPurchaseDocumentTimeline()
    } catch (error) {
      console.error('Error cancelling purchase document:', error)
      toast.error(getErrorMessage(error, 'Erro ao cancelar compra'))
    } finally {
      setSaving(false)
    }
  }, [
    canCancelPurchase,
    cancelReason,
    cancelTarget,
    fetchAll,
    refetchPurchaseDocumentTimeline,
    resetDraft,
  ])

  const receivePurchase = useCallback(
    async (payload: {
      locationId: string
      notes: string | null
      items: PurchaseReceiptSubmitItem[]
    }) => {
      if (!receiveTargetId) return
      if (!canConfirmPurchase) {
        toast.error('Você não tem permissão para receber compras.')
        return
      }
      setSaving(true)
      try {
        const { data, error } = await supabase.rpc('receive_purchase_document_items', {
          p_document_id: receiveTargetId,
          p_location_id: payload.locationId,
          p_items: payload.items,
          p_notes: payload.notes,
        })
        if (error) throw error
        const result = Array.isArray(data) ? data[0] : data
        toast.success(
          result?.document_status === 'confirmed'
            ? `Parcela ${result?.receipt_code ?? ''} registrada e compra concluída.`
            : `Parcela ${result?.receipt_code ?? ''} registrada. A compra permanece parcialmente recebida.`
        )
        await fetchAll()
        await refetchPurchaseDocumentTimeline()
      } catch (error) {
        console.error('Error receiving purchase:', error)
        toast.error(getErrorMessage(error, 'Erro ao registrar recebimento'))
        throw error
      } finally {
        setSaving(false)
      }
    },
    [canConfirmPurchase, fetchAll, receiveTargetId, refetchPurchaseDocumentTimeline]
  )

  const reverseReceipt = useCallback(
    async (receiptId: string, reason: string) => {
      if (!canCancelPurchase) {
        toast.error('Você não tem permissão para reverter parcelas.')
        return
      }
      setSaving(true)
      try {
        const { data, error } = await supabase.rpc('reverse_purchase_receipt', {
          p_receipt_id: receiptId,
          p_reason: reason,
        })
        if (error) throw error
        const result = Array.isArray(data) ? data[0] : data
        toast.success(
          `Parcela ${result?.receipt_code ?? ''} revertida. Status da compra: ${getPurchaseDocumentStatusLabel(result?.document_status)}.`
        )
        await fetchAll()
        await refetchPurchaseDocumentTimeline()
      } catch (error) {
        console.error('Error reversing purchase receipt:', error)
        toast.error(getErrorMessage(error, 'Erro ao reverter parcela'))
        throw error
      } finally {
        setSaving(false)
      }
    },
    [canCancelPurchase, fetchAll, refetchPurchaseDocumentTimeline]
  )

  const toggleSort = useCallback((key: PurchaseSortKey) => {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }, [])

  const sortIcon = useCallback(
    (key: PurchaseSortKey) => {
      if (sortConfig.key !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      return sortConfig.direction === 'asc' ? (
        <ChevronUp className="h-4 w-4" />
      ) : (
        <ChevronDown className="h-4 w-4" />
      )
    },
    [sortConfig]
  )

  const resetFilters = useCallback(() => {
    setFilters({ dateFrom: '', dateTo: '', status: '', supplierId: '', productId: '', invoiceNumber: '' })
    const next = new URLSearchParams(searchParams)
    next.delete('supplier_id')
    next.delete('product_id')
    next.delete('open')
    setSearchParams(next, { replace: true })
    setAutoOpenedDocId(null)
  }, [searchParams, setSearchParams])

  const exportFilteredDocumentsCsv = useCallback(() => {
    if (!filteredDocuments.length) return
    const rows = filteredDocuments.map((doc) => {
      const items = itemsByDocument.get(doc.id) ?? []
      const receipts = receiptsByDocument.get(doc.id) ?? []
      const receiptItems = receiptItemsByDocument.get(doc.id) ?? []
      const progress = buildPurchaseReceiptProgress(items, receipts, receiptItems)
      const itemSummary = items
        .map((item) => {
          const itemProgress = progress.get(item.id)
          return `${productName(item.product_id)} pedida ${formatCsvNumberBR(item.quantity, 0)} / recebida ${formatCsvNumberBR(itemProgress?.received ?? 0, 0)} / pendente ${formatCsvNumberBR(itemProgress?.pending ?? item.quantity, 0)}`
        })
        .join(' | ')
      return {
        'Código da compra': doc.document_code?.trim() || shortId(doc.id),
        'Documento/Nota': doc.invoice_number?.trim() || '',
        'Cotação de origem': documentOrigins[doc.id]?.quotationCode ?? '',
        'Rodada de origem': documentOrigins[doc.id]?.roundCode ?? '',
        Emissão: formatDatePtBr(doc.issue_date),
        Status: getPurchaseDocumentStatusLabel(doc.status),
        Fornecedor: supplierName(doc.supplier_id),
        Itens: itemSummary,
        'Parcelas registradas': receipts.length,
        'Total (R$)': formatCsvNumberBR(doc.total_amount ?? 0),
        'Criado em': formatDateTimeForExportPtBr(doc.created_at),
        'Cancelado em': formatDateTimeForExportPtBr(doc.cancelled_at),
        'Motivo do cancelamento': doc.cancel_reason ?? '',
        Observações: doc.notes ?? '',
      }
    })
    const csv = buildCsv(rows, [
      'Código da compra',
      'Documento/Nota',
      'Cotação de origem',
      'Rodada de origem',
      'Emissão',
      'Status',
      'Fornecedor',
      'Itens',
      'Parcelas registradas',
      'Total (R$)',
      'Criado em',
      'Cancelado em',
      'Motivo do cancelamento',
      'Observações',
    ])
    downloadCsv(`compras_e_entradas_${getLocalDateInputValue()}.csv`, csv)
  }, [
    documentOrigins,
    filteredDocuments,
    itemsByDocument,
    productName,
    receiptItemsByDocument,
    receiptsByDocument,
    supplierName,
  ])

  const renderReceiptSummary = useCallback(
    (doc: PurchaseDocument) => {
      const items = itemsByDocument.get(doc.id) ?? []
      const receipts = receiptsByDocument.get(doc.id) ?? []
      const receiptItems = receiptItemsByDocument.get(doc.id) ?? []
      if (!items.length) return null
      const progress = buildPurchaseReceiptProgress(items, receipts, receiptItems)
      const ordered = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
      const received = items.reduce((sum, item) => sum + Number(progress.get(item.id)?.received || 0), 0)
      const pending = Math.max(0, ordered - received)
      if (!receipts.length && doc.status === 'draft') return null
      return (
        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Recebida {received.toLocaleString('pt-BR')} de {ordered.toLocaleString('pt-BR')} · Pendente {pending.toLocaleString('pt-BR')}
        </div>
      )
    },
    [itemsByDocument, receiptItemsByDocument, receiptsByDocument]
  )

  const editingDocument = editingDocId ? documents.find((doc) => doc.id === editingDocId) ?? null : null
  const editingReceipts = editingDocId ? receiptsByDocument.get(editingDocId) ?? [] : []

  return (
    <>
      {portalContainer &&
        createPortal(
          <button
            type="button"
            onClick={() => navigate('/admin/stock/purchase-insights')}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Dashboard de compras
          </button>,
          portalContainer
        )}

      <PageContainer
        title="Compras e Entradas"
        subtitle="Cotações, rascunhos, recebimentos por parcela, divergências e histórico de estoque"
        category="Produtos"
        icon={<History size={28} className="text-[#19A999]" />}
        onRefresh={fetchAll}
        flat
      >
        {pageError ? <AlertBanner type="error" title="Atenção" message={pageError} /> : null}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">
            <PurchaseSuggestionsPanel
              storeId={storeId}
              canCreatePurchase={canCreatePurchase}
              canManageQuotations={canManageQuotations}
              onDraftCreated={async (purchaseDocumentId) => {
                await fetchAll()
                const next = new URLSearchParams(searchParams)
                next.set('open', purchaseDocumentId)
                next.delete('supplier_id')
                next.delete('product_id')
                setSearchParams(next, { replace: false })
                setAutoOpenedDocId(null)
              }}
            />

            {storeId && canViewQuotations ? (
              <PurchaseQuotationsPanel
                storeId={storeId}
                canManageQuotations={canManageQuotations}
              />
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatsCard title="Rascunhos" value={stats.drafts} icon={<FileText className="h-5 w-5" />} />
              <StatsCard title="Parcialmente recebidas" value={stats.partial} icon={<PackageCheck className="h-5 w-5" />} />
              <StatsCard title="Confirmadas" value={stats.confirmed} icon={<CheckCircle2 className="h-5 w-5" />} />
              <StatsCard title="Total confirmado" value={money(stats.totalConfirmed)} icon={<Save className="h-5 w-5" />} />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Uma compra pode ser recebida em várias parcelas e locais. Só a quantidade aceita entra no estoque.
                </div>
                <div className="flex flex-wrap gap-2">
                  {canCreatePurchase ? (
                    <button
                      type="button"
                      onClick={openNewDraft}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      <Plus className="h-4 w-4" />
                      Novo documento
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={exportFilteredDocumentsCsv}
                    disabled={!filteredDocuments.length}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <Download className="h-4 w-4" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Filtros</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Data, status, fornecedor, produto e documento.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <XCircle className="h-4 w-4" />
                    Limpar
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Data inicial
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    />
                  </label>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Data final
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    />
                  </label>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Status
                    <select
                      value={filters.status}
                      onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    >
                      <option value="">Todos</option>
                      <option value="draft">Rascunho</option>
                      <option value="partially_received">Parcialmente recebida</option>
                      <option value="confirmed">Confirmada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Fornecedor
                    <select
                      value={filters.supplierId}
                      onChange={(event) => setFilters((current) => ({ ...current, supplierId: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    >
                      <option value="">Todos</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Produto
                    <select
                      value={filters.productId}
                      onChange={(event) => setFilters((current) => ({ ...current, productId: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    >
                      <option value="">Todos</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>{product.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    Documento / nota
                    <input
                      type="text"
                      value={filters.invoiceNumber}
                      onChange={(event) => setFilters((current) => ({ ...current, invoiceNumber: event.target.value }))}
                      placeholder="Código, nota, cotação ou rodada"
                      className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                    />
                  </label>
                </div>
              </div>
            </div>

            {searchParams.get('supplier_id') ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
                Exibindo compras do fornecedor <b>{supplierName(searchParams.get('supplier_id'))}</b>.
              </div>
            ) : null}
            {searchParams.get('product_id') ? (
              <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-800 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-200">
                Exibindo compras do produto <b>{productName(searchParams.get('product_id'))}</b>.
              </div>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
              <div className="hidden grid-cols-12 gap-2 border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400 lg:grid">
                {(
                  [
                    ['supplier', 'Fornecedor', 'col-span-3'],
                    ['document', 'Documento', 'col-span-3'],
                    ['issue_date', 'Emissão', 'col-span-2'],
                    ['status', 'Status', 'col-span-2'],
                    ['total', 'Total', 'col-span-1 justify-end'],
                  ] as const
                ).map(([key, label, classes]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSort(key)}
                    className={`${classes} inline-flex items-center gap-1 text-left hover:text-gray-900 dark:hover:text-white`}
                  >
                    {label}
                    {sortIcon(key)}
                  </button>
                ))}
                <div className="col-span-1 text-right">Ações</div>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {sortedDocuments.length === 0 ? (
                  <div className="px-4 py-8 text-sm text-gray-600 dark:text-gray-300">
                    {documents.length ? 'Nenhuma compra encontrada com os filtros atuais.' : 'Nenhum documento cadastrado ainda.'}
                  </div>
                ) : (
                  sortedDocuments.map((doc) => {
                    const canReceiveDoc =
                      canConfirmPurchase && (doc.status === 'draft' || doc.status === 'partially_received')
                    const canCancelDoc =
                      canCancelPurchase && (doc.status === 'partially_received' || doc.status === 'confirmed')
                    return (
                      <div
                        key={doc.id}
                        className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-12 lg:items-center lg:gap-2 lg:py-3"
                      >
                        <div className="lg:col-span-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {supplierName(doc.supplier_id)}
                          </div>
                        </div>
                        <div className="lg:col-span-3">
                          <div className="font-semibold text-gray-900 dark:text-white">
                            {doc.document_code || shortId(doc.id)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {doc.invoice_number ? `Nota ${doc.invoice_number}` : 'Sem nota informada'}
                          </div>
                          {documentOrigins[doc.id] ? (
                            <div className="mt-1 text-[11px] font-semibold text-[#14887B] dark:text-emerald-300">
                              {documentOrigins[doc.id].quotationCode}
                              {documentOrigins[doc.id].roundCode ? ` · ${documentOrigins[doc.id].roundCode}` : ''}
                            </div>
                          ) : null}
                          {renderReceiptSummary(doc)}
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300 lg:col-span-2">
                          <span className="mr-1 text-xs text-gray-500 lg:hidden">Emissão:</span>
                          {formatDatePtBr(doc.issue_date) || '—'}
                        </div>
                        <div className="lg:col-span-2">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeClass(doc.status)}`}>
                            {getPurchaseDocumentStatusLabel(doc.status)}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white lg:col-span-1 lg:text-right">
                          <span className="mr-1 text-xs text-gray-500 lg:hidden">Total:</span>
                          {money(doc.total_amount)}
                        </div>
                        <div className="flex flex-wrap gap-2 lg:col-span-1 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => openDocument(doc, true)}
                            title="Visualizar"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {doc.status === 'draft' && canCreatePurchase ? (
                            <button
                              type="button"
                              onClick={() => openDocument(doc, false)}
                              title="Editar"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canReceiveDoc ? (
                            <button
                              type="button"
                              onClick={() => setReceiveTargetId(doc.id)}
                              disabled={saving}
                              title={doc.status === 'partially_received' ? 'Receber nova parcela' : 'Receber compra'}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <PackageCheck className="h-4 w-4" />
                            </button>
                          ) : null}
                          {doc.status === 'draft' && canCancelPurchase ? (
                            <button
                              type="button"
                              onClick={() => void deleteDraft(doc.id)}
                              disabled={saving}
                              title="Excluir rascunho"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white hover:opacity-90 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                          {canCancelDoc ? (
                            <button
                              type="button"
                              onClick={() => openCancelModal(doc)}
                              disabled={saving}
                              title="Cancelar compra"
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white hover:opacity-90 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              <div className="font-medium text-gray-900 dark:text-white">Fluxo de compras</div>
              <ol className="mt-2 list-decimal space-y-1 pl-5">
                <li>Crie ou gere um rascunho a partir de cotação.</li>
                <li>Revise fornecedor, documento, itens, quantidades e custos.</li>
                <li>Receba uma ou mais parcelas por item e local de estoque.</li>
                <li>Registre faltas, avarias, item incorreto, excesso e observações; apenas o aceito entra no estoque.</li>
                <li>A compra permanece <b>Parcialmente recebida</b> enquanto houver saldo pendente e vira <b>Confirmada</b> somente quando todos os itens forem concluídos.</li>
                <li>Parcelas podem ser revertidas com motivo, sem apagar o histórico.</li>
              </ol>
            </div>
          </div>
        )}
      </PageContainer>

      {draftOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-[2px] sm:p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-300 bg-white p-4 shadow-2xl ring-1 ring-black/10 dark:border-slate-500 dark:bg-slate-900 dark:shadow-[0_24px_80px_rgba(0,0,0,0.75)] dark:ring-2 dark:ring-teal-400/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingReadOnly
                    ? editingStatus === 'partially_received'
                      ? 'Compra parcialmente recebida'
                      : editingStatus === 'confirmed'
                        ? 'Compra confirmada'
                        : editingStatus === 'cancelled'
                          ? 'Compra cancelada'
                          : 'Documento (somente leitura)'
                    : editingDocId
                      ? 'Editar documento'
                      : 'Nova entrada por documento'}
                </h2>
                {editingDocId ? (
                  <p className="mt-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {editingDocument?.document_code || shortId(editingDocId)}
                    {documentOrigins[editingDocId]?.quotationCode ? ` · ${documentOrigins[editingDocId].quotationCode}` : ''}
                    {documentOrigins[editingDocId]?.roundCode ? ` · ${documentOrigins[editingDocId].roundCode}` : ''}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={closeDraftModal}
                className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700 dark:text-gray-200">
                Fornecedor
                <select
                  value={draftSupplierId}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => setDraftSupplierId(event.target.value)}
                  disabled={editingReadOnly}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                >
                  <option value="">Selecione...</option>
                  {(editingReadOnly ? suppliers : eligibleSuppliers).map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-200">
                Data
                <input
                  type="date"
                  value={draftIssueDate}
                  onChange={(event) => setDraftIssueDate(event.target.value)}
                  disabled={editingReadOnly}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-200">
                Nº Nota / Documento
                <input
                  value={draftInvoiceNumber}
                  onChange={(event) => setDraftInvoiceNumber(event.target.value)}
                  disabled={editingReadOnly}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  placeholder="Ex.: 12345"
                />
              </label>
              <label className="text-sm text-gray-700 dark:text-gray-200">
                Observações
                <input
                  value={draftNotes}
                  onChange={(event) => setDraftNotes(event.target.value)}
                  disabled={editingReadOnly}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                  placeholder="Opcional"
                />
              </label>
            </div>

            {editingDocId ? (
              <OperationalTimeline
                compact
                className="mt-4"
                title="Andamento da compra"
                description="Criação, recebimentos, divergências, reversões e cancelamento auditável."
                emptyTitle="Nenhum andamento registrado"
                emptyDescription="Os eventos desta compra aparecerão aqui conforme o fluxo for executado."
                events={purchaseDocumentTimelineEvents}
                loading={loadingPurchaseDocumentTimeline}
                onRefresh={() => void refetchPurchaseDocumentTimeline()}
              />
            ) : null}

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium text-gray-900 dark:text-white">Itens</div>
                {!editingReadOnly ? (
                  <button
                    type="button"
                    onClick={addDraftItem}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                  >
                    <Plus className="h-4 w-4" />
                    Adicionar item
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                {draftItems.map((item, index) => (
                  <div key={item.id || index} className="grid grid-cols-1 gap-2 rounded-2xl border border-gray-200 p-3 dark:border-gray-800 md:grid-cols-12">
                    <label className="text-xs text-gray-600 dark:text-gray-300 md:col-span-6">
                      Produto
                      <select
                        value={item.product_id}
                        onChange={(event) => {
                          const productId = event.target.value
                          const product = productMap.get(productId)
                          updateDraftItem(index, {
                            product_id: productId,
                            unit_cost:
                              product?.last_entry_unit_cost != null
                                ? Number(product.last_entry_unit_cost)
                                : item.unit_cost,
                          })
                        }}
                        disabled={editingReadOnly}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      >
                        <option value="">Selecione...</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs text-gray-600 dark:text-gray-300 md:col-span-2">
                      Qtd
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantity || ''}
                        onChange={(event) => updateDraftItem(index, { quantity: Number(event.target.value || 0) })}
                        disabled={editingReadOnly}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      />
                    </label>
                    <label className="text-xs text-gray-600 dark:text-gray-300 md:col-span-3">
                      Custo unitário (R$)
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unit_cost ?? ''}
                        onChange={(event) => updateDraftItem(index, { unit_cost: event.target.value === '' ? null : Number(event.target.value) })}
                        disabled={editingReadOnly}
                        className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                      />
                    </label>
                    <div className="flex items-end justify-end md:col-span-1">
                      {!editingReadOnly ? (
                        <button
                          type="button"
                          onClick={() => removeDraftItem(index)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {editingDocId && editingReceipts.length ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                Esta compra possui <b>{editingReceipts.length}</b> parcela(s) registrada(s). Abra <b>Recebimentos</b> para ver itens, divergências, usuários, horários e reversões.
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                Total do documento: <span className="font-semibold">{money(currentDraftTotal)}</span>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {!editingReadOnly ? (
                  <button
                    type="button"
                    onClick={() => void createOrUpdateDraft()}
                    disabled={saving || !canSaveDraft}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {editingDocId ? 'Salvar alterações' : 'Salvar rascunho'}
                  </button>
                ) : null}
                {editingDocument && canConfirmPurchase && (editingDocument.status === 'draft' || editingDocument.status === 'partially_received') ? (
                  <button
                    type="button"
                    onClick={() => setReceiveTargetId(editingDocument.id)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <PackageCheck className="h-4 w-4" />
                    {editingDocument.status === 'partially_received' ? 'Receber nova parcela' : 'Receber compra'}
                  </button>
                ) : null}
                {editingDocument && editingReceipts.length ? (
                  <button
                    type="button"
                    onClick={() => setReceiveTargetId(editingDocument.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-100"
                  >
                    <History className="h-4 w-4" />
                    Ver recebimentos
                  </button>
                ) : null}
                {editingDocument && canCancelPurchase && (editingDocument.status === 'partially_received' || editingDocument.status === 'confirmed') ? (
                  <button
                    type="button"
                    onClick={() => openCancelModal(editingDocument)}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar compra
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {receiveTarget ? (
        <PurchaseReceiptModal
          key={`${receiveTarget.id}-${(receiptsByDocument.get(receiveTarget.id) ?? []).length}`}
          open
          documentId={receiveTarget.id}
          documentCode={receiveTarget.document_code || shortId(receiveTarget.id)}
          supplierName={supplierName(receiveTarget.supplier_id)}
          items={(itemsByDocument.get(receiveTarget.id) ?? []).map((item) => ({
            id: item.id,
            product_id: item.product_id,
            quantity: Number(item.quantity),
            unit_cost: item.unit_cost == null ? null : Number(item.unit_cost),
          }))}
          receipts={receiptsByDocument.get(receiveTarget.id) ?? []}
          receiptItems={receiptItemsByDocument.get(receiveTarget.id) ?? []}
          stockLocations={stockLocations}
          productName={productName}
          actorName={actorName}
          canReceive={canConfirmPurchase && (receiveTarget.status === 'draft' || receiveTarget.status === 'partially_received')}
          canReverse={canCancelPurchase && receiveTarget.status !== 'cancelled'}
          saving={saving}
          onClose={() => setReceiveTargetId(null)}
          onReceive={receivePurchase}
          onReverse={reverseReceipt}
        />
      ) : null}

      {cancelOpen && cancelTarget ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cancelar compra</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {cancelTarget.document_code || shortId(cancelTarget.id)}. Parcelas ativas serão revertidas uma a uma e permanecerão no histórico.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Fechar
              </button>
            </div>
            <label className="mt-4 block text-sm text-gray-700 dark:text-gray-200">
              Motivo do cancelamento
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                placeholder="Obrigatório"
              />
            </label>
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              A operação é transacional. Se qualquer parcela não puder ser revertida por falta de saldo físico, todo o cancelamento falhará sem alteração parcial.
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => void cancelPurchaseDocument()}
                disabled={saving || cancelReason.trim().length < 3}
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                <ShieldAlert className="h-4 w-4" />
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
