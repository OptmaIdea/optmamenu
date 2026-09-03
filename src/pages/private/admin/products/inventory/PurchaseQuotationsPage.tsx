import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  Save,
  Search,
  Scale,
  ShoppingCart,
  Trophy,
  X,
  XCircle,
} from 'lucide-react'
import {
  formatDateTimeForExportPtBr,
  formatDateTimePtBr,
  getLocalDateInputValue,
  toAppDate,
} from '@/utils/dateTime'
import OperationalTimeline from './components/OperationalTimeline'
import { useOperationalTimeline } from './hooks/useOperationalTimeline'
import { toast } from 'sonner'
import PageContainer from '@/components/common/PageContainer'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import EmptyState from '@/components/common/empty-state/EmptyState'
import { supabase } from '@/lib/supabase'
import { stockService } from '@/services/stockService'
import type { PurchaseQuotationDetail, PurchaseQuotationSummary } from '@/services/stockService'
import type { Supplier } from '@/pages/private/admin/products/suppliers/types/supplier.types'
import { useInventory } from '@/pages/private/admin/products/inventory/hooks/useInventory'
import { buildCsv, downloadCsv, formatCsvNumberBR } from '@/utils/csv'
import { isSupplierPurchaseEligible } from './utils/supplierStatusUtils'
import { getActiveStoreId } from '@/utils/activeStore'
import { usePermissions } from '@/hooks/usePermissions'
import { hasEffectivePermission } from '@/utils/permissions'

type SupplierContact = {
  phone?: string | null
  email?: string | null
  secondary_phone?: string | null
  commercial_phone?: string | null
  commercial_whatsapp?: string | null
  commercial_email?: string | null
  financial_phone?: string | null
  financial_email?: string | null
  fiscal_phone?: string | null
  fiscal_email?: string | null
  metadata?: Record<string, unknown> | null
}

type QuotationEditableStatus = 'draft' | 'sent' | 'answered' | 'approved' | 'rejected' | 'cancelled'

type QuotationChannel = 'whatsapp' | 'email' | 'pdf' | 'manual' | 'other' | ''

type InventoryProductLike = {
  id: string
  name: string
  active?: boolean | null
  discontinued?: boolean | null
  is_discontinued?: boolean | null
}

type QuotationItem = PurchaseQuotationDetail['items'][number]

type QuotationComparison = {
  quotations: PurchaseQuotationDetail[]
  products: Array<{
    productId: string
    productName: string
    offers: Array<{
      quotationId: string
      quotationCode: string
      supplierName: string
      status: string
      requestedQty: number
      approvedQty: number
      unitCost: number | null
      total: number | null
      unavailable: boolean
      supplierNotes: string | null
    }>
    bestQuotationId: string | null
  }>
}

const statusOptions = [
  { value: '', label: 'Todos os status' },
  { value: 'draft', label: 'Rascunho' },
  { value: 'sent', label: 'Enviada' },
  { value: 'answered', label: 'Respondida' },
  { value: 'approved', label: 'Aprovada' },
  { value: 'rejected', label: 'Rejeitada' },
  { value: 'converted', label: 'Convertida' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'expired', label: 'Expirada' },
]

function getStatusLabel(status?: string | null) {
  return statusOptions.find((option) => option.value === status)?.label ?? status ?? 'Não informado'
}

function getStatusClassName(status?: string | null) {
  switch (status) {
    case 'approved':
    case 'converted':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    case 'sent':
    case 'answered':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200'
  }
}

function formatDateTime(value?: string | null) {
  return formatDateTimePtBr(value, '—')
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value ?? 0))
}

function shortId(value?: string | null) {
  if (!value) return '—'
  return value.slice(0, 8)
}

function formatDateTimeCsv(value?: string | null) {
  return formatDateTimeForExportPtBr(value, '')
}

