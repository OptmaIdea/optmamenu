import { supabase } from '@/lib/supabase';

export type OnlinePaymentPermissions = {
  view: boolean;
  manage: boolean;
  credentials: boolean;
  proofs: boolean;
  refund: boolean;
  events: boolean;
};

export type OnlinePaymentProvider = {
  id: string;
  provider_code: 'optma_sandbox' | 'asaas';
  environment: 'sandbox' | 'production';
  display_name: string;
  enabled: boolean;
  is_default: boolean;
  credential_status: 'not_required' | 'not_configured' | 'configured' | 'invalid' | 'ready';
  capabilities: Record<string, boolean>;
  public_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type OnlinePaymentTransaction = {
  id: string;
  order_id?: string | null;
  order_code?: string | null;
  provider_id: string;
  provider_code: string;
  provider_name: string;
  environment: string;
  method_code: string;
  amount: number;
  currency: string;
  status: string;
  external_payment_id?: string | null;
  external_reference?: string | null;
  checkout_url?: string | null;
  expires_at?: string | null;
  paid_at?: string | null;
  created_at: string;
  metadata?: Record<string, unknown>;
};

export type OnlinePaymentEvent = {
  id: string;
  intent_id?: string | null;
  provider_id: string;
  provider_code: string;
  event_type: string;
  event_status?: string | null;
  signature_valid?: boolean | null;
  processed: boolean;
  external_event_id?: string | null;
  idempotency_key: string;
  error_message?: string | null;
  received_at: string;
  processed_at?: string | null;
};

export type OnlinePaymentProof = {
  id: string;
  order_id: string;
  order_code?: string | null;
  status: string;
  original_file_name?: string | null;
  content_type?: string | null;
  declared_amount?: number | null;
  declared_paid_at?: string | null;
  submitted_at?: string | null;
  decided_at?: string | null;
  decision_source?: string | null;
  decision_notes?: string | null;
  cashbook_entry_id?: string | null;
  financial_account_id?: string | null;
  created_at: string;
};

export type OnlinePaymentsWorkspace = {
  ok: boolean;
  error?: string;
  permissions: OnlinePaymentPermissions;
  providers: OnlinePaymentProvider[];
  transactions: OnlinePaymentTransaction[];
  events: OnlinePaymentEvent[];
  proofs: OnlinePaymentProof[];
  counts: {
    pending: number;
    paid: number;
    failed: number;
    proofs_pending: number;
  };
};

export type OnlinePaymentSettlementAccount = {
  id: string;
  name: string;
  code: string;
  account_type: string;
  active: boolean;
};

export type AsaasSandboxStatus = {
  ok: boolean;
  environment: 'sandbox';
  baseUrl: string;
  merchantConfigured: boolean;
  buyerConfigured: boolean;
  merchantBalance?: unknown;
  buyerBalance?: unknown;
  merchantError?: string | null;
  buyerError?: string | null;
  error?: string;
};

function normalizeWorkspace(data: unknown): OnlinePaymentsWorkspace {
  const row = (data || {}) as Partial<OnlinePaymentsWorkspace>;
  return {
    ok: Boolean(row.ok),
    error: row.error,
    permissions: row.permissions || { view: false, manage: false, credentials: false, proofs: false, refund: false, events: false },
    providers: Array.isArray(row.providers) ? row.providers : [],
    transactions: Array.isArray(row.transactions) ? row.transactions : [],
    events: Array.isArray(row.events) ? row.events : [],
    proofs: Array.isArray(row.proofs) ? row.proofs : [],
    counts: row.counts || { pending: 0, paid: 0, failed: 0, proofs_pending: 0 },
  };
}

export const OnlinePaymentsService = {
  async getWorkspace(storeId: string) {
    const { data, error } = await supabase.rpc('get_online_payments_workspace_safe', { p_store_id: storeId });
    if (error) throw error;
    const result = normalizeWorkspace(data);
    if (!result.ok) throw new Error(result.error || 'Não foi possível carregar pagamentos online.');
    return result;
  },

  async saveProvider(input: {
    storeId: string;
    providerCode: 'optma_sandbox' | 'asaas';
    environment?: 'sandbox' | 'production';
    enabled: boolean;
    isDefault?: boolean;
    publicConfig?: Record<string, unknown>;
  }) {
    const { data, error } = await supabase.rpc('save_online_payment_provider_safe', {
      p_store_id: input.storeId,
      p_provider_code: input.providerCode,
      p_environment: input.environment || 'sandbox',
      p_enabled: input.enabled,
      p_is_default: Boolean(input.isDefault),
      p_public_config: input.publicConfig || {},
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) throw new Error(result?.error || 'Não foi possível salvar o provedor.');
    return data;
  },

  async createOptmaSandboxIntent(input: {
    storeId: string;
    amount: number;
    methodCode: string;
    scenario: 'pending' | 'approved' | 'declined' | 'expired';
  }) {
    const { data, error } = await supabase.rpc('create_optma_sandbox_payment_intent_safe', {
      p_store_id: input.storeId,
      p_order_id: null,
      p_method_code: input.methodCode,
      p_amount: input.amount,
      p_scenario: input.scenario,
      p_metadata: { source: 'admin_online_payments_lab' },
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) throw new Error(result?.error || 'Não foi possível criar a transação de teste.');
    return data;
  },

  async simulateOptmaSandbox(storeId: string, intentId: string, action: 'approve' | 'decline' | 'expire' | 'cancel' | 'refund') {
    const { data, error } = await supabase.rpc('simulate_optma_sandbox_payment_safe', {
      p_store_id: storeId,
      p_intent_id: intentId,
      p_action: action,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) throw new Error(result?.error || 'Não foi possível simular o evento.');
    return data;
  },

  async listSettlementAccounts(storeId: string): Promise<OnlinePaymentSettlementAccount[]> {
    const { data, error } = await supabase.rpc('list_store_financial_accounts_safe', {
      p_store_id: storeId,
      p_include_inactive: false,
    });
    if (error) throw error;
    const result = data as { ok?: boolean; error?: string; items?: unknown } | null;
    if (!result?.ok) throw new Error(result?.error || 'Não foi possível carregar as contas financeiras.');
    return Array.isArray(result.items) ? result.items as OnlinePaymentSettlementAccount[] : [];
  },

  async getAsaasSandboxStatus(storeId: string): Promise<AsaasSandboxStatus> {
    const { data, error } = await supabase.functions.invoke('asaas-sandbox-adapter', {
      body: { action: 'status', storeId },
    });
    if (error) throw error;
    return data as AsaasSandboxStatus;
  },
};
