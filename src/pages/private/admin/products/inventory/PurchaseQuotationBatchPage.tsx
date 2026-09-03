import { type FocusEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  PackagePlus,
  PackageSearch,
  Plus,
  RefreshCw,
  Send,
  ShoppingCart,
  Trash2,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import PageContainer from '@/components/common/PageContainer'
import LoadingSpinner from '@/components/common/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { getActiveStoreId } from '@/utils/activeStore'
import { usePermissions } from '@/hooks/usePermissions'
import { hasEffectivePermission } from '@/utils/permissions'

const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 })
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

type PurchaseSuggestion = {
  product_id: string
  product_name: string
  category_id: string | null
  min_stock: number
  max_stock: number
  physical_on_hand: number
  reserved: number
  available: number
  projected_available: number
  shortage_qty: number
  suggested_purchase_qty: number
  suggested_supplier_id: string | null
  suggested_supplier_name: string | null
  suggested_unit_cost: number
  estimated_total_cost: number
  recommendation_reason: string
  location_id?: string | null
  location_name?: string | null
}

type SupplierOption = {
  id: string
  name: string
  trade_name: string | null
  phone: string | null
  email: string | null
  commercial_whatsapp: string | null
  commercial_email: string | null
  active: boolean
  blocked: boolean
  homologation_status: string | null
  preferred_supplier: boolean
}

type ProductOption = {
  id: string
  name: string
  category_id: string | null
  price: number | null
  min_stock: number | null
  max_stock: number | null
  product_codes?: Array<{
    code_type: string | null
    code_value: string | null
    active: boolean | null
    is_primary: boolean | null
  }> | null
}

type SelectedItem = {
  productId: string
  productName: string
  locationName: string | null
  quantity: number
  referenceUnitCost: number | null
  reason: string
  included: boolean
  manual: boolean
}

type CreatedQuotation = {
  quotation_id: string
  quotation_code: string
  supplier_name: string
  items_count: number
}

