import { supabase } from '@/lib/supabase'

export type AccountsPayableStatus = 'draft' | 'open' | 'partially_paid' | 'paid' | 'cancelled'
export type AccountsPayableInstallmentStatus = 'pending' | 'partially_paid' | 'paid' | 'cancelled'
export type AccountsPayableAdjustmentType = 'discount' | 'supplier_credit' | 'return' | 'correction' | 'other'
export type AccountsPayableAdjustmentDirection = 'increase' | 'decrease'

export type PurchasePaymentTerm = {
  id: string
  code: string
  name: string
  payment_mode: 'cash' | 'term'
  installment_count: number
  offset_days: number[]
  payment_method_code?: string | null
  active: boolean
  is_default: boolean
  is_system_preset: boolean
}

export type AccountsPayable = {
  id: string
  payable_code: string
  store_id: string
  supplier_id: string
  purchase_document_id: string
  document_number?: string | null
  description: string
  original_amount: number
  adjustment_amount: number
  net_amount: number
  paid_amount: number
  open_amount: number
  status: AccountsPayableStatus
  payment_term_id: string
  payment_term_snapshot: Record<string, unknown>
  payment_method_code?: string | null
  preferred_financial_account_id?: string | null
  issue_date: string
  notes?: string | null
}

export type AccountsPayableInstallment = {
  id: string
  store_id: string
  accounts_payable_id: string
  installment_number: number
  due_date: string
  original_amount: number
  adjustment_amount: number
  net_amount: number
  paid_amount: number
  open_amount: number
  status: AccountsPayableInstallmentStatus
  payment_method_code?: string | null
  preferred_financial_account_id?: string | null
}

export type AccountsPayableAdjustment = {
  id: string
  store_id: string
  accounts_payable_id: string
  installment_id?: string | null
  purchase_receipt_issue_id?: string | null
  adjustment_type: AccountsPayableAdjustmentType
  direction: AccountsPayableAdjustmentDirection
  amount: number
  status: 'active' | 'reversed'
  notes?: string | null
  created_at: string
  reversed_at?: string | null
  reversal_reason?: string | null
}

export type AccountsPayablePayment = {
  id: string
  store_id: string
  accounts_payable_id: string
  installment_id: string
  amount: number
  paid_at: string
  financial_account_id: string
  payment_method_code: string
  reference?: string | null
  notes?: string | null
  cashbook_entry_id?: string | null
  status: 'confirmed' | 'reversed'
  created_at: string
  reversed_at?: string | null
  reversal_reason?: string | null
  reversal_cashbook_entry_id?: string | null
}

export type AccountsPayableEvent = {
  id: string
  store_id: string
  accounts_payable_id: string
  event_type: string
  title: string
  description?: string | null
  old_data?: Record<string, unknown> | null
  new_data?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  created_at: string
}

export type AccountsPayableDetail = {
  payable: AccountsPayable
  installments: AccountsPayableInstallment[]
  adjustments: AccountsPayableAdjustment[]
  payments: AccountsPayablePayment[]
  events: AccountsPayableEvent[]
}

export type AccountsPayableListItem = AccountsPayable & {
  supplier_name: string
  next_due_date?: string | null
}

export type AccountsPayableFinancialOption = {
  id: string
  code: string
  name: string
  account_type: string
  is_default: boolean
  sort_order: number
}

export type AccountsPayablePaymentMethodOption = {
  code: string
  base_code: string
  name: string
  preferred_financial_account_id?: string | null
  sort_order: number
}

export type AccountsPayablePaymentOptions = {
  financial_accounts: AccountsPayableFinancialOption[]
  payment_methods: AccountsPayablePaymentMethodOption[]
}

function rpcError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return new Error(error.message)
  }
  return new Error(fallback)
}

