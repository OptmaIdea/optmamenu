import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Filter,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import PageContainer from '@/components/common/PageContainer'
import { usePermissions } from '@/hooks/usePermissions'
import {
  AccountsPayableService,
  type AccountsPayableAdjustment,
  type AccountsPayableAdjustmentDirection,
  type AccountsPayableAdjustmentType,
  type AccountsPayableDetail,
  type AccountsPayableInstallment,
  type AccountsPayableListItem,
  type AccountsPayablePayment,
  type AccountsPayablePaymentOptions,
  type AccountsPayableStatus,
  type PurchasePaymentTerm,
} from '@/services/accountsPayableService'
import { getActiveStoreId } from '@/utils/activeStore'
import {
  accountsPayableStatusLabel,
  accountsPayableStatusTone,
  daysUntilDate,
  isAccountsPayableOverdue,
  parseMoneyBR,
  parsePaymentOffsetsInput,
  paymentTermScheduleLabel,
} from './accountsPayableViewUtils'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const shortDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })
const fullDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
const inputClass = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition focus:border-[#19A999] focus:ring-2 focus:ring-[#19A999]/15 dark:border-gray-700 dark:bg-gray-950 dark:text-white'

type ActiveTab = 'payables' | 'terms'
type ReasonAction =
  | { kind: 'payment'; id: string; title: string }
  | { kind: 'adjustment'; id: string; title: string }
  | { kind: 'cancel'; id: string; title: string }
  | null

type TermDraft = {
  id?: string
  name: string
  code: string
  paymentMode: 'cash' | 'term'
  offsets: string
  paymentMethodCode: string
  active: boolean
  isDefault: boolean
  isSystemPreset: boolean
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatDateOnly(value?: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return shortDate.format(new Date(year, month - 1, day))
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : fullDate.format(parsed)
}

function nowLocalInput() {
  const current = new Date()
  const local = new Date(current.getTime() - current.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">{children}</span>
}

function ModalFrame({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border-2 border-gray-300 bg-white shadow-2xl ring-1 ring-black/10 dark:border-gray-600 dark:bg-gray-900 dark:ring-white/10">
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/80">
          <div>
            <h2 className="text-lg font-black text-gray-900 dark:text-white">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        <div className="border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/70">{footer}</div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wider text-gray-400">{label}</p>
          <p className="mt-1 text-xl font-black text-gray-900 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{helper}</p>
        </div>
        <div className="rounded-xl bg-[#19A999]/10 p-3 text-[#19A999]">{icon}</div>
      </div>
    </div>
  )
}

function paymentMethodLabel(code: string, options: AccountsPayablePaymentOptions) {
  return options.payment_methods.find((item) => item.code === code)?.name || 'Forma de pagamento'
}

function financialAccountLabel(id: string, options: AccountsPayablePaymentOptions) {
  return options.financial_accounts.find((item) => item.id === id)?.name || 'Conta financeira'
}

function adjustmentLabel(type: AccountsPayableAdjustmentType) {
  return ({
    discount: 'Desconto',
    supplier_credit: 'Crédito do fornecedor',
    return: 'Devolução',
    correction: 'Correção',
    other: 'Outro',
  } satisfies Record<AccountsPayableAdjustmentType, string>)[type]
}

function dueLabel(dueDate: string, openAmount: number, status: AccountsPayableStatus) {
  if (status === 'paid') return 'Quitado'
  if (status === 'cancelled') return 'Cancelado'
  if (openAmount <= 0) return 'Sem saldo'
  const days = daysUntilDate(dueDate)
  if (days === null) return formatDateOnly(dueDate)
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'} em atraso`
  if (days === 0) return 'Vence hoje'
  if (days === 1) return 'Vence amanhã'
  return `Vence em ${days} dias`
}

export default function AccountsPayablePage() {
  const storeId = getActiveStoreId()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: ActiveTab = searchParams.get('tab') === 'terms' ? 'terms' : 'payables'
  const { hasPermission, loading: permissionsLoading } = usePermissions(storeId)

  const [payables, setPayables] = useState<AccountsPayableListItem[]>([])
  const [terms, setTerms] = useState<PurchasePaymentTerm[]>([])
  const [paymentOptions, setPaymentOptions] = useState<AccountsPayablePaymentOptions>({ financial_accounts: [], payment_methods: [] })
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [selectedPayableId, setSelectedPayableId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AccountsPayableDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AccountsPayableStatus>('all')
  const [supplierFilter, setSupplierFilter] = useState('all')
  const [dueFrom, setDueFrom] = useState('')
  const [dueTo, setDueTo] = useState('')
  const [showInactiveTerms, setShowInactiveTerms] = useState(false)

  const [paymentTarget, setPaymentTarget] = useState<AccountsPayableInstallment | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentAccountId, setPaymentAccountId] = useState('')
  const [paymentMethodCode, setPaymentMethodCode] = useState('')
  const [paymentPaidAt, setPaymentPaidAt] = useState(nowLocalInput())
  const [paymentReference, setPaymentReference] = useState('')
  const [paymentNotes, setPaymentNotes] = useState('')

  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState<AccountsPayableAdjustmentType>('discount')
  const [adjustmentDirection, setAdjustmentDirection] = useState<AccountsPayableAdjustmentDirection>('decrease')
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [adjustmentNotes, setAdjustmentNotes] = useState('')

  const [reasonAction, setReasonAction] = useState<ReasonAction>(null)
  const [reason, setReason] = useState('')
  const [termDraft, setTermDraft] = useState<TermDraft | null>(null)

  const canManage = hasPermission('accounts_payable.manage')
  const canPay = hasPermission('accounts_payable.pay')
  const canReverse = hasPermission('accounts_payable.reverse_payment')

  const setTab = (tab: ActiveTab) => {
    const next = new URLSearchParams(searchParams)
    if (tab === 'terms') next.set('tab', 'terms')
    else next.delete('tab')
    setSearchParams(next, { replace: true })
  }

  const loadDetail = useCallback(async (payableId: string) => {
    setDetailLoading(true)
    try {
      setDetail(await AccountsPayableService.detail(payableId))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar o título.')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadWorkspace = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    try {
      const [listResult, paymentTerms, options] = await Promise.all([
        AccountsPayableService.list({ storeId, limit: 500 }),
        AccountsPayableService.listPaymentTerms(storeId, true),
        AccountsPayableService.listPaymentOptions(storeId),
      ])
      setPayables(listResult.items)
      setTerms(paymentTerms)
      setPaymentOptions(options)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar Contas a Pagar.')
    } finally {
      setLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  const refreshPayables = useCallback(async (preferredDetail?: AccountsPayableDetail | null) => {
    if (!storeId) return
    const result = await AccountsPayableService.list({ storeId, limit: 500 })
    setPayables(result.items)
    if (preferredDetail) {
      setDetail(preferredDetail)
      setSelectedPayableId(preferredDetail.payable.id)
    } else if (selectedPayableId) {
      await loadDetail(selectedPayableId)
    }
  }, [loadDetail, selectedPayableId, storeId])

  const suppliers = useMemo(() => {
    const unique = new Map<string, string>()
    payables.forEach((item) => unique.set(item.supplier_id, item.supplier_name))
    return [...unique.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [payables])

  const filteredPayables = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR')
    return payables.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false
      if (supplierFilter !== 'all' && item.supplier_id !== supplierFilter) return false
      if (dueFrom && (!item.next_due_date || item.next_due_date < dueFrom)) return false
      if (dueTo && (!item.next_due_date || item.next_due_date > dueTo)) return false
      if (!query) return true
      return [item.payable_code, item.supplier_name, item.document_number, item.description]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase('pt-BR').includes(query))
    })
  }, [dueFrom, dueTo, payables, search, statusFilter, supplierFilter])

  const summary = useMemo(() => {
    let openAmount = 0
    let overdue = 0
    let dueSoon = 0
    let paid = 0
    payables.forEach((item) => {
      if (item.status !== 'cancelled') openAmount += numberValue(item.open_amount)
      if (item.status === 'paid') paid += 1
      if (item.next_due_date && numberValue(item.open_amount) > 0) {
        const days = daysUntilDate(item.next_due_date)
        if (days !== null && days < 0) overdue += 1
        else if (days !== null && days <= 7) dueSoon += 1
      }
    })
    return { openAmount, overdue, dueSoon, paid }
  }, [payables])

  const openPayable = async (item: AccountsPayableListItem) => {
    setSelectedPayableId(item.id)
    await loadDetail(item.id)
  }

  const closeDetail = () => {
    setSelectedPayableId(null)
    setDetail(null)
  }

  const openPayment = (installment: AccountsPayableInstallment) => {
    const fallbackMethod = installment.payment_method_code || detail?.payable.payment_method_code || ''
    const explicitAccount = installment.preferred_financial_account_id || detail?.payable.preferred_financial_account_id || ''
    setPaymentTarget(installment)
    setPaymentAmount(numberValue(installment.open_amount).toFixed(2).replace('.', ','))
    setPaymentMethodCode(fallbackMethod)
    setPaymentAccountId(explicitAccount)
    setPaymentPaidAt(nowLocalInput())
    setPaymentReference('')
    setPaymentNotes('')
  }

  const changePaymentMethod = (code: string) => {
    setPaymentMethodCode(code)
  }

  const submitPayment = async () => {
    if (!paymentTarget) return
    const amount = parseMoneyBR(paymentAmount)
    if (!(amount > 0)) return void toast.warning('Informe um valor de pagamento válido.')
    if (amount > numberValue(paymentTarget.open_amount) + 0.001) return void toast.warning('O pagamento não pode ultrapassar o saldo da parcela.')
    if (!paymentAccountId) return void toast.warning('Selecione a conta financeira da saída.')
    if (!paymentMethodCode) return void toast.warning('Selecione a forma de pagamento.')
    setWorking(true)
    try {
      const updated = await AccountsPayableService.registerPayment({
        installmentId: paymentTarget.id,
        amount,
        financialAccountId: paymentAccountId,
        paymentMethodCode,
        paidAt: new Date(paymentPaidAt).toISOString(),
        reference: paymentReference,
        notes: paymentNotes,
      })
      toast.success('Pagamento registrado e lançado no financeiro.')
      setPaymentTarget(null)
      await refreshPayables(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível registrar o pagamento.')
    } finally {
      setWorking(false)
    }
  }

  const submitAdjustment = async () => {
    if (!detail) return
    const amount = parseMoneyBR(adjustmentAmount)
    if (!(amount > 0)) return void toast.warning('Informe um valor de ajuste válido.')
    setWorking(true)
    try {
      const updated = await AccountsPayableService.applyAdjustment({
        payableId: detail.payable.id,
        type: adjustmentType,
        direction: adjustmentDirection,
        amount,
        notes: adjustmentNotes,
      })
      toast.success('Ajuste financeiro aplicado sem alterar o valor original.')
      setAdjustmentOpen(false)
      setAdjustmentAmount('')
      setAdjustmentNotes('')
      await refreshPayables(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível aplicar o ajuste.')
    } finally {
      setWorking(false)
    }
  }

  const submitReasonAction = async () => {
    if (!reasonAction || !reason.trim()) return void toast.warning('Informe o motivo para manter a auditoria completa.')
    setWorking(true)
    try {
      let updated: AccountsPayableDetail
      if (reasonAction.kind === 'payment') updated = await AccountsPayableService.reversePayment(reasonAction.id, reason.trim())
      else if (reasonAction.kind === 'adjustment') updated = await AccountsPayableService.reverseAdjustment(reasonAction.id, reason.trim())
      else updated = await AccountsPayableService.cancel(reasonAction.id, reason.trim())
      toast.success(reasonAction.kind === 'cancel' ? 'Conta a pagar cancelada.' : 'Estorno registrado com histórico preservado.')
      setReasonAction(null)
      setReason('')
      await refreshPayables(updated)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível concluir a operação.')
    } finally {
      setWorking(false)
    }
  }

  const openNewTerm = () => setTermDraft({
    name: '', code: '', paymentMode: 'term', offsets: '30', paymentMethodCode: '', active: true, isDefault: false, isSystemPreset: false,
  })

  const openEditTerm = (term: PurchasePaymentTerm) => setTermDraft({
    id: term.id,
    name: term.name,
    code: term.code,
    paymentMode: term.payment_mode,
    offsets: term.offset_days.join('/'),
    paymentMethodCode: term.payment_method_code || '',
    active: term.active,
    isDefault: term.is_default,
    isSystemPreset: term.is_system_preset,
  })

  const submitTerm = async () => {
    if (!storeId || !termDraft) return
    if (!termDraft.name.trim()) return void toast.warning('Informe o nome da condição.')
    let offsets: number[]
    try {
      offsets = termDraft.paymentMode === 'cash' ? [0] : parsePaymentOffsetsInput(termDraft.offsets)
    } catch (error) {
      return void toast.warning(error instanceof Error ? error.message : 'Agenda de vencimentos inválida.')
    }
    setWorking(true)
    try {
      await AccountsPayableService.upsertPaymentTerm({
        storeId,
        termId: termDraft.id || null,
        name: termDraft.name.trim(),
        code: termDraft.code.trim() || null,
        paymentMode: termDraft.paymentMode,
        offsetDays: offsets,
        paymentMethodCode: termDraft.paymentMethodCode || null,
        isDefault: termDraft.isDefault,
        active: termDraft.active,
        metadata: { edited_from_ui: true },
      })
      toast.success(termDraft.id ? 'Condição de pagamento atualizada.' : 'Condição de pagamento criada.')
      setTermDraft(null)
      setTerms(await AccountsPayableService.listPaymentTerms(storeId, true))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a condição.')
    } finally {
      setWorking(false)
    }
  }

  const setDefaultTerm = async (term: PurchasePaymentTerm) => {
    if (!storeId || term.is_default) return
    setWorking(true)
    try {
      await AccountsPayableService.upsertPaymentTerm({
        storeId,
        termId: term.id,
        name: term.name,
        code: term.code,
        paymentMode: term.payment_mode,
        offsetDays: term.offset_days,
        paymentMethodCode: term.payment_method_code || null,
        isDefault: true,
        active: true,
        metadata: { set_default_from_ui: true },
      })
      toast.success(`${term.name} definida como condição padrão.`)
      setTerms(await AccountsPayableService.listPaymentTerms(storeId, true))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível alterar a condição padrão.')
    } finally {
      setWorking(false)
    }
  }

  if (!storeId) {
    return <PageContainer title="Contas a Pagar" category="FINANCEIRO"><div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">Selecione uma loja para continuar.</div></PageContainer>
  }

  return (
    <PageContainer
      title="Contas a Pagar"
      category="FINANCEIRO"
      subtitle="Obrigações de fornecedores, parcelas, baixas, abatimentos e condições comerciais sem confundir compromisso com saída real de dinheiro."
      icon={<ReceiptText className="text-[#19A999]" size={28} />}
      onRefresh={() => void loadWorkspace()}
      action={activeTab === 'terms' && canManage ? (
        <button onClick={openNewTerm} className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-[#14887B]"><Plus size={16} /> Nova condição</button>
      ) : null}
    >
      <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTab('payables')} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${activeTab === 'payables' ? 'bg-[#19A999] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}>Contas a pagar</button>
          <button onClick={() => setTab('terms')} className={`rounded-xl px-4 py-2.5 text-sm font-black transition ${activeTab === 'terms' ? 'bg-[#19A999] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}`}>Condições de compra</button>
        </div>
      </div>

      {(loading || permissionsLoading) ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"><RefreshCw className="animate-spin text-[#19A999]" size={26} /></div>
      ) : activeTab === 'payables' ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Em aberto" value={money.format(summary.openAmount)} helper="Saldo líquido ainda não pago" icon={<CircleDollarSign size={22} />} />
            <SummaryCard label="Atrasados" value={String(summary.overdue)} helper="Vencimentos ultrapassados" icon={<AlertTriangle size={22} />} />
            <SummaryCard label="Próximos 7 dias" value={String(summary.dueSoon)} helper="Vencimentos exigindo atenção" icon={<CalendarClock size={22} />} />
            <SummaryCard label="Quitados" value={String(summary.paid)} helper="Títulos pagos integralmente" icon={<CheckCircle2 size={22} />} />
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-gray-700 dark:text-gray-200"><Filter size={16} /> Filtros</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label className="xl:col-span-2"><FieldLabel>Buscar</FieldLabel><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-9`} placeholder="Fornecedor, título ou documento..." /></div></label>
              <label><FieldLabel>Status</FieldLabel><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | AccountsPayableStatus)} className={inputClass}><option value="all">Todos</option><option value="draft">Rascunho</option><option value="open">Em aberto</option><option value="partially_paid">Parcialmente pago</option><option value="paid">Pago</option><option value="cancelled">Cancelado</option></select></label>
              <label><FieldLabel>Fornecedor</FieldLabel><select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className={inputClass}><option value="all">Todos</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-2"><label><FieldLabel>Vence de</FieldLabel><input type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} className={inputClass} /></label><label><FieldLabel>Até</FieldLabel><input type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} className={inputClass} /></label></div>
            </div>
          </div>

          {filteredPayables.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-gray-900"><ReceiptText className="mx-auto text-gray-300" size={34} /><p className="mt-3 font-black text-gray-700 dark:text-gray-200">Nenhuma obrigação encontrada</p><p className="mt-1 text-sm text-gray-500">A obrigação nasce com a condição financeira da compra; o saldo só se move na baixa.</p></div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-gray-200 bg-white md:block dark:border-gray-800 dark:bg-gray-900">
                <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500 dark:bg-gray-800/70 dark:text-gray-400"><tr><th className="px-4 py-3">Título</th><th className="px-4 py-3">Fornecedor</th><th className="px-4 py-3">Próx. vencimento</th><th className="px-4 py-3 text-right">Líquido</th><th className="px-4 py-3 text-right">Pago</th><th className="px-4 py-3 text-right">Em aberto</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-gray-100 dark:divide-gray-800">{filteredPayables.map((item) => {
                  const overdue = isAccountsPayableOverdue(item.next_due_date, item.open_amount, item.status)
                  return <tr key={item.id} className="cursor-pointer hover:bg-[#19A999]/5" onClick={() => void openPayable(item)}><td className="px-4 py-3"><p className="font-black text-gray-800 dark:text-white">{item.payable_code}</p><p className="text-xs text-gray-400">{item.document_number || item.description}</p></td><td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">{item.supplier_name}</td><td className={`px-4 py-3 ${overdue ? 'font-black text-rose-600 dark:text-rose-300' : 'text-gray-600 dark:text-gray-300'}`}>{item.next_due_date ? <><p>{formatDateOnly(item.next_due_date)}</p><p className="text-xs">{dueLabel(item.next_due_date, item.open_amount, item.status)}</p></> : '—'}</td><td className="px-4 py-3 text-right font-semibold">{money.format(item.net_amount)}</td><td className="px-4 py-3 text-right text-emerald-700 dark:text-emerald-300">{money.format(item.paid_amount)}</td><td className="px-4 py-3 text-right font-black">{money.format(item.open_amount)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${accountsPayableStatusTone(item.status)}`}>{accountsPayableStatusLabel(item.status)}</span></td><td className="px-4 py-3"><ChevronRight className="ml-auto text-gray-400" size={18} /></td></tr>
                })}</tbody></table></div>
              </div>
              <div className="space-y-3 md:hidden">{filteredPayables.map((item) => <button key={item.id} onClick={() => void openPayable(item)} className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm dark:border-gray-800 dark:bg-gray-900"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-gray-900 dark:text-white">{item.payable_code}</p><p className="mt-0.5 text-sm font-semibold text-gray-600 dark:text-gray-300">{item.supplier_name}</p></div><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${accountsPayableStatusTone(item.status)}`}>{accountsPayableStatusLabel(item.status)}</span></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60"><div><p className="text-[10px] font-black uppercase text-gray-400">Em aberto</p><p className="mt-1 font-black">{money.format(item.open_amount)}</p></div><div><p className="text-[10px] font-black uppercase text-gray-400">Próx. vencimento</p><p className="mt-1 font-black">{formatDateOnly(item.next_due_date)}</p></div></div></button>)}</div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100"><div className="flex items-start gap-3"><SlidersHorizontal className="mt-0.5 shrink-0" size={19} /><div><p className="font-black">Modelos de prazo reutilizáveis</p><p className="mt-1 opacity-85">A próxima cotação pode sugerir o prazo da compra recente do fornecedor; sugestão, envio, resposta e aceite permanecem separados.</p></div></div></div>
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-900"><div><p className="font-black text-gray-800 dark:text-white">Condições cadastradas</p><p className="text-sm text-gray-500">À vista, prazo simples ou agendas como 30/60/90.</p></div><label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300"><input type="checkbox" checked={showInactiveTerms} onChange={(event) => setShowInactiveTerms(event.target.checked)} className="h-4 w-4 accent-[#19A999]" /> Mostrar inativas</label></div>
          <div className="grid gap-3 lg:grid-cols-2">{terms.filter((term) => showInactiveTerms || term.active).map((term) => <div key={term.id} className={`rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900 ${term.is_default ? 'border-[#19A999]/60 ring-1 ring-[#19A999]/20' : 'border-gray-200 dark:border-gray-800'} ${!term.active ? 'opacity-65' : ''}`}><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black text-gray-900 dark:text-white">{term.name}</h3>{term.is_default && <span className="rounded-full bg-[#19A999]/10 px-2.5 py-1 text-[10px] font-black uppercase text-[#14887B]">Padrão</span>}{term.is_system_preset && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-black uppercase text-gray-500 dark:bg-gray-800">Modelo inicial</span>}{!term.active && <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">Inativa</span>}</div></div>{canManage && <button onClick={() => openEditTerm(term)} className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:text-[#19A999] dark:border-gray-700" aria-label={`Editar ${term.name}`}><Pencil size={16} /></button>}</div><div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60"><div><p className="text-[10px] font-black uppercase text-gray-400">Agenda</p><p className="mt-1 font-black">{paymentTermScheduleLabel(term.offset_days)}</p></div><div><p className="text-[10px] font-black uppercase text-gray-400">Parcelas</p><p className="mt-1 font-black">{term.installment_count}</p></div><div className="col-span-2"><p className="text-[10px] font-black uppercase text-gray-400">Forma prevista</p><p className="mt-1 font-semibold">{term.payment_method_code ? paymentMethodLabel(term.payment_method_code, paymentOptions) : 'Definida na negociação/baixa'}</p></div></div>{canManage && term.active && !term.is_default && <button disabled={working} onClick={() => void setDefaultTerm(term)} className="mt-4 text-sm font-black text-[#19A999] hover:underline disabled:opacity-50">Definir como padrão da loja</button>}</div>)}</div>
        </div>
      )}

      {selectedPayableId && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/45 backdrop-blur-[1px]" onClick={closeDetail}>
          <aside className="h-full w-full max-w-3xl overflow-y-auto border-l-2 border-gray-300 bg-[#F8F6F2] shadow-2xl dark:border-gray-600 dark:bg-gray-950" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95"><div><p className="text-xs font-black uppercase tracking-wider text-[#19A999]">Detalhe financeiro</p><h2 className="mt-1 text-xl font-black text-gray-900 dark:text-white">{detail?.payable.payable_code || 'Carregando...'}</h2></div><button onClick={closeDetail} className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"><X size={18} /></button></div>
            {detailLoading || !detail ? <div className="flex min-h-80 items-center justify-center"><RefreshCw className="animate-spin text-[#19A999]" /></div> : (
              <div className="space-y-5 p-4 sm:p-6">
                <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm text-gray-500">{payables.find((item) => item.id === detail.payable.id)?.supplier_name || detail.payable.description}</p><p className="mt-1 text-lg font-black text-gray-900 dark:text-white">{detail.payable.document_number || detail.payable.description}</p><p className="mt-1 text-xs text-gray-400">Emissão {formatDateOnly(detail.payable.issue_date)}</p></div><span className={`self-start rounded-full px-3 py-1.5 text-xs font-black ${accountsPayableStatusTone(detail.payable.status)}`}>{accountsPayableStatusLabel(detail.payable.status)}</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div><p className="text-[10px] font-black uppercase text-gray-400">Original</p><p className="mt-1 font-black">{money.format(detail.payable.original_amount)}</p></div><div><p className="text-[10px] font-black uppercase text-gray-400">Ajustes</p><p className="mt-1 font-black">{money.format(detail.payable.adjustment_amount)}</p></div><div><p className="text-[10px] font-black uppercase text-gray-400">Pago</p><p className="mt-1 font-black text-emerald-700 dark:text-emerald-300">{money.format(detail.payable.paid_amount)}</p></div><div><p className="text-[10px] font-black uppercase text-gray-400">Em aberto</p><p className="mt-1 font-black">{money.format(detail.payable.open_amount)}</p></div></div><div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4 dark:border-gray-800"><Link to="/admin/stock/purchase-documents" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-black text-gray-600 dark:border-gray-700 dark:text-gray-300"><FileText size={14} /> Ir para Compras</Link>{canManage && detail.payable.status !== 'cancelled' && detail.payable.status !== 'paid' && <button onClick={() => { setAdjustmentOpen(true); setAdjustmentAmount(''); setAdjustmentNotes('') }} className="inline-flex items-center gap-2 rounded-lg border border-[#19A999]/30 px-3 py-2 text-xs font-black text-[#14887B]"><SlidersHorizontal size={14} /> Aplicar ajuste</button>}{canManage && detail.payable.status !== 'cancelled' && <button onClick={() => { setReasonAction({ kind: 'cancel', id: detail.payable.id, title: 'Cancelar conta a pagar' }); setReason('') }} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-xs font-black text-rose-600 dark:border-rose-900 dark:text-rose-300"><XCircle size={14} /> Cancelar</button>}</div></div>

                <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><div className="mb-4 flex items-center justify-between"><div><h3 className="font-black">Parcelas e vencimentos</h3><p className="text-sm text-gray-500">A baixa movimenta a conta financeira somente quando confirmada.</p></div><CalendarClock className="text-[#19A999]" size={20} /></div><div className="space-y-3">{detail.installments.map((installment) => { const overdue = isAccountsPayableOverdue(installment.due_date, installment.open_amount, detail.payable.status); return <div key={installment.id} className={`rounded-xl border p-4 ${overdue ? 'border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20' : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/40'}`}><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Parcela {installment.installment_number} · {formatDateOnly(installment.due_date)}</p><p className={`mt-1 text-xs font-bold ${overdue ? 'text-rose-600 dark:text-rose-300' : 'text-gray-500'}`}>{dueLabel(installment.due_date, installment.open_amount, detail.payable.status)}</p></div>{canPay && installment.open_amount > 0 && installment.status !== 'cancelled' && detail.payable.status !== 'cancelled' && <button onClick={() => openPayment(installment)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white"><BadgeDollarSign size={16} /> Pagar {money.format(installment.open_amount)}</button>}</div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><span className="block text-[10px] font-black uppercase text-gray-400">Líquido</span><strong>{money.format(installment.net_amount)}</strong></div><div><span className="block text-[10px] font-black uppercase text-gray-400">Pago</span><strong className="text-emerald-700 dark:text-emerald-300">{money.format(installment.paid_amount)}</strong></div><div><span className="block text-[10px] font-black uppercase text-gray-400">Saldo</span><strong>{money.format(installment.open_amount)}</strong></div></div></div> })}</div></section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><h3 className="font-black">Pagamentos</h3>{detail.payments.length === 0 ? <p className="mt-3 text-sm text-gray-500">Nenhuma saída financeira registrada.</p> : <div className="mt-3 space-y-3">{detail.payments.map((payment: AccountsPayablePayment) => <div key={payment.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"><div className="flex items-start justify-between gap-3"><div><p className={`font-black ${payment.status === 'reversed' ? 'line-through text-gray-400' : ''}`}>{money.format(payment.amount)} · {paymentMethodLabel(payment.payment_method_code, paymentOptions)}</p><p className="mt-1 text-xs text-gray-500">{formatDateTime(payment.paid_at)} · {financialAccountLabel(payment.financial_account_id, paymentOptions)}{payment.reference ? ` · Ref. ${payment.reference}` : ''}</p>{payment.status === 'reversed' && <p className="mt-1 text-xs font-bold text-rose-600">Estornado: {payment.reversal_reason || 'sem descrição'}</p>}</div>{canReverse && payment.status === 'confirmed' && <button onClick={() => { setReasonAction({ kind: 'payment', id: payment.id, title: 'Estornar pagamento' }); setReason('') }} className="rounded-lg border border-rose-200 p-2 text-rose-600 dark:border-rose-900"><RotateCcw size={15} /></button>}</div></div>)}</div>}</section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><h3 className="font-black">Ajustes auditáveis</h3>{detail.adjustments.length === 0 ? <p className="mt-3 text-sm text-gray-500">Nenhum abatimento, crédito ou correção aplicado.</p> : <div className="mt-3 space-y-3">{detail.adjustments.map((adjustment: AccountsPayableAdjustment) => <div key={adjustment.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800"><div className="flex items-start justify-between gap-3"><div><p className={`font-black ${adjustment.status === 'reversed' ? 'line-through text-gray-400' : adjustment.direction === 'decrease' ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-600'}`}>{adjustment.direction === 'decrease' ? '−' : '+'}{money.format(adjustment.amount)} · {adjustmentLabel(adjustment.adjustment_type)}</p><p className="mt-1 text-xs text-gray-500">{formatDateTime(adjustment.created_at)}{adjustment.notes ? ` · ${adjustment.notes}` : ''}</p>{adjustment.status === 'reversed' && <p className="mt-1 text-xs font-bold text-rose-600">Estornado: {adjustment.reversal_reason || 'sem descrição'}</p>}</div>{canManage && adjustment.status === 'active' && <button onClick={() => { setReasonAction({ kind: 'adjustment', id: adjustment.id, title: 'Estornar ajuste' }); setReason('') }} className="rounded-lg border border-gray-200 p-2 text-gray-500 dark:border-gray-700"><RotateCcw size={15} /></button>}</div></div>)}</div>}</section>

                <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"><h3 className="font-black">Histórico</h3><div className="mt-4 space-y-4 border-l-2 border-gray-200 pl-4 dark:border-gray-700">{detail.events.map((event) => <div key={event.id} className="relative"><span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#19A999] ring-4 ring-white dark:ring-gray-900" /><p className="font-bold">{event.title}</p>{event.description && <p className="mt-0.5 text-sm text-gray-500">{event.description}</p>}<p className="mt-1 text-xs text-gray-400">{formatDateTime(event.created_at)}</p></div>)}</div></section>
              </div>
            )}
          </aside>
        </div>
      )}

      {paymentTarget && <ModalFrame title={`Baixar parcela ${paymentTarget.installment_number}`} subtitle={`Saldo disponível: ${money.format(paymentTarget.open_amount)} · vencimento ${formatDateOnly(paymentTarget.due_date)}`} onClose={() => !working && setPaymentTarget(null)} footer={<div className="flex justify-end gap-2"><button disabled={working} onClick={() => setPaymentTarget(null)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-black">Cancelar</button><button disabled={working} onClick={() => void submitPayment()} className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white disabled:opacity-50"><BadgeDollarSign size={16} /> Confirmar baixa</button></div>}><div className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><strong>Movimento real:</strong> confirmar cria uma saída na conta financeira selecionada. A conta não é presumida: confirme de onde o dinheiro realmente saiu.</div><div className="grid gap-4 sm:grid-cols-2"><label><FieldLabel>Valor pago</FieldLabel><input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} className={inputClass} inputMode="decimal" /></label><label><FieldLabel>Data e hora</FieldLabel><input type="datetime-local" value={paymentPaidAt} onChange={(event) => setPaymentPaidAt(event.target.value)} className={inputClass} /></label><label><FieldLabel>Forma de pagamento</FieldLabel><select value={paymentMethodCode} onChange={(event) => changePaymentMethod(event.target.value)} className={inputClass}><option value="">Selecione...</option>{paymentOptions.payment_methods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select></label><label><FieldLabel>Conta financeira da saída</FieldLabel><select value={paymentAccountId} onChange={(event) => setPaymentAccountId(event.target.value)} className={inputClass}><option value="">Selecione a conta usada...</option>{paymentOptions.financial_accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label><FieldLabel>Referência</FieldLabel><input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} className={inputClass} /></label><label><FieldLabel>Observação</FieldLabel><input value={paymentNotes} onChange={(event) => setPaymentNotes(event.target.value)} className={inputClass} /></label></div></div></ModalFrame>}

      {adjustmentOpen && detail && <ModalFrame title="Aplicar ajuste financeiro" subtitle="O valor original permanece preservado para auditoria." onClose={() => !working && setAdjustmentOpen(false)} footer={<div className="flex justify-end gap-2"><button disabled={working} onClick={() => setAdjustmentOpen(false)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-black">Cancelar</button><button disabled={working} onClick={() => void submitAdjustment()} className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white"><Save size={16} /> Aplicar ajuste</button></div>}><div className="grid gap-4 sm:grid-cols-2"><label><FieldLabel>Tipo</FieldLabel><select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as AccountsPayableAdjustmentType)} className={inputClass}><option value="discount">Desconto</option><option value="supplier_credit">Crédito do fornecedor</option><option value="return">Devolução</option><option value="correction">Correção</option><option value="other">Outro</option></select></label><label><FieldLabel>Efeito</FieldLabel><select value={adjustmentDirection} onChange={(event) => setAdjustmentDirection(event.target.value as AccountsPayableAdjustmentDirection)} className={inputClass}><option value="decrease">Diminuir obrigação</option><option value="increase">Aumentar obrigação</option></select></label><label><FieldLabel>Valor</FieldLabel><input value={adjustmentAmount} onChange={(event) => setAdjustmentAmount(event.target.value)} className={inputClass} inputMode="decimal" /></label><label><FieldLabel>Motivo</FieldLabel><input value={adjustmentNotes} onChange={(event) => setAdjustmentNotes(event.target.value)} className={inputClass} /></label></div></ModalFrame>}

      {reasonAction && <ModalFrame title={reasonAction.title} subtitle="A operação não apaga o histórico; o motivo ficará registrado." onClose={() => !working && setReasonAction(null)} footer={<div className="flex justify-end gap-2"><button disabled={working} onClick={() => setReasonAction(null)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-black">Voltar</button><button disabled={working || !reason.trim()} onClick={() => void submitReasonAction()} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-black text-white disabled:opacity-50"><RotateCcw size={16} /> Confirmar</button></div>}><label><FieldLabel>Motivo obrigatório</FieldLabel><textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} className={`${inputClass} min-h-28 resize-y`} /></label></ModalFrame>}

      {termDraft && <ModalFrame title={termDraft.id ? 'Editar condição de pagamento' : 'Nova condição de pagamento'} subtitle="Configure a agenda comercial usada em compras e cotações. Identificadores técnicos são gerenciados pelo sistema." onClose={() => !working && setTermDraft(null)} footer={<div className="flex justify-end gap-2"><button disabled={working} onClick={() => setTermDraft(null)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-black">Cancelar</button><button disabled={working} onClick={() => void submitTerm()} className="inline-flex items-center gap-2 rounded-xl bg-[#19A999] px-4 py-2 text-sm font-black text-white"><Save size={16} /> Salvar condição</button></div>}><div className="space-y-4">{termDraft.isSystemPreset && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">Modelo inicial; as alterações valem somente para a loja atual.</div>}<div className="grid gap-4 sm:grid-cols-2"><label><FieldLabel>Nome</FieldLabel><input value={termDraft.name} onChange={(event) => setTermDraft({ ...termDraft, name: event.target.value })} className={inputClass} /></label><label><FieldLabel>Modalidade</FieldLabel><select value={termDraft.paymentMode} onChange={(event) => { const paymentMode = event.target.value as 'cash' | 'term'; setTermDraft({ ...termDraft, paymentMode, offsets: paymentMode === 'cash' ? '0' : termDraft.offsets === '0' ? '30' : termDraft.offsets }) }} className={inputClass}><option value="cash">À vista</option><option value="term">A prazo</option></select></label><label><FieldLabel>Dias dos vencimentos</FieldLabel><input disabled={termDraft.paymentMode === 'cash'} value={termDraft.paymentMode === 'cash' ? '0' : termDraft.offsets} onChange={(event) => setTermDraft({ ...termDraft, offsets: event.target.value })} className={inputClass} placeholder="30/60/90" /></label><label><FieldLabel>Forma de pagamento prevista</FieldLabel><select value={termDraft.paymentMethodCode} onChange={(event) => setTermDraft({ ...termDraft, paymentMethodCode: event.target.value })} className={inputClass}><option value="">Definir na negociação/baixa</option>{paymentOptions.payment_methods.map((method) => <option key={method.code} value={method.code}>{method.name}</option>)}</select></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-700"><div><p className="font-black">Ativa</p><p className="text-xs text-gray-500">Disponível para novas compras.</p></div><input type="checkbox" checked={termDraft.active} onChange={(event) => setTermDraft({ ...termDraft, active: event.target.checked })} className="h-5 w-5 accent-[#19A999]" /></label><label className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-700"><div><p className="font-black">Padrão da loja</p><p className="text-xs text-gray-500">Usada quando não houver histórico.</p></div><input type="checkbox" checked={termDraft.isDefault} onChange={(event) => setTermDraft({ ...termDraft, isDefault: event.target.checked, active: event.target.checked ? true : termDraft.active })} className="h-5 w-5 accent-[#19A999]" /></label></div></div></ModalFrame>}
    </PageContainer>
  )
}