function parseNumber(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function toSafePositive(value: number, fallback = 1) {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.max(1, Math.ceil(value))
}

function selectOnFocus(event: FocusEvent<HTMLInputElement>) {
  event.currentTarget.select()
}

function supplierDisplayName(supplier: SupplierOption) {
  return supplier.trade_name?.trim() || supplier.name
}

function productDisplayCode(product: ProductOption) {
  const primary = product.product_codes?.find((code) => code.active !== false && code.is_primary)
  const fallback = product.product_codes?.find((code) => code.active !== false)
  return primary?.code_value || fallback?.code_value || null
}

function channelForSupplier(supplier: SupplierOption): 'whatsapp' | 'email' | 'manual' {
  if (supplier.commercial_whatsapp || supplier.phone) return 'whatsapp'
  if (supplier.commercial_email || supplier.email) return 'email'
  return 'manual'
}

function channelLabel(channel: string) {
  if (channel === 'whatsapp') return 'WhatsApp'
  if (channel === 'email') return 'E-mail'
  return 'Manual'
}

function isSupplierEligibleForQuotation(supplier: SupplierOption) {
  return (
    supplier.active !== false &&
    supplier.blocked !== true &&
    supplier.homologation_status === 'approved'
  )
}

export default function PurchaseQuotationBatchPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const storeId = getActiveStoreId()
  const { permissions } = usePermissions(storeId ?? null)
  const canCreateQuotes =
    hasEffectivePermission(permissions, 'quotes.manage') ||
    hasEffectivePermission(permissions, 'quotes.create')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<SelectedItem[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({})
  const [productSearch, setProductSearch] = useState('')
  const [productToAddId, setProductToAddId] = useState('')
  const [manualQuantity, setManualQuantity] = useState('1')
  const [manualUnitCost, setManualUnitCost] = useState('')
  const [deadlineDays, setDeadlineDays] = useState('0')
  const [deadlineHours, setDeadlineHours] = useState('1')
  const [deadlineMinutes, setDeadlineMinutes] = useState('0')
  const [messageSubject, setMessageSubject] = useState('Cotação de reposição de estoque')
  const [notes, setNotes] = useState('Cotação criada a partir das sugestões de compra do estoque.')
  const [created, setCreated] = useState<CreatedQuotation[]>([])

  const deadlineTotalMinutes = useMemo(() => {
    return Math.max(
      0,
      Math.floor(
        parseNumber(deadlineDays) * 24 * 60 +
          parseNumber(deadlineHours) * 60 +
          parseNumber(deadlineMinutes)
      )
    )
  }, [deadlineDays, deadlineHours, deadlineMinutes])

  const expiresAt = useMemo(() => {
    if (deadlineTotalMinutes <= 0) return null
    return new Date(Date.now() + deadlineTotalMinutes * 60 * 1000)
  }, [deadlineTotalMinutes])

  const includedItems = useMemo(
    () => items.filter((item) => item.included && item.quantity > 0),
    [items]
  )
  const selectedSupplierList = useMemo(
    () => suppliers.filter((supplier) => selectedSuppliers[supplier.id]),
    [suppliers, selectedSuppliers]
  )

  const availableProductsForManualAdd = useMemo(() => {
    const usedIds = new Set(items.map((item) => item.productId))
    const normalizedSearch = productSearch.trim().toLowerCase()

    return products
      .filter((product) => !usedIds.has(product.id))
      .filter((product) => {
        if (!normalizedSearch) return true
        const code = productDisplayCode(product)?.toLowerCase() || ''
        return (
          product.name.toLowerCase().includes(normalizedSearch) || code.includes(normalizedSearch)
        )
      })
  }, [items, products, productSearch])

  const load = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const [suggestionsResult, suppliersResult, productsResult] = await Promise.all([
        supabase.rpc('get_purchase_suggestions_by_store', { p_store_id: storeId }),
        supabase
          .from('suppliers')
          .select(
            'id, name, trade_name, phone, email, commercial_whatsapp, commercial_email, active, blocked, homologation_status, preferred_supplier'
          )
          .eq('store_id', storeId)
          .eq('active', true)
          .eq('blocked', false)
          .eq('homologation_status', 'approved')
          .order('preferred_supplier', { ascending: false })
          .order('name', { ascending: true }),
        supabase
          .from('products')
          .select(
            'id, name, category_id, price, min_stock, max_stock, product_codes(code_type, code_value, active, is_primary)'
          )
          .eq('store_id', storeId)
          .eq('active', true)
          .eq('is_discontinued', false)
          .order('name', { ascending: true }),
      ])

      if (suggestionsResult.error) throw suggestionsResult.error
      if (suppliersResult.error) throw suppliersResult.error
      if (productsResult.error) throw productsResult.error

      const queryProductId = searchParams.get('product_id')
      const queryProductName = searchParams.get('product_name')
      const queryLocationName = searchParams.get('location_name')
      const queryQty = toSafePositive(Number(searchParams.get('suggested_qty') || 0))

      const suggestions = ((suggestionsResult.data || []) as PurchaseSuggestion[]).filter(
        (suggestion) => Number(suggestion.suggested_purchase_qty ?? 0) > 0
      )

      const nextItems = suggestions.map<SelectedItem>((suggestion) => ({
        productId: suggestion.product_id,
        productName: suggestion.product_name,
        locationName: suggestion.location_name ?? null,
        quantity: toSafePositive(
          Number(suggestion.suggested_purchase_qty ?? suggestion.shortage_qty ?? 1)
        ),
        referenceUnitCost: Number.isFinite(Number(suggestion.suggested_unit_cost))
          ? Number(suggestion.suggested_unit_cost)
          : null,
        reason: suggestion.recommendation_reason || 'Reposição sugerida pelo estoque',
        included: true,
        manual: false,
      }))

      if (
        queryProductId &&
        queryProductName &&
        !nextItems.some((item) => item.productId === queryProductId)
      ) {
        nextItems.unshift({
          productId: queryProductId,
          productName: queryProductName,
          locationName: queryLocationName || null,
          quantity: queryQty,
          referenceUnitCost: null,
          reason: 'Produto selecionado na tela de estoque',
          included: true,
          manual: false,
        })
      }

      const nextProducts = (productsResult.data || []) as ProductOption[]
      const nextSuppliers = ((suppliersResult.data || []) as SupplierOption[]).filter(
        isSupplierEligibleForQuotation
      )
      setItems(nextItems)
      setProducts(nextProducts)
      setSuppliers(nextSuppliers)
      setProductToAddId(
        (current) =>
          current ||
          nextProducts.find((product) => !nextItems.some((item) => item.productId === product.id))
            ?.id ||
          ''
      )

      const preferredSupplierIds = new Set(
        suggestions
          .map((suggestion) => suggestion.suggested_supplier_id)
          .filter((supplierId): supplierId is string => Boolean(supplierId))
      )
      setSelectedSuppliers(
        Object.fromEntries(
          nextSuppliers.map((supplier) => [
            supplier.id,
            preferredSupplierIds.has(supplier.id) || supplier.preferred_supplier,
          ])
        )
      )
    } catch (error) {
      console.error('Erro ao carregar cotação em lote:', error)
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível carregar a cotação em lote.'
      )
    } finally {
      setLoading(false)
    }
  }, [storeId, searchParams])

  useEffect(() => {
    void load()
  }, [load])

  function updateItem(productId: string, patch: Partial<SelectedItem>) {
    setItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, ...patch } : item))
    )
  }

  function removeItem(productId: string) {
    setItems((current) => current.filter((item) => item.productId !== productId))
  }

  function toggleAllItems(included: boolean) {
    setItems((current) => current.map((item) => ({ ...item, included })))
  }

  function toggleSupplier(id: string) {
    setSelectedSuppliers((current) => ({ ...current, [id]: !current[id] }))
  }

  function addManualProduct() {
    const product =
      products.find((option) => option.id === productToAddId) || availableProductsForManualAdd[0]
    if (!product) {
      toast.warning('Não há produto disponível para adicionar.')
      return
    }

    if (items.some((item) => item.productId === product.id)) {
      toast.warning('Este produto já está na cotação.')
      return
    }

    const quantity = toSafePositive(parseNumber(manualQuantity))
    setItems((current) => [
      ...current,
      {
        productId: product.id,
        productName: product.name,
        locationName: null,
        quantity,
        referenceUnitCost: manualUnitCost.trim() ? parseNumber(manualUnitCost) : null,
        reason: 'Incluído manualmente na cotação',
        included: true,
        manual: true,
      },
    ])

    setManualQuantity('1')
    setManualUnitCost('')
    setProductSearch('')
    setProductToAddId('')
    toast.success(`${product.name} adicionado à cotação.`)
  }

  function buildMessageBody(supplier: SupplierOption) {
    const lines = includedItems.map(
      (item) => `• ${item.productName}: ${number.format(item.quantity)} un.`
    )
    return [
      `Olá, ${supplierDisplayName(supplier)}.`,
      'Por favor, nos envie valores e disponibilidade para a cotação abaixo:',
      '',
      ...lines,
      '',
      expiresAt
        ? `Prazo para resposta: ${dateTime.format(expiresAt)}.`
        : 'Prazo para resposta: sem vencimento definido.',
      'Caso algum item esteja indisponível, favor informar no retorno.',
    ].join('\n')
  }

  async function createBatchQuotations() {
    if (!storeId || saving) return

    if (!canCreateQuotes) {
      toast.error('Sem permissão para criar cotações.')
      return
    }

    if (includedItems.length === 0) {
      toast.warning('Selecione ao menos um produto para cotar.')
      return
    }

    if (selectedSupplierList.length === 0) {
      toast.warning('Selecione ao menos um fornecedor aprovado para cotação.')
      return
    }

    setSaving(true)
    setCreated([])
    try {
      const nextCreated: CreatedQuotation[] = []
      const payloadItems = includedItems.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_cost: item.referenceUnitCost ?? null,
        notes: item.locationName ? `Reposição sugerida para ${item.locationName}` : item.reason,
      }))

      for (const supplier of selectedSupplierList) {
        const sentChannel = channelForSupplier(supplier)
        const { data, error } = await supabase.rpc('create_purchase_quotation', {
          p_supplier_id: supplier.id,
          p_items: payloadItems,
          p_message_subject: messageSubject || 'Cotação de reposição de estoque',
          p_message_body: buildMessageBody(supplier),
          p_sent_channel: sentChannel,
          p_responsible_name: null,
          p_notes: [
            notes || null,
            expiresAt ? `Prazo de resposta: ${dateTime.format(expiresAt)}.` : null,
            `Criada em lote com ${includedItems.length} produto(s).`,
          ]
            .filter(Boolean)
            .join('\n'),
          p_expires_at: expiresAt ? expiresAt.toISOString() : null,
        })

        if (error) throw new Error(`${supplierDisplayName(supplier)}: ${error.message}`)
        const result = Array.isArray(data) ? data[0] : data
        nextCreated.push({
          quotation_id: result.quotation_id,
          quotation_code: result.quotation_code,
          supplier_name: supplierDisplayName(supplier),
          items_count: Number(result.items_count ?? includedItems.length),
        })
      }

      setCreated(nextCreated)
      toast.success(`${nextCreated.length} cotação(ões) criada(s).`)
    } catch (error) {
      console.error('Erro ao criar cotações em lote:', error)
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível criar as cotações em lote.'
      )
    } finally {
      setSaving(false)
    }
  }

  async function markExpired() {
    try {
      const { error } = await supabase.rpc('mark_purchase_quotations_expired_safe', {
        p_store_id: storeId,
      })
      if (error) throw error
      toast.success('Cotações expiradas atualizadas.')
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Não foi possível atualizar cotações expiradas.'
      )
    }
  }

  if (!storeId) {
    return (
      <PageContainer
        title="Cotação em lote"
        category="Produtos"
        icon={<ShoppingCart className="text-[#19A999]" size={28} />}
        flat
      >
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Selecione uma loja para criar cotações.
        </div>
      </PageContainer>
    )
  }

  if (loading) return <LoadingSpinner />

  return (
    <PageContainer
      title="Cotação em lote"
      category="Produtos"
      subtitle="Escolha produtos de reposição, fornecedores aprovados e prazo de resposta em minutos, horas ou dias."
      icon={<ShoppingCart className="text-[#19A999]" size={28} />}
      flat
      onRefresh={() => void load()}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/inventory')}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={16} /> Voltar ao estoque
          </button>
          <Link
            to="/admin/stock/quotations"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FileText size={16} /> Cotações
          </Link>
          <Link
            to="/admin/stock/purchase-documents"
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <ShoppingCart size={16} /> Compras
          </Link>
          <button
            type="button"
            onClick={() => void markExpired()}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <Clock3 size={16} /> Atualizar expiradas
          </button>
        </div>

        <section className="rounded-2xl border border-teal-100 bg-teal-50 p-4 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-black">Fluxo desta tela</p>
              <p className="mt-1 font-semibold opacity-90">
                Cada fornecedor aprovado recebe uma cotação com o mesmo conjunto de produtos e o
                mesmo prazo. Quando o prazo passar, cotações sem resposta podem ser marcadas como
                expiradas para não atrapalharem a análise.
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4 dark:border-gray-800">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#19A999]">
                  Produtos para cotar
                </p>
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  Sugestões de compra
                </h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleAllItems(true)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllItems(false)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="border-b border-gray-100 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-950/40">
              <div className="mb-3 flex items-center gap-2">
                <PackagePlus className="text-[#19A999]" size={18} />
                <div>
                  <p className="text-sm font-black text-gray-900 dark:text-white">
                    Adicionar produto fora da sugestão
                  </p>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Use quando quiser cotar um item que ainda não apareceu como reposição
                    automática.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 xl:grid-cols-[minmax(180px,0.8fr)_minmax(240px,1.2fr)_120px_140px_auto] xl:items-end">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Buscar
                  </span>
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Nome ou código"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Produto
                  </span>
                  <select
                    value={productToAddId}
                    onChange={(event) => setProductToAddId(event.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  >
                    <option value="">Selecione um produto</option>
                    {availableProductsForManualAdd.map((product) => {
                      const code = productDisplayCode(product)
                      return (
                        <option key={product.id} value={product.id}>
                          {product.name}
                          {code ? ` · ${code}` : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Quantidade
                  </span>
                  <input
                    value={manualQuantity}
                    onFocus={selectOnFocus}
                    onChange={(event) => setManualQuantity(event.target.value)}
                    inputMode="decimal"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Custo ref.
                  </span>
                  <input
                    value={manualUnitCost}
                    onFocus={selectOnFocus}
                    onChange={(event) => setManualUnitCost(event.target.value)}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={addManualProduct}
                  disabled={!availableProductsForManualAdd.length}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white hover:bg-[#14887B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} /> Adicionar
                </button>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <PackageSearch className="mx-auto mb-3 h-8 w-8 text-gray-400" />
                Nenhuma sugestão de compra encontrada agora. Você pode adicionar produtos
                manualmente acima.
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => (
                  <div
                    key={item.productId}
                    className="grid gap-3 p-4 lg:grid-cols-[auto_minmax(0,1fr)_140px_140px_auto] lg:items-center"
                  >
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={(event) =>
                          updateItem(item.productId, { included: event.target.checked })
                        }
                        className="h-5 w-5 rounded border-gray-300 accent-[#19A999]"
                      />
                      <span className="sr-only">Selecionar {item.productName}</span>
                    </label>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black text-gray-900 dark:text-white">
                          {item.productName}
                        </p>
                        {item.manual && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                            Manual
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {item.locationName ? `${item.locationName} · ` : ''}
                        {item.reason}
                      </p>
                    </div>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Quantidade
                      </span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onFocus={selectOnFocus}
                        onChange={(event) =>
                          updateItem(item.productId, {
                            quantity: toSafePositive(Number(event.target.value)),
                          })
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        Custo ref.
                      </span>
                      <input
                        type="text"
                        value={
                          item.referenceUnitCost == null
                            ? ''
                            : String(item.referenceUnitCost).replace('.', ',')
                        }
                        onFocus={selectOnFocus}
                        onChange={(event) =>
                          updateItem(item.productId, {
                            referenceUnitCost: event.target.value.trim()
                              ? parseNumber(event.target.value)
                              : null,
                          })
                        }
                        placeholder="0,00"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"
                      title="Remover item da cotação"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center gap-2">
                <Users className="text-[#19A999]" size={20} />
                <div>
                  <h2 className="text-lg font-black text-gray-900 dark:text-white">Fornecedores</h2>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                    Somente ativos, desbloqueados e aprovados.
                  </p>
                </div>
              </div>
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {suppliers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                    Nenhum fornecedor aprovado e liberado para cotação.
                  </p>
                ) : (
                  suppliers.map((supplier) => {
                    const channel = channelForSupplier(supplier)
                    return (
                      <label
                        key={supplier.id}
                        className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 p-3 hover:border-[#19A999] dark:border-gray-700 dark:hover:border-[#19A999]"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedSuppliers[supplier.id])}
                          onChange={() => toggleSupplier(supplier.id)}
                          className="mt-1 h-4 w-4 accent-[#19A999]"
                        />
                        <span className="min-w-0">
                          <span className="block font-black text-gray-900 dark:text-white">
                            {supplierDisplayName(supplier)}
                          </span>
                          <span className="block text-xs font-semibold text-gray-500 dark:text-gray-400">
                            {supplier.preferred_supplier ? 'Preferencial · ' : ''}
                            {channelLabel(channel)}
                          </span>
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="text-[#19A999]" size={20} />
                <h2 className="text-lg font-black text-gray-900 dark:text-white">
                  Prazo de resposta
                </h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Dias
                  </span>
                  <input
                    value={deadlineDays}
                    onFocus={selectOnFocus}
                    onChange={(e) => setDeadlineDays(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Horas
                  </span>
                  <input
                    value={deadlineHours}
                    onFocus={selectOnFocus}
                    onChange={(e) => setDeadlineHours(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                    Minutos
                  </span>
                  <input
                    value={deadlineMinutes}
                    onFocus={selectOnFocus}
                    onChange={(e) => setDeadlineMinutes(e.target.value)}
                    inputMode="numeric"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-bold dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </label>
              </div>
              <p className="mt-3 rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-600 dark:bg-gray-950 dark:text-gray-300">
                {expiresAt ? `Vence em ${dateTime.format(expiresAt)}` : 'Sem vencimento definido'}
              </p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <label className="block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Assunto
                </span>
                <input
                  value={messageSubject}
                  onChange={(e) => setMessageSubject(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-bold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>
              <label className="mt-3 block space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Observação interna
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />
              </label>
              <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-950 dark:text-gray-300">
                <strong>{includedItems.length}</strong> produto(s) ·{' '}
                <strong>{selectedSupplierList.length}</strong> fornecedor(es)
              </div>
              <button
                type="button"
                disabled={
                  saving ||
                  !canCreateQuotes ||
                  includedItems.length === 0 ||
                  selectedSupplierList.length === 0
                }
                onClick={() => void createBatchQuotations()}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-3 text-sm font-black text-white transition hover:bg-[#14887B] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
                Criar cotações em lote
              </button>
            </section>
          </aside>
        </div>

        {created.length > 0 && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black text-emerald-950 dark:text-emerald-100">
                  Cotações criadas
                </p>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Agora elas entram na fila de resposta e vencimento.
                </p>
              </div>
              <Link
                to="/admin/stock/quotations"
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white"
              >
                Ver cotações
              </Link>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {created.map((quotation) => (
                <div
                  key={quotation.quotation_id}
                  className="rounded-xl bg-white p-3 text-sm dark:bg-gray-900"
                >
                  <p className="font-black text-gray-900 dark:text-white">
                    {quotation.quotation_code}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {quotation.supplier_name} · {quotation.items_count} item(ns)
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex gap-3">
            <FileText className="mt-0.5 shrink-0 text-[#19A999]" size={20} />
            <div>
              <p className="font-black text-gray-900 dark:text-white">Próxima etapa desta frente</p>
              <p className="mt-1 text-sm font-semibold text-gray-600 dark:text-gray-300">
                Na lista de cotações, selecione as respostas da mesma rodada e use Comparar. A
                análise agrupa por produto, identifica propostas expiradas ou itens indisponíveis e
                destaca o menor preço válido por item.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PageContainer>
  )
}