export const AccountsPayableService = {
  async listPaymentTerms(storeId: string, includeInactive = false): Promise<PurchasePaymentTerm[]> {
    const { data, error } = await supabase.rpc('list_purchase_payment_terms_safe', {
      p_store_id: storeId,
      p_include_inactive: includeInactive,
    })
    if (error) throw rpcError(error, 'Não foi possível carregar as condições de pagamento.')
    return (data ?? []) as PurchasePaymentTerm[]
  },

  async upsertPaymentTerm(input: {
    storeId: string
    termId?: string | null
    name: string
    code?: string | null
    paymentMode: 'cash' | 'term'
    offsetDays: number[]
    paymentMethodCode?: string | null
    isDefault?: boolean
    active?: boolean
    metadata?: Record<string, unknown>
  }): Promise<PurchasePaymentTerm> {
    const { data, error } = await supabase.rpc('upsert_purchase_payment_term_safe', {
      p_store_id: input.storeId,
      p_term_id: input.termId || null,
      p_name: input.name,
      p_code: input.code || null,
      p_payment_mode: input.paymentMode,
      p_offset_days: input.offsetDays,
      p_payment_method_code: input.paymentMethodCode || null,
      p_is_default: input.isDefault ?? false,
      p_active: input.active ?? true,
      p_metadata: input.metadata || {},
    })
    if (error) throw rpcError(error, 'Não foi possível salvar a condição de pagamento.')
    return data as PurchasePaymentTerm
  },

  async listPaymentOptions(storeId: string): Promise<AccountsPayablePaymentOptions> {
    const { data, error } = await supabase.rpc('list_accounts_payable_payment_options_safe', {
      p_store_id: storeId,
    })
    if (error) throw rpcError(error, 'Não foi possível carregar contas e formas de pagamento.')
    const value = (data || {}) as Partial<AccountsPayablePaymentOptions>
    return {
      financial_accounts: value.financial_accounts || [],
      payment_methods: value.payment_methods || [],
    }
  },

  async suggestSupplierPaymentTerm(storeId: string, supplierId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await supabase.rpc('suggest_supplier_payment_term_safe', {
      p_store_id: storeId,
      p_supplier_id: supplierId,
    })
    if (error) throw rpcError(error, 'Não foi possível sugerir a condição de pagamento.')
    return (data ?? null) as Record<string, unknown> | null
  },

  async setPurchaseFinancialTerms(input: {
    purchaseDocumentId: string
    paymentTermId: string
    paymentMethodCode?: string | null
    preferredFinancialAccountId?: string | null
    paymentTermSource?: string
    notes?: string | null
  }): Promise<AccountsPayableDetail> {
    const { data, error } = await supabase.rpc('set_purchase_financial_terms_safe', {
      p_document_id: input.purchaseDocumentId,
      p_payment_term_id: input.paymentTermId,
      p_payment_method_code: input.paymentMethodCode || null,
      p_preferred_financial_account_id: input.preferredFinancialAccountId || null,
      p_payment_term_source: input.paymentTermSource || 'manual',
      p_notes: input.notes || null,
    })
    if (error) throw rpcError(error, 'Não foi possível definir a condição financeira da compra.')
    return data as AccountsPayableDetail
  },

  async list(input: {
    storeId: string
    status?: AccountsPayableStatus | null
    supplierId?: string | null
    dueFrom?: string | null
    dueTo?: string | null
    limit?: number
    offset?: number
  }): Promise<{ items: AccountsPayableListItem[]; total: number }> {
    const { data, error } = await supabase.rpc('list_accounts_payable_safe', {
      p_store_id: input.storeId,
      p_status: input.status || null,
      p_supplier_id: input.supplierId || null,
      p_due_from: input.dueFrom || null,
      p_due_to: input.dueTo || null,
      p_limit: input.limit ?? 200,
      p_offset: input.offset ?? 0,
    })
    if (error) throw rpcError(error, 'Não foi possível carregar as contas a pagar.')
    return {
      items: ((data as { items?: AccountsPayableListItem[] } | null)?.items ?? []),
      total: Number((data as { total?: number } | null)?.total ?? 0),
    }
  },

  async detail(payableId: string): Promise<AccountsPayableDetail | null> {
    const { data, error } = await supabase.rpc('get_accounts_payable_detail_safe', {
      p_payable_id: payableId,
    })
    if (error) throw rpcError(error, 'Não foi possível carregar a conta a pagar.')
    return (data ?? null) as AccountsPayableDetail | null
  },

  async applyAdjustment(input: {
    payableId: string
    type: AccountsPayableAdjustmentType
    direction: AccountsPayableAdjustmentDirection
    amount: number
    purchaseReceiptIssueId?: string | null
    notes?: string | null
  }): Promise<AccountsPayableDetail> {
    const { data, error } = await supabase.rpc('apply_accounts_payable_adjustment_safe', {
      p_payable_id: input.payableId,
      p_adjustment_type: input.type,
      p_direction: input.direction,
      p_amount: input.amount,
      p_purchase_receipt_issue_id: input.purchaseReceiptIssueId || null,
      p_notes: input.notes || null,
    })
    if (error) throw rpcError(error, 'Não foi possível aplicar o ajuste financeiro.')
    return data as AccountsPayableDetail
  },

  async reverseAdjustment(adjustmentId: string, reason: string): Promise<AccountsPayableDetail> {
    const { data, error } = await supabase.rpc('reverse_accounts_payable_adjustment_safe', {
      p_adjustment_id: adjustmentId,
      p_reason: reason,
    })
    if (error) throw rpcError(error, 'Não foi possível estornar o ajuste financeiro.')
    return data as AccountsPayableDetail
  },

  async registerPayment(input: {
    installmentId: string
    amount: number
    financialAccountId: string
    paymentMethodCode: string
    paidAt?: string | null
    reference?: string | null
    notes?: string | null
  }): Promise<AccountsPayableDetail> {
    const { data, error } = await supabase.rpc('register_accounts_payable_payment_safe', {
      p_installment_id: input.installmentId,
      p_amount: input.amount,
      p_financial_account_id: input.financialAccountId,
      p_payment_method_code: input.paymentMethodCode,
      p_paid_at: input.paidAt || new Date().toISOString(),
      p_reference: input.reference || null,
      p_notes: input.notes || null,
    })
    if (error) throw rpcError(error, 'Não foi possível registrar o pagamento.')
    return data as AccountsPayableDetail
  },

  async reversePayment(paymentId: string, reason: string): Promise<AccountsPayableDetail> {
    const { data, error } = await supabase.rpc('reverse_accounts_payable_payment_safe', {
      p_payment_id: paymentId,
      p_reason: reason,
    })
    if (error) throw rpcError(error, 'Não foi possível estornar o pagamento.')
    return data as AccountsPayableDetail
  },

  async cancel(payableId: string, reason: string): Promise<AccountsPayableDetail> {
    const { data, error } = await supabase.rpc('cancel_accounts_payable_safe', {
      p_payable_id: payableId,
      p_reason: reason,
    })
    if (error) throw rpcError(error, 'Não foi possível cancelar a conta a pagar.')
    return data as AccountsPayableDetail
  },

  async setQuotationRequest(quotationId: string, paymentTermId: string, paymentMethodCode?: string | null) {
    const { data, error } = await supabase.rpc('set_purchase_quotation_payment_request_safe', {
      p_quotation_id: quotationId,
      p_payment_term_id: paymentTermId,
      p_payment_method_code: paymentMethodCode || null,
    })
    if (error) throw rpcError(error, 'Não foi possível definir a condição enviada na cotação.')
    return data as Record<string, unknown>
  },

  async setQuotationSupplierResponse(input: {
    quotationId: string
    paymentTermId: string
    paymentMethodCode?: string | null
    notes?: string | null
  }) {
    const { data, error } = await supabase.rpc('set_purchase_quotation_payment_response_safe', {
      p_quotation_id: input.quotationId,
      p_payment_term_id: input.paymentTermId,
      p_payment_method_code: input.paymentMethodCode || null,
      p_notes: input.notes || null,
    })
    if (error) throw rpcError(error, 'Não foi possível registrar a condição respondida pelo fornecedor.')
    return data as Record<string, unknown>
  },

  async acceptQuotationTerms(quotationId: string, paymentTermId?: string | null, paymentMethodCode?: string | null) {
    const { data, error } = await supabase.rpc('accept_purchase_quotation_payment_terms_safe', {
      p_quotation_id: quotationId,
      p_payment_term_id: paymentTermId || null,
      p_payment_method_code: paymentMethodCode || null,
    })
    if (error) throw rpcError(error, 'Não foi possível aceitar a condição financeira da cotação.')
    return data as Record<string, unknown>
  },
}