function normalizePhone(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return null
  return digits.startsWith('55') ? digits : `55${digits}`
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function asMetadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getSupplierPhone(contact: SupplierContact | null) {
  if (!contact) return null

  return (
    contact.commercial_whatsapp ||
    contact.commercial_phone ||
    contact.phone ||
    contact.secondary_phone ||
    contact.financial_phone ||
    contact.fiscal_phone ||
    asMetadataText(contact.metadata, 'commercial_whatsapp') ||
    asMetadataText(contact.metadata, 'commercial_phone') ||
    asMetadataText(contact.metadata, 'whatsapp') ||
    asMetadataText(contact.metadata, 'phone') ||
    null
  )
}

function getSupplierEmail(contact: SupplierContact | null) {
  if (!contact) return null

  return (
    contact.commercial_email ||
    contact.email ||
    contact.financial_email ||
    contact.fiscal_email ||
    asMetadataText(contact.metadata, 'commercial_email') ||
    asMetadataText(contact.metadata, 'email') ||
    asMetadataText(contact.metadata, 'financial_email') ||
    asMetadataText(contact.metadata, 'fiscal_email') ||
    null
  )
}

function getChannelLabel(channel?: string | null) {
  switch (channel) {
    case 'whatsapp':
      return 'WhatsApp'
    case 'email':
      return 'E-mail'
    case 'pdf':
      return 'PDF'
    case 'manual':
      return 'Manual'
    case 'other':
      return 'Outro'
    default:
      return 'Não informado'
  }
}

function isQuotationItemUnavailable(item: QuotationItem) {
  const notes = String(item.supplier_notes ?? '').toLowerCase()
  return Number(item.approved_qty ?? item.requested_qty ?? 0) <= 0 && notes.includes('indispon')
}

function removeUnavailableNote(value?: string | null) {
  return String(value ?? '')
    .replace(/^indispon[ií]vel\.?\s*-?\s*/i, '')
    .trim()
}

function buildQuotationComparison(quotations: PurchaseQuotationDetail[]): QuotationComparison {
  const products = new Map<string, QuotationComparison['products'][number]>()

  for (const quotation of quotations) {
    for (const item of quotation.items) {
      const unavailable = isQuotationItemUnavailable(item)
      const approvedQty = unavailable ? 0 : Number(item.approved_qty ?? item.requested_qty ?? 0)
      const unitCost =
        unavailable || item.quoted_unit_cost == null ? null : Number(item.quoted_unit_cost)
      const current = products.get(item.product_id) ?? {
        productId: item.product_id,
        productName: item.product_name,
        offers: [],
        bestQuotationId: null,
      }

      current.offers.push({
        quotationId: quotation.id,
        quotationCode: quotation.quotation_code,
        supplierName: quotation.supplier_name,
        status: quotation.status,
        requestedQty: Number(item.requested_qty ?? 0),
        approvedQty,
        unitCost,
        total: unitCost != null && approvedQty > 0 ? unitCost * approvedQty : null,
        unavailable,
        supplierNotes: item.supplier_notes,
      })
      products.set(item.product_id, current)
    }
  }

  for (const product of products.values()) {
    const validOffers = product.offers
      .filter((offer) => !offer.unavailable && offer.unitCost != null && offer.approvedQty > 0)
      .sort((a, b) => Number(a.unitCost) - Number(b.unitCost))
    product.bestQuotationId = validOffers[0]?.quotationId ?? null
    product.offers.sort((a, b) => {
      if (a.quotationId === product.bestQuotationId) return -1
      if (b.quotationId === product.bestQuotationId) return 1
      if (a.unitCost == null) return 1
      if (b.unitCost == null) return -1
      return a.unitCost - b.unitCost
    })
  }

  return {
    quotations,
    products: Array.from(products.values()).sort((a, b) =>
      a.productName.localeCompare(b.productName, 'pt-BR')
    ),
  }
}

function buildQuotationText(detail: PurchaseQuotationDetail) {
  if (detail.message_body?.trim()) {
    return detail.message_body
  }

  const today = getLocalDateInputValue().split('-').reverse().join('/')
  const lines = detail.items.map((item, index) => {
    if (isQuotationItemUnavailable(item)) {
      return `${index + 1}. ${item.product_name} — indisponível`
    }

    const qty = Number(item.approved_qty ?? item.requested_qty ?? 0)
    const cost = item.quoted_unit_cost ?? item.reference_unit_cost
    const costText = cost != null ? ` | referência/cotado: ${formatCurrency(cost)}` : ''

    return `${index + 1}. ${item.product_name} — ${qty} un.${costText}`
  })

  return [
    'Olá, tudo bem?',
    '',
    'Solicito cotação/retorno para os itens abaixo.',
    '',
    `Fornecedor: ${detail.supplier_name}`,
    `Cotação: ${detail.quotation_code}`,
    `Data: ${today}`,
    '',
    'Produtos:',
    ...lines,
    '',
    'Por gentileza, confirmar preço unitário, disponibilidade, prazo de entrega, condição de pagamento e validade da proposta.',
    '',
    'Obrigado.',
  ].join('\n')
}

function QuotationsAccessDenied() {
  return (
    <PageContainer
      title="Acesso Restrito"
      subtitle="Você não tem permissão para visualizar cotações de compra."
      category="Produtos"
      icon={<XCircle className="text-[#DC2626]" size={28} />}
      flat
    >
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 rounded-full bg-red-50 p-4 text-red-500 dark:bg-red-950/30">
          <XCircle size={48} />
        </div>
        <h3 className="mb-2 text-xl font-bold text-gray-800 dark:text-white">Acesso restrito</h3>
        <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
          Seu perfil não possui a permissão quotes.view para acessar esta tela.
        </p>
      </div>
    </PageContainer>
  )
}

function buildQuotationPrintHtml(
  detail: PurchaseQuotationDetail,
  contact: SupplierContact | null,
  totalQuoted: number
) {
  const rows = detail.items
    .map((item, index) => {
      const unavailable = isQuotationItemUnavailable(item)
      const approvedQty = unavailable ? 0 : Number(item.approved_qty ?? item.requested_qty ?? 0)
      const quotedCost = unavailable
        ? null
        : (item.quoted_unit_cost ?? item.reference_unit_cost ?? null)
      const total = approvedQty * Number(quotedCost ?? 0)

      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.product_name)}${unavailable ? ' — indisponível' : ''}</td>
          <td class="right">${item.requested_qty}</td>
          <td class="right">${approvedQty}</td>
          <td class="right">${formatCurrency(item.reference_unit_cost)}</td>
          <td class="right">${quotedCost == null ? '—' : formatCurrency(quotedCost)}</td>
          <td class="right">${formatCurrency(total)}</td>
          <td>${escapeHtml(item.supplier_notes || '')}</td>
        </tr>
      `
    })
    .join('')

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(detail.quotation_code)} - ${escapeHtml(detail.supplier_name)}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; font-size: 13px; }
          .header { border-bottom: 2px solid #0f766e; padding-bottom: 16px; margin-bottom: 24px; }
          h1 { margin: 0; font-size: 22px; }
          .subtitle { margin-top: 6px; color: #475569; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
          .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; }
          .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; vertical-align: top; }
          .right { text-align: right; }
          .notes { margin-top: 20px; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; color: #475569; }
          .footer { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
          .signature { border-top: 1px solid #94a3b8; padding-top: 8px; text-align: center; color: #475569; }
          @media print { body { margin: 20mm; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Retorno de cotação</h1>
          <div class="subtitle">${escapeHtml(detail.quotation_code)} · ${escapeHtml(detail.supplier_name)}</div>
        </div>
        <div class="grid">
          <div class="box"><div class="label">Fornecedor</div><strong>${escapeHtml(detail.supplier_name)}</strong></div>
          <div class="box"><div class="label">Status</div>${escapeHtml(getStatusLabel(detail.status))}</div>
          <div class="box"><div class="label">Responsável</div>${escapeHtml(detail.responsible_name || 'Responsável pela cotação')}</div>
          <div class="box"><div class="label">Canal</div>${escapeHtml(getChannelLabel(detail.sent_channel))}</div>
          <div class="box"><div class="label">WhatsApp / telefone</div>${escapeHtml(getSupplierPhone(contact) || 'Não informado')}</div>
          <div class="box"><div class="label">E-mail</div>${escapeHtml(getSupplierEmail(contact) || 'Não informado')}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Produto</th>
              <th class="right">Solicitado</th>
              <th class="right">Aprovado</th>
              <th class="right">Referência inicial</th>
              <th class="right">Cotado</th>
              <th class="right">Total</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="notes">
          <strong>Total cotado estimado:</strong> ${formatCurrency(totalQuoted)}<br /><br />
          ${escapeHtml(detail.notes || 'Sem observações internas.')}
        </div>
        <div class="footer">
          <div class="signature">Responsável pela cotação</div>
          <div class="signature">Fornecedor</div>
        </div>
      </body>
    </html>
  `
}

export default function PurchaseQuotationsPage() {
  const navigate = useNavigate()

  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setPortalContainer(document.getElementById('quick-access-actions-portal'))
  }, [])

  const { products: inventoryProducts } = useInventory()
  const [storeId, setStoreId] = useState<string | null>(null)
  const { permissions, loading: loadingPermissions } = usePermissions(storeId ?? null)
  const canViewQuotes = hasEffectivePermission(permissions, 'quotes.view')
  const canManageQuotes = hasEffectivePermission(permissions, 'quotes.manage')
  const canViewPurchases = hasEffectivePermission(permissions, 'purchases.view')
  const [loading, setLoading] = useState(true)
  const [quotations, setQuotations] = useState<PurchaseQuotationSummary[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [quotationProductIds, setQuotationProductIds] = useState<Record<string, string[]>>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<string[]>([])
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [comparison, setComparison] = useState<QuotationComparison | null>(null)
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    status: '',
    supplierId: '',
    productId: '',
    document: '',
  })
  const [detail, setDetail] = useState<PurchaseQuotationDetail | null>(null)
  const [detailDraft, setDetailDraft] = useState<PurchaseQuotationDetail | null>(null)
  const [supplierContact, setSupplierContact] = useState<SupplierContact | null>(null)
  const [detailMessage, setDetailMessage] = useState('')
  const [openingDetail, setOpeningDetail] = useState(false)
  const [savingResponse, setSavingResponse] = useState(false)
  const [, setConvertingToDraft] = useState(false)
  const [responseStatus, setResponseStatus] = useState<QuotationEditableStatus>('answered')
  const [sentChannel, setSentChannel] = useState<QuotationChannel>('')
  const [responsibleName, setResponsibleName] = useState('')
  const [quotationNotes, setQuotationNotes] = useState('')
  const [manualQuotationOpen, setManualQuotationOpen] = useState(false)
  const [savingManualQuotation, setSavingManualQuotation] = useState(false)
  const [manualSupplierId, setManualSupplierId] = useState('')
  const [manualResponsibleName, setManualResponsibleName] = useState('Responsável pela cotação')
  const [manualSentChannel, setManualSentChannel] = useState<QuotationChannel>('manual')
  const [manualNotes, setManualNotes] = useState('')
  const [manualItems, setManualItems] = useState<
    Array<{ productId: string; quantity: number; unitCost: number | null }>
  >([{ productId: '', quantity: 1, unitCost: null }])

  const {
    events: quotationTimelineEvents,
    loading: loadingQuotationTimeline,
    refetch: refetchQuotationTimeline,
  } = useOperationalTimeline({
    enabled: Boolean(detail?.id),
    storeId,
    entityType: 'purchase_quotation',
    relatedPurchaseQuotationId: detail?.id ?? null,
    limit: 30,
  })

  const products = useMemo(() => {
    return ((inventoryProducts ?? []) as InventoryProductLike[])
      .filter(
        (product) =>
          product.active !== false &&
          product.discontinued !== true &&
          product.is_discontinued !== true
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [inventoryProducts])

  const eligibleSuppliers = useMemo(() => suppliers.filter(isSupplierPurchaseEligible), [suppliers])

  async function loadQuotations(nextStoreId = storeId, options?: { silent?: boolean }) {
    if (!nextStoreId) return

    try {
      if (!options?.silent) setLoading(true)

      const data = await stockService.getPurchaseQuotationsByStore(nextStoreId, null)
      setQuotations(data)
    } catch (error) {
      console.error('Erro ao carregar cotações:', error)
      toast.error('Não foi possível carregar as cotações.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const run = async () => {
      const activeStoreId = getActiveStoreId()
      setStoreId(activeStoreId)

      if (activeStoreId) {
        await loadQuotations(activeStoreId)
      } else {
        setLoading(false)
      }
    }

    void run()
  }, [])

  useEffect(() => {
    if (!storeId) return
    void loadQuotations(storeId)
  }, [storeId])

  useEffect(() => {
    if (!storeId) return

    const run = async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('store_id', storeId)
        .order('name', { ascending: true })

      if (error) {
        console.error('Erro ao carregar fornecedores:', error)
        return
      }

      setSuppliers((data as Supplier[]) ?? [])
    }

    void run()
  }, [storeId])

  useEffect(() => {
    if (!filters.productId || quotations.length === 0) return

    const missing = quotations.filter((quotation) => !quotationProductIds[quotation.id])
    if (missing.length === 0) return

    const run = async () => {
      const entries = await Promise.all(
        missing.map(async (quotation) => {
          try {
            const detail = await stockService.getPurchaseQuotationDetail(quotation.id)
            return [quotation.id, detail.items.map((item) => item.product_id)] as const
          } catch (error) {
            console.error('Erro ao carregar itens da cotação:', error)
            return [quotation.id, []] as const
          }
        })
      )

      setQuotationProductIds((current) => ({ ...current, ...Object.fromEntries(entries) }))
    }

    void run()
  }, [filters.productId, quotationProductIds, quotations])

  const filteredQuotations = useMemo(() => {
    return quotations.filter((quotation) => {
      const requestedAt = toAppDate(quotation.requested_at)

      if (filters.dateFrom) {
        const from = new Date(`${filters.dateFrom}T00:00:00`)
        if (!requestedAt || requestedAt < from) return false
      }

      if (filters.dateTo) {
        const to = new Date(`${filters.dateTo}T23:59:59`)
        if (!requestedAt || requestedAt > to) return false
      }

      if (filters.status && quotation.status !== filters.status) return false
      if (filters.supplierId && quotation.supplier_id !== filters.supplierId) return false

      if (filters.productId) {
        const ids = quotationProductIds[quotation.id] ?? []
        if (!ids.includes(filters.productId)) return false
      }

      if (!filters.document.trim()) return true

      const term = filters.document.trim().toLowerCase()
      return [
        quotation.quotation_code,
        quotation.supplier_name,
        quotation.status,
        quotation.responsible_name,
        quotation.notes,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [filters, quotationProductIds, quotations])

  const totals = useMemo(() => {
    return {
      count: filteredQuotations.length,
      totalReference: filteredQuotations.reduce(
        (sum, row) => sum + Number(row.total_reference ?? 0),
        0
      ),
      totalQuoted: filteredQuotations.reduce((sum, row) => sum + Number(row.total_quoted ?? 0), 0),
      sent: filteredQuotations.filter((row) => row.status === 'sent').length,
    }
  }, [filteredQuotations])

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value.trim()).length,
    [filters]
  )

  const clearFilters = useCallback(() => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      status: '',
      supplierId: '',
      productId: '',
      document: '',
    })
  }, [])

  function toggleQuotationSelection(quotationId: string) {
    setSelectedQuotationIds((current) =>
      current.includes(quotationId)
        ? current.filter((id) => id !== quotationId)
        : [...current, quotationId]
    )
  }

  async function openComparison() {
    if (selectedQuotationIds.length < 2) {
      toast.warning('Selecione pelo menos duas cotações para comparar.')
      return
    }

    try {
      setLoadingComparison(true)
      const details = await Promise.all(
        selectedQuotationIds.map((quotationId) =>
          stockService.getPurchaseQuotationDetail(quotationId)
        )
      )
      setComparison(buildQuotationComparison(details))
    } catch (error) {
      console.error('Erro ao comparar cotações:', error)
      toast.error('Não foi possível montar a análise comparativa.')
    } finally {
      setLoadingComparison(false)
    }
  }

  const productName = useCallback(
    (id: string) => products.find((product) => product.id === id)?.name ?? id,
    [products]
  )

  const exportFilteredQuotationsCsv = useCallback(() => {
    if (!filteredQuotations.length) return

    const rows = filteredQuotations.map((quotation) => ({
      'Nº interno': shortId(quotation.id),
      Cotação: quotation.quotation_code,
      Status: getStatusLabel(quotation.status),
      Fornecedor: quotation.supplier_name || '—',
      Itens: quotation.items_count,
      'Total referência inicial (R$)': formatCsvNumberBR(quotation.total_reference ?? 0),
      'Total cotado respondido (R$)': formatCsvNumberBR(quotation.total_quoted ?? 0),
      'Criada em': quotation.requested_at_display ?? formatDateTimeCsv(quotation.requested_at),
      'Respondida em': quotation.responded_at_display ?? formatDateTimeCsv(quotation.responded_at),
      Canal: getChannelLabel(quotation.sent_channel),
      Responsável: quotation.responsible_name || '—',
      'Produto filtrado': filters.productId ? productName(filters.productId) : '',
      'Compra gerada': shortId(quotation.converted_purchase_document_id),
      Observações: quotation.notes ?? '',
    }))

    const csv = buildCsv(rows, [
      'Nº interno',
      'Cotação',
      'Status',
      'Fornecedor',
      'Itens',
      'Total referência inicial (R$)',
      'Total cotado respondido (R$)',
      'Criada em',
      'Respondida em',
      'Canal',
      'Responsável',
      'Produto filtrado',
      'Compra gerada',
      'Observações',
    ])

    const dateSuffix = getLocalDateInputValue()
    downloadCsv(`cotacoes_compra_${dateSuffix}.csv`, csv)
  }, [filteredQuotations, filters.productId, productName])

  async function openDetail(quotationId: string) {
    try {
      setOpeningDetail(true)
      const data = await stockService.getPurchaseQuotationDetail(quotationId)
      setDetail(data)
      setDetailDraft(data)
      setDetailMessage(data.message_body || buildQuotationText(data))
      setResponseStatus(
        ['draft', 'sent', 'answered', 'approved', 'rejected', 'cancelled'].includes(data.status)
          ? (data.status as QuotationEditableStatus)
          : 'answered'
      )
      setSentChannel((data.sent_channel as QuotationChannel) || '')
      setResponsibleName(data.responsible_name || 'Responsável pela cotação')
      setQuotationNotes(data.notes || '')

      const { data: supplierData, error } = await supabase
        .from('suppliers')
        .select(
          `
          phone,
          email,
          secondary_phone,
          commercial_phone,
          commercial_whatsapp,
          commercial_email,
          financial_phone,
          financial_email,
          fiscal_phone,
          fiscal_email,
          metadata
        `
        )
        .eq('id', data.supplier_id)
        .maybeSingle()

      if (error) throw error
      setSupplierContact((supplierData as SupplierContact | null) ?? null)
    } catch (error) {
      console.error('Erro ao abrir cotação:', error)
      toast.error('Não foi possível abrir a cotação.')
    } finally {
      setOpeningDetail(false)
    }
  }

  async function copyDetailMessage() {
    try {
      await navigator.clipboard.writeText(detailMessage)
      toast.success('Texto da cotação copiado.')
    } catch (error) {
      console.error('Erro ao copiar cotação:', error)
      toast.error('Não foi possível copiar o texto automaticamente.')
    }
  }

  function printDetail() {
    if (!detailDraft) return

    const printWindow = window.open('', '_blank', 'width=900,height=700')
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(
      buildQuotationPrintHtml(detailDraft, supplierContact, getDetailTotalQuoted())
    )
    printWindow.document.close()
    printWindow.onload = () => {
      printWindow.focus()
      printWindow.print()
    }
  }

  function updateDetailItem(itemId: string, patch: Partial<QuotationItem>) {
    setDetailDraft((current) => {
      if (!current) return current

      return {
        ...current,
        items: current.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      }
    })
  }

  function toggleUnavailableItem(item: QuotationItem, unavailable: boolean) {
    const previousNotes = item.supplier_notes ?? ''
    const cleanNotes = removeUnavailableNote(previousNotes)

    updateDetailItem(item.id, {
      approved_qty: unavailable ? 0 : Number(item.requested_qty ?? 0),
      quoted_unit_cost: unavailable ? null : item.quoted_unit_cost,
      supplier_notes: unavailable
        ? cleanNotes
          ? `Indisponível - ${cleanNotes}`
          : 'Indisponível'
        : cleanNotes,
    })
  }

  function getDetailTotalQuoted() {
    if (!detailDraft) return 0

    return detailDraft.items.reduce((total, item) => {
      if (isQuotationItemUnavailable(item)) return total
      const qty = Number(item.approved_qty ?? item.requested_qty ?? 0)
      const cost = Number(item.quoted_unit_cost ?? item.reference_unit_cost ?? 0)
      return total + qty * cost
    }, 0)
  }

  function closeDetail() {
    setDetail(null)
    setDetailDraft(null)
    setSupplierContact(null)
    setDetailMessage('')
  }

  async function saveQuotationResponse() {
    if (!detailDraft) return

    try {
      setSavingResponse(true)
      await stockService.updatePurchaseQuotationResponse({
        quotationId: detailDraft.id,
        status: responseStatus,
        sentChannel: sentChannel || null,
        responsibleName,
        notes: quotationNotes,
        items: detailDraft.items.map((item) => {
          const unavailable = isQuotationItemUnavailable(item)
          return {
            id: item.id,
            quoted_unit_cost:
              unavailable || item.quoted_unit_cost == null ? null : Number(item.quoted_unit_cost),
            approved_qty: unavailable
              ? 0
              : item.approved_qty == null
                ? Number(item.requested_qty)
                : Number(item.approved_qty),
            supplier_notes: item.supplier_notes ?? null,
          }
        }),
      })

      toast.success('Resposta da cotação salva.')
      const refreshed = await stockService.getPurchaseQuotationDetail(detailDraft.id)
      setDetail(refreshed)
      setDetailDraft(refreshed)
      setDetailMessage(refreshed.message_body || buildQuotationText(refreshed))
      await refetchQuotationTimeline()
      await loadQuotations(storeId, { silent: true })

      const wasApprovedNow = detail?.status !== 'approved' && refreshed.status === 'approved'

      if (wasApprovedNow) {
        const shouldConvert = window.confirm(
          'Cotação aprovada com sucesso.\n\nDeseja converter esta cotação em rascunho de compra agora?'
        )

        if (shouldConvert) {
          await convertQuotationToPurchase(detailDraft.id)
          return
        }

        closeDetail()
      }
    } catch (error) {
      console.error('Erro ao salvar resposta da cotação:', error)
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível salvar a resposta da cotação.'
      )
    } finally {
      setSavingResponse(false)
    }
  }

  async function convertQuotationToPurchase(quotationId: string) {
    try {
      setConvertingToDraft(true)
      const result = await stockService.convertPurchaseQuotationToDraft({
        quotationId,
        notes: 'Rascunho criado a partir de cotação.',
      })

      toast.success('Rascunho de compra criado a partir da cotação.')

      if (detail && detail.id === quotationId) {
        closeDetail()
      }

      await loadQuotations(storeId, { silent: true })
      navigate(`/admin/stock/purchase-documents?open=${result.purchase_document_id}`)
    } catch (error) {
      console.error('Erro ao converter cotação em rascunho:', error)
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível converter a cotação em rascunho.'
      )
    } finally {
      setConvertingToDraft(false)
    }
  }

  function closeManualQuotationModal() {
    setManualQuotationOpen(false)
    setManualSupplierId('')
    setManualResponsibleName('Responsável pela cotação')
    setManualSentChannel('manual')
    setManualNotes('')
    setManualItems([{ productId: '', quantity: 1, unitCost: null }])
  }

  function updateManualItem(
    index: number,
    patch: Partial<{ productId: string; quantity: number; unitCost: number | null }>
  ) {
    setManualItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    )
  }

  function removeManualItem(index: number) {
    setManualItems((current) =>
      current.length <= 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)
    )
  }

  function getManualQuotationText() {
    const supplier = eligibleSuppliers.find((item) => item.id === manualSupplierId)
    const selectedItems = manualItems
      .filter((item) => item.productId && Number(item.quantity) > 0)
      .map((item, index) => {
        const product = products.find((productItem) => productItem.id === item.productId)
        const costText =
          item.unitCost != null && Number(item.unitCost) > 0
            ? ` | referência: ${formatCurrency(Number(item.unitCost))}`
            : ''

        return `${index + 1}. ${product?.name ?? item.productId} — ${Number(item.quantity)} un.${costText}`
      })

    return [
      'Olá, tudo bem?',
      '',
      'Solicito cotação para os itens abaixo.',
      '',
      `Fornecedor: ${supplier?.name ?? 'Fornecedor selecionado'}`,
      `Data: ${getLocalDateInputValue().split('-').reverse().join('/')}`,
      '',
      'Produtos:',
      ...selectedItems,
      '',
      'Por gentileza, informar preço unitário, disponibilidade, prazo de entrega, condição de pagamento e validade da proposta.',
      '',
      'Obrigado.',
    ].join('\n')
  }

  const canSaveManualQuotation =
    Boolean(manualSupplierId) &&
    manualItems.some((item) => item.productId && Number(item.quantity) > 0)

  async function saveManualQuotation() {
    if (!canSaveManualQuotation) {
      toast.error('Selecione um fornecedor e ao menos um produto com quantidade.')
      return
    }

    try {
      setSavingManualQuotation(true)

      const supplier = eligibleSuppliers.find((item) => item.id === manualSupplierId)
      const result = await stockService.createPurchaseQuotation({
        supplierId: manualSupplierId,
        items: manualItems
          .filter((item) => item.productId && Number(item.quantity) > 0)
          .map((item) => ({
            product_id: item.productId,
            quantity: Number(item.quantity),
            unit_cost: item.unitCost == null ? null : Number(item.unitCost),
          })),
        messageSubject: `Solicitação de cotação - ${supplier?.name ?? 'Fornecedor'}`,
        messageBody: getManualQuotationText(),
        sentChannel: manualSentChannel || null,
        responsibleName: manualResponsibleName || 'Responsável pela cotação',
        notes: manualNotes || 'Cotação criada manualmente pela central de cotações.',
      })

      toast.success(`Cotação ${result.quotation_code} criada.`)
      closeManualQuotationModal()
      await loadQuotations(storeId, { silent: true })
      await openDetail(result.quotation_id)
    } catch (error) {
      console.error('Erro ao criar cotação manual:', error)
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a cotação.')
    } finally {
      setSavingManualQuotation(false)
    }
  }

  const email = getSupplierEmail(supplierContact)
  const whatsapp = normalizePhone(getSupplierPhone(supplierContact))

  if (loading || loadingPermissions) return <LoadingSpinner />

  if (!canViewQuotes) {
    return <QuotationsAccessDenied />
  }

  return (
    <>
      {portalContainer &&
        canManageQuotes &&
        createPortal(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setManualQuotationOpen(true)}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[#19A999] px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#14887B]"
            >
              <Plus size={13} />
              <span>Nova Cotação</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/stock/quotations/batch')}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <ShoppingCart size={13} />
              <span>Cotação em lote</span>
            </button>
          </div>,
          portalContainer
        )}

      <PageContainer
        title="Cotações"
        subtitle="Acesso rápido às cotações salvas para fornecedores."
        category="Produtos"
        icon={<FileText size={28} className="text-[#19A999]" />}
        onRefresh={() => loadQuotations(storeId, { silent: true })}
        flat
      >
        <div className="mb-4 grid grid-cols-2 gap-2 md:mb-6 md:grid-cols-4 md:gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 md:text-sm dark:text-gray-300">Cotações</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 md:mt-1 md:text-2xl dark:text-white">
              {totals.count}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 md:text-sm dark:text-gray-300">Ref. solicitada</p>
            <p className="mt-0.5 text-base font-bold text-gray-900 md:mt-1 md:text-2xl dark:text-white">
              {formatCurrency(totals.totalReference)}
            </p>
            <p className="mt-1 hidden text-[11px] font-semibold text-gray-400 md:block dark:text-gray-500">
              Valor inicial enviado ao fornecedor.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 md:text-sm dark:text-gray-300">Total cotado</p>
            <p className="mt-0.5 text-base font-bold text-gray-900 md:mt-1 md:text-2xl dark:text-white">
              {formatCurrency(totals.totalQuoted)}
            </p>
            <p className="mt-1 hidden text-[11px] font-semibold text-gray-400 md:block dark:text-gray-500">
              Atualiza com a resposta.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-3 md:p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 md:text-sm dark:text-gray-300">Enviadas</p>
            <p className="mt-0.5 text-lg font-bold text-gray-900 md:mt-1 md:text-2xl dark:text-white">
              {totals.sent}
            </p>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-300">
            A referência é o valor inicial solicitado. O valor respondido aparece em Total cotado.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void openComparison()}
              disabled={selectedQuotationIds.length < 2 || loadingComparison}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FAA832] px-4 py-2 text-sm font-bold text-slate-900 hover:bg-[#F59E0B] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Scale className="h-4 w-4" />
              {loadingComparison ? 'Analisando...' : `Comparar (${selectedQuotationIds.length})`}
            </button>
            {canManageQuotes && (
              <>
                <button
                  type="button"
                  onClick={() => navigate('/admin/stock/quotations/batch')}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-semibold text-white hover:bg-[#14887B]"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Cotação em lote
                </button>
                <button
                  type="button"
                  onClick={() => setManualQuotationOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#6D28D9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  <Plus className="h-4 w-4" />
                  Nova cotação
                </button>
              </>
            )}

            <button
              type="button"
              onClick={exportFilteredQuotationsCsv}
              disabled={!filteredQuotations.length}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <Download className="h-4 w-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm md:mb-6 md:p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white">Filtros</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Combine data, status, fornecedor, produto e cotação.
              </div>
            </div>
            <div className="flex gap-2">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 md:hidden dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <XCircle className="h-4 w-4" /> Limpar
                </button>
              )}
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-2.5 py-2 text-xs font-bold text-gray-700 md:hidden dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                aria-expanded={filtersOpen}
              >
                {filtersOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {filtersOpen
                  ? 'Recolher'
                  : `Abrir${activeFilterCount ? ` (${activeFilterCount})` : ''}`}
              </button>
              <button
                type="button"
                onClick={clearFilters}
                className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 md:inline-flex dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
              >
                <XCircle className="h-4 w-4" /> Limpar filtros
              </button>
            </div>
          </div>

          <div className={`${filtersOpen ? 'grid' : 'hidden'} gap-3 md:grid md:grid-cols-6`}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">
                Data inicial
              </span>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateFrom: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">
                Data final
              </span>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateTo: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">
                Status
              </span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, status: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.value ? option.label : 'Todos'}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">
                Fornecedor
              </span>
              <select
                value={filters.supplierId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, supplierId: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">
                Produto
              </span>
              <select
                value={filters.productId}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, productId: event.target.value }))
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              >
                <option value="">Todos</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-gray-700 dark:text-gray-200">
                Documento / Cotação
              </span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={filters.document}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, document: event.target.value }))
                  }
                  placeholder="Ex: COT-123"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
                />
              </div>
            </label>
          </div>
        </div>

        {filteredQuotations.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Nenhuma cotação encontrada"
            description="As cotações salvas pelas sugestões de compra aparecerão aqui para consulta e reenvio."
          />
        ) : (
          <div className="rounded-lg bg-white dark:bg-gray-800">
            <div className="space-y-2 bg-[#F8F6F2] md:hidden dark:bg-gray-950">
              {filteredQuotations.map((quotation) => {
                const selected = selectedQuotationIds.includes(quotation.id)
                return (
                  <article
                    key={quotation.id}
                    className={`rounded-xl border bg-white p-3 dark:bg-gray-800 ${selected ? 'border-[#19A999] ring-1 ring-[#19A999]' : 'border-gray-200 dark:border-gray-700'}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleQuotationSelection(quotation.id)}
                        className="mt-1 h-4 w-4 accent-[#19A999]"
                        aria-label={`Selecionar ${quotation.quotation_code} para comparação`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-900 dark:text-white">
                              {quotation.quotation_code}
                            </p>
                            <p className="truncate text-xs font-semibold text-gray-600 dark:text-gray-300">
                              {quotation.supplier_name}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusClassName(quotation.status)}`}
                          >
                            {getStatusLabel(quotation.status)}
                          </span>
                        </div>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <span className="block text-[10px] uppercase text-gray-400">Itens</span>
                            <strong>{quotation.items_count}</strong>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-gray-400">
                              Referência
                            </span>
                            <strong>{formatCurrency(quotation.total_reference)}</strong>
                          </div>
                          <div>
                            <span className="block text-[10px] uppercase text-gray-400">
                              Cotado
                            </span>
                            <strong className="text-emerald-700 dark:text-emerald-300">
                              {formatCurrency(quotation.total_quoted)}
                            </strong>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-700">
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {quotation.requested_at_display ??
                              formatDateTime(quotation.requested_at)}
                          </span>
                          <button
                            type="button"
                            disabled={openingDetail}
                            onClick={() => void openDetail(quotation.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-600 dark:text-gray-200"
                          >
                            <Eye className="h-3.5 w-3.5" /> Abrir
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-2xl border border-gray-100 md:block dark:border-gray-700">
              <table className="min-w-[1080px] w-full text-left">
                <thead className="bg-gray-50 text-sm font-medium text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                  <tr>
                    <th className="w-12 px-4 py-4">
                      <span className="sr-only">Comparar</span>
                    </th>
                    <th className="px-4 py-4">Cotação</th>
                    <th className="px-4 py-4">Fornecedor</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Itens</th>
                    <th className="px-4 py-4 text-right">Ref. solicitada</th>
                    <th className="px-4 py-4 text-right">Total cotado</th>
                    <th className="px-4 py-4">Criada em</th>
                    <th className="px-4 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredQuotations.map((quotation) => (
                    <tr key={quotation.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedQuotationIds.includes(quotation.id)}
                          onChange={() => toggleQuotationSelection(quotation.id)}
                          className="h-4 w-4 accent-[#19A999]"
                          aria-label={`Selecionar ${quotation.quotation_code} para comparação`}
                        />
                      </td>
                      <td className="px-4 py-4 font-semibold text-gray-900 dark:text-white">
                        {quotation.quotation_code}
                      </td>
                      <td className="px-4 py-4 text-gray-700 dark:text-gray-200">
                        {quotation.supplier_name}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusClassName(quotation.status)}`}
                        >
                          {getStatusLabel(quotation.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right text-gray-700 dark:text-gray-200">
                        {quotation.items_count}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(quotation.total_reference)}
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(quotation.total_quoted)}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {quotation.requested_at_display ?? formatDateTime(quotation.requested_at)}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            disabled={openingDetail}
                            onClick={() => void openDetail(quotation.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                            title="Abrir cotação"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {canManageQuotes && quotation.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() => void convertQuotationToPurchase(quotation.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950"
                              title="Converter em rascunho de compra"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}

                          {canViewPurchases &&
                            quotation.status === 'converted' &&
                            quotation.converted_purchase_document_id && (
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/admin/stock/purchase-documents?open=${quotation.converted_purchase_document_id}`
                                  )
                                }
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-950"
                                title="Abrir compra"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {comparison && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-2 md:p-4">
            <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-950">
              <div className="flex items-start justify-between border-b border-gray-100 p-4 md:p-5 dark:border-gray-800">
                <div>
                  <div className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-[#19A999]" />
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Análise comparativa das propostas
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 md:text-sm dark:text-gray-400">
                    {comparison.quotations.length} fornecedores · {comparison.products.length}{' '}
                    produtos. O destaque indica o menor preço unitário válido por item.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setComparison(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-gray-800"
                  aria-label="Fechar análise comparativa"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-3 md:p-5">
                <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {comparison.quotations.map((quotation) => {
                    const validItems = quotation.items.filter(
                      (item) =>
                        !isQuotationItemUnavailable(item) &&
                        item.quoted_unit_cost != null &&
                        Number(item.approved_qty ?? item.requested_qty ?? 0) > 0
                    )
                    const total = validItems.reduce(
                      (sum, item) =>
                        sum +
                        Number(item.quoted_unit_cost) *
                          Number(item.approved_qty ?? item.requested_qty ?? 0),
                      0
                    )
                    const unavailableCount = quotation.items.filter(
                      isQuotationItemUnavailable
                    ).length
                    return (
                      <div
                        key={quotation.id}
                        className="rounded-xl border border-gray-200 bg-slate-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <strong className="truncate text-sm text-slate-900 dark:text-white">
                            {quotation.supplier_name}
                          </strong>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${getStatusClassName(quotation.status)}`}
                          >
                            {getStatusLabel(quotation.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{quotation.quotation_code}</p>
                        <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                          {formatCurrency(total)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {validItems.length} item(ns) com preço
                          {unavailableCount ? ` · ${unavailableCount} indisponível(is)` : ''}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="space-y-3">
                  {comparison.products.map((product) => (
                    <section
                      key={product.productId}
                      className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <div className="bg-slate-50 px-3 py-2.5 dark:bg-gray-900">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {product.productName}
                        </h4>
                      </div>
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {product.offers.map((offer) => {
                          const best = offer.quotationId === product.bestQuotationId
                          return (
                            <div
                              key={`${product.productId}-${offer.quotationId}`}
                              className={`grid gap-2 p-3 text-xs md:grid-cols-[minmax(160px,1fr)_100px_100px_110px_minmax(120px,1fr)] md:items-center ${best ? 'bg-emerald-50 dark:bg-emerald-950/20' : 'bg-white dark:bg-gray-950'}`}
                            >
                              <div>
                                <div className="flex items-center gap-1.5">
                                  {best && <Trophy className="h-4 w-4 text-[#FAA832]" />}
                                  <strong className="text-slate-900 dark:text-white">
                                    {offer.supplierName}
                                  </strong>
                                </div>
                                <span className="text-[10px] text-gray-500">
                                  {offer.quotationCode}
                                </span>
                              </div>
                              <div>
                                <span className="mr-1 text-gray-400 md:hidden">Qtd.:</span>
                                {offer.approvedQty || '—'} / {offer.requestedQty}
                              </div>
                              <div className="font-bold">
                                <span className="mr-1 text-gray-400 md:hidden">Unitário:</span>
                                {offer.unavailable
                                  ? 'Indisponível'
                                  : offer.unitCost == null
                                    ? 'Sem preço'
                                    : formatCurrency(offer.unitCost)}
                              </div>
                              <div className="font-black text-slate-900 dark:text-white">
                                <span className="mr-1 text-gray-400 md:hidden">Total:</span>
                                {offer.total == null ? '—' : formatCurrency(offer.total)}
                              </div>
                              <div className="text-gray-500 dark:text-gray-400">
                                {best
                                  ? 'Melhor preço válido'
                                  : offer.supplierNotes || getStatusLabel(offer.status)}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  Esta análise indica o menor preço por produto. Prazo, frete, condição de
                  pagamento, quantidade atendida e qualidade do fornecedor continuam como critérios
                  de decisão antes da aprovação.
                </div>
              </div>
            </div>
          </div>
        )}

        {manualQuotationOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-950">
              <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Nova cotação
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    Crie uma cotação manual sem depender das sugestões de compra.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeManualQuotationModal}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto p-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <label className="md:col-span-2">
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Fornecedor aprovado
                    </span>
                    <select
                      value={manualSupplierId}
                      onChange={(event) => setManualSupplierId(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="">Selecione</option>
                      {eligibleSuppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Canal
                    </span>
                    <select
                      value={manualSentChannel}
                      onChange={(event) =>
                        setManualSentChannel(event.target.value as QuotationChannel)
                      }
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="manual">Manual</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail</option>
                      <option value="pdf">PDF</option>
                      <option value="other">Outro</option>
                    </select>
                  </label>

                  <label>
                    <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Responsável
                    </span>
                    <input
                      value={manualResponsibleName}
                      onChange={(event) => setManualResponsibleName(event.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      placeholder="Responsável pela cotação"
                    />
                  </label>
                </div>

                <div className="mt-5 rounded-2xl border border-gray-100 dark:border-gray-800">
                  <div className="grid grid-cols-12 gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-900/60">
                    <div className="col-span-5">Produto</div>
                    <div className="col-span-2 text-right">Quantidade</div>
                    <div className="col-span-3 text-right">Custo referência</div>
                    <div className="col-span-2 text-right">Ações</div>
                  </div>

                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {manualItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                        <div className="col-span-5">
                          <select
                            value={item.productId}
                            onChange={(event) =>
                              updateManualItem(index, { productId: event.target.value })
                            }
                            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          >
                            <option value="">Selecione</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateManualItem(index, { quantity: Number(event.target.value) })
                            }
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-right text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                        </div>

                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitCost ?? ''}
                            onChange={(event) =>
                              updateManualItem(index, {
                                unitCost:
                                  event.target.value === '' ? null : Number(event.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-right text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            placeholder="0,00"
                          />
                        </div>

                        <div className="col-span-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeManualItem(index)}
                            disabled={manualItems.length <= 1}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setManualItems((current) => [
                      ...current,
                      { productId: '', quantity: 1, unitCost: null },
                    ])
                  }
                  className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </button>

                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                    Observações internas
                  </span>
                  <textarea
                    value={manualNotes}
                    onChange={(event) => setManualNotes(event.target.value)}
                    className="min-h-[90px] w-full rounded-2xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    placeholder="Ex.: cotação criada por pedido do gerente, reposição especial..."
                  />
                </label>
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeManualQuotationModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveManualQuotation()}
                  disabled={!canSaveManualQuotation || savingManualQuotation}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingManualQuotation ? 'Salvando...' : 'Salvar cotação'}
                </button>
              </div>
            </div>
          </div>
        )}

        {detail && detailDraft && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-950">
              <div className="flex items-start justify-between border-b border-gray-100 p-5 dark:border-gray-800">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    {detail.quotation_code}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-gray-400">
                    {detail.supplier_name} · {getStatusLabel(detail.status)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-gray-400">
                    Total cotado estimado: {formatCurrency(getDetailTotalQuoted())}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[75vh] overflow-y-auto p-5">
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Criada em
                    </div>
                    <div className="mt-1 font-semibold dark:text-white">
                      {detail.requested_at_display ?? formatDateTime(detail.requested_at)}
                    </div>
                  </div>

                  <label className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Status
                    </div>
                    <select
                      value={responseStatus}
                      onChange={(event) =>
                        setResponseStatus(event.target.value as QuotationEditableStatus)
                      }
                      disabled={!canManageQuotes || detail.status === 'converted'}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="draft">Rascunho</option>
                      <option value="sent">Enviada</option>
                      <option value="answered">Respondida</option>
                      <option value="approved">Aprovada</option>
                      <option value="rejected">Rejeitada</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </label>

                  <label className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Canal
                    </div>
                    <select
                      value={sentChannel}
                      onChange={(event) => setSentChannel(event.target.value as QuotationChannel)}
                      disabled={!canManageQuotes || detail.status === 'converted'}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    >
                      <option value="">Não informado</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">E-mail</option>
                      <option value="pdf">PDF</option>
                      <option value="manual">Manual</option>
                      <option value="other">Outro</option>
                    </select>
                  </label>

                  <label className="rounded-xl border bg-slate-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                    <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Responsável
                    </div>
                    <input
                      value={responsibleName}
                      onChange={(event) => setResponsibleName(event.target.value)}
                      disabled={!canManageQuotes || detail.status === 'converted'}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      placeholder="Responsável pela cotação"
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-2xl border bg-slate-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                        Contatos do fornecedor
                      </div>
                      <div className="mt-1 text-sm text-slate-700 dark:text-gray-300">
                        WhatsApp/telefone: {getSupplierPhone(supplierContact) || 'não informado'} ·
                        E-mail: {getSupplierEmail(supplierContact) || 'não informado'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyDetailMessage()}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Copy className="h-4 w-4" />
                        Copiar
                      </button>

                      <button
                        type="button"
                        onClick={printDetail}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir/PDF
                      </button>

                      {email ? (
                        <a
                          href={`mailto:${email}?subject=${encodeURIComponent(
                            detail.message_subject || `Cotação ${detail.quotation_code}`
                          )}&body=${encodeURIComponent(detailMessage)}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <Mail className="h-4 w-4" />
                          E-mail
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Fornecedor sem e-mail cadastrado"
                          className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-slate-400 opacity-70 dark:border-gray-700 dark:bg-gray-950"
                        >
                          <Mail className="h-4 w-4" />
                          E-mail indisponível
                        </button>
                      )}

                      {whatsapp ? (
                        <a
                          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(detailMessage)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Fornecedor sem WhatsApp/telefone cadastrado"
                          className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 opacity-70 dark:bg-gray-800 dark:text-gray-400"
                        >
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp indisponível
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <OperationalTimeline
                  compact
                  className="mt-4"
                  title="Andamento da cotação"
                  description="Histórico operacional desta cotação, incluindo criação, envio, resposta, aprovação e conversão."
                  emptyTitle="Nenhum andamento registrado"
                  emptyDescription="Os eventos desta cotação aparecerão aqui conforme o fluxo for executado."
                  events={quotationTimelineEvents}
                  loading={loadingQuotationTimeline}
                  onRefresh={() => void refetchQuotationTimeline()}
                />

                <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-gray-900 dark:text-gray-400">
                        <tr>
                          <th className="px-4 py-3">Produto</th>
                          <th className="px-4 py-3">Disponibilidade</th>
                          <th className="px-4 py-3 text-right">Solicitado</th>
                          <th className="px-4 py-3 text-right">Referência inicial</th>
                          <th className="px-4 py-3 text-right">Preço cotado</th>
                          <th className="px-4 py-3 text-right">Qtd. aprovada</th>
                          <th className="px-4 py-3">Obs. fornecedor</th>
                          <th className="px-4 py-3 text-right">Total</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {detailDraft.items.map((item) => {
                          const unavailable = isQuotationItemUnavailable(item)
                          const approvedQty = unavailable
                            ? 0
                            : Number(item.approved_qty ?? item.requested_qty ?? 0)
                          const quotedCost = unavailable
                            ? 0
                            : Number(item.quoted_unit_cost ?? item.reference_unit_cost ?? 0)
                          const total = approvedQty * quotedCost

                          return (
                            <tr key={item.id} className="dark:text-gray-300">
                              <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                                <div className="flex flex-col gap-1">
                                  <span>{item.product_name}</span>
                                  {unavailable && (
                                    <span className="w-fit rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                                      Indisponível
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200">
                                  <input
                                    type="checkbox"
                                    checked={unavailable}
                                    onChange={(event) =>
                                      toggleUnavailableItem(item, event.target.checked)
                                    }
                                    disabled={!canManageQuotes || detail.status === 'converted'}
                                    className="accent-rose-600"
                                  />
                                  Indisponível
                                </label>
                              </td>
                              <td className="px-4 py-3 text-right">{item.requested_qty}</td>
                              <td className="px-4 py-3 text-right">
                                {formatCurrency(item.reference_unit_cost)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={unavailable ? '' : (item.quoted_unit_cost ?? '')}
                                  onChange={(event) =>
                                    updateDetailItem(item.id, {
                                      quoted_unit_cost:
                                        event.target.value === ''
                                          ? null
                                          : Number(event.target.value),
                                    })
                                  }
                                  disabled={
                                    !canManageQuotes || detail.status === 'converted' || unavailable
                                  }
                                  className="w-28 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950"
                                  placeholder={unavailable ? '—' : '0,00'}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={approvedQty}
                                  onChange={(event) =>
                                    updateDetailItem(item.id, {
                                      approved_qty:
                                        event.target.value === '' ? 0 : Number(event.target.value),
                                    })
                                  }
                                  disabled={
                                    !canManageQuotes || detail.status === 'converted' || unavailable
                                  }
                                  className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input
                                  value={item.supplier_notes ?? ''}
                                  onChange={(event) =>
                                    updateDetailItem(item.id, {
                                      supplier_notes: event.target.value,
                                    })
                                  }
                                  disabled={!canManageQuotes || detail.status === 'converted'}
                                  className="w-full rounded-lg border border-gray-200 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
                                  placeholder="Ex.: sem estoque, entrega parcial..."
                                />
                              </td>
                              <td className="px-4 py-3 text-right font-semibold">
                                {formatCurrency(total)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <label className="mt-4 block">
                  <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                    Observações internas
                  </div>
                  <textarea
                    value={quotationNotes}
                    onChange={(event) => setQuotationNotes(event.target.value)}
                    disabled={!canManageQuotes || detail.status === 'converted'}
                    className="min-h-[90px] w-full rounded-2xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    placeholder="Ex.: fornecedor confirmou entrega para sexta-feira..."
                  />
                </label>

                {detail.message_body && (
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-gray-400">
                      Mensagem salva
                    </div>
                    <textarea
                      readOnly
                      value={detail.message_body}
                      className="min-h-[180px] w-full rounded-2xl border border-gray-200 bg-slate-50 p-4 text-sm text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 p-5 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeDetail}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
                >
                  Fechar
                </button>

                {canManageQuotes && detail.status !== 'converted' && (
                  <button
                    type="button"
                    onClick={() => void saveQuotationResponse()}
                    disabled={savingResponse}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Save className="h-4 w-4" />
                    {savingResponse ? 'Salvando...' : 'Salvar resposta'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </PageContainer>
    </>
  )
}
