import { supabase } from '@/lib/supabase';

export type CustomerSource =
    | 'admin'
    | 'public_store'
    | 'whatsapp'
    | 'qr_table'
    | 'direct_sale'
    | 'import'
    | 'other';

export type CustomerDataOwnership = 'store_managed' | 'customer_owned' | 'mixed';

export interface CustomerListItem {
    id: string;
    store_id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
    cpf?: string | null;
    birth_date?: string | null;
    status: 'active' | 'inactive' | 'deleted_requested' | string;
    source: CustomerSource;
    data_ownership: CustomerDataOwnership;
    editable_by_store: boolean;
    is_whatsapp: boolean | null;
    contact_preference: string | null;
    marketing_consent: boolean | null;
    loyalty_opt_in: boolean | null;
    loyalty_points: number | null;
    loyalty_tier: string | null;
    current_tier_id: string | null;
    current_tier_name: string | null;
    tags: string[] | null;
    internal_notes: string | null;
    created_at: string;
    last_login: string | null;
    last_point_activity_at: string | null;
    last_order_at: string | null;
    total_orders: number;
    total_spent: number;
    sensitive_data_visible?: boolean;
}

export interface Customer360Order {
    id: string;
    order_code: string | null;
    status: string;
    total: number;
    sales_channel?: string | null;
    fulfillment_type?: string | null;
    payment_method_code?: string | null;
    delivery_method_code?: string | null;
    created_at: string;
    confirmed_at?: string | null;
    completed_at?: string | null;
}

export interface Customer360LoyaltyTransaction {
    id: string;
    type: string;
    points: number;
    description: string | null;
    order_id: string | null;
    created_at: string;
}

export interface Customer360Address {
    id: string;
    customer_id: string;
    zip_code: string;
    street: string;
    number: string;
    complement?: string | null;
    district: string;
    city: string;
    state: string;
    is_default: boolean;
    created_at: string;
}

export interface Customer360Consent {
    id: string;
    customer_id: string;
    consent_type: string;
    action: string;
    ip_address?: string | null;
    user_agent?: string | null;
    terms_version?: string | null;
    privacy_version?: string | null;
    source?: string | null;
    revoked_at?: string | null;
    created_at: string;
}

export type CustomerTimelineCategory =
    | 'profile'
    | 'order'
    | 'loyalty'
    | 'consent'
    | 'address'
    | 'merge'
    | 'communication'
    | string;

export interface CustomerTimelineEvent {
    id: string;
    category: CustomerTimelineCategory;
    event_type: string;
    title: string;
    description: string | null;
    occurred_at: string;
    source: string | null;
    related_id: string | null;
    metadata: Record<string, unknown>;
}

export interface CustomerTimelineResult {
    events: CustomerTimelineEvent[];
    sensitiveDataVisible: boolean;
    identityLinkPolicy: 'confirmed_customer_id_only' | string;
}

export interface Customer360 {
    customer: CustomerListItem & {
        current_tier_color?: string | null;
        current_tier_min_points?: number | null;
        customer_metadata?: Record<string, unknown> | null;
    };
    orders: Customer360Order[];
    loyalty_transactions: Customer360LoyaltyTransaction[];
    addresses: Customer360Address[];
    consents: Customer360Consent[];
    sensitive_data_visible?: boolean;
}

export interface CreateAdminCustomerInput {
    storeId: string;
    fullName: string;
    phone: string;
    email?: string | null;
    cpf?: string | null;
    birthDate?: string | null;
    tags?: string[];
    internalNotes?: string | null;
    marketingConsent?: boolean;
    loyaltyOptIn?: boolean;
}

export interface UpdateAdminCustomerInput extends CreateAdminCustomerInput {
    customerId: string;
    status: string;
}

export interface CustomerDuplicateSummary {
    id: string;
    full_name: string | null;
    phone: string;
    email: string | null;
    birth_date?: string | null;
    status: string;
    source: CustomerSource | string;
    data_ownership: CustomerDataOwnership;
    total_orders: number;
    total_spent: number;
    has_credentials: boolean;
    phone_verified: boolean;
}

export interface CustomerDuplicateCandidate {
    score: number;
    match_reasons: Array<'phone' | 'cpf' | 'email' | 'name_birth_date' | string>;
    suggested_canonical_id: string;
    customer_a: CustomerDuplicateSummary;
    customer_b: CustomerDuplicateSummary;
}

export interface CustomerMergeHistoryItem {
    id: string;
    canonical_customer_id: string;
    duplicate_customer_id: string;
    actor_user_id: string | null;
    reason: string;
    match_basis: string[];
    moved_counts: Record<string, number>;
    created_at: string;
}

export interface CustomerDeletionAuditItem {
    id: string;
    customer_id_snapshot: string;
    status: 'pending' | 'processing' | 'executed' | 'failed' | string;
    request_source: string | null;
    reauth_method: string | null;
    requested_at: string;
    executed_at: string | null;
    execution_summary: Record<string, unknown>;
}

export const Customers360Service = {
    async listCustomers(storeId: string, limit = 500): Promise<CustomerListItem[]> {
        const { data, error } = await supabase.rpc('get_admin_customers_safe', {
            p_store_id: storeId,
            p_limit: limit,
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Erro ao carregar clientes.');

        return ((data.customers || []) as CustomerListItem[]).filter(
            (customer) => !['merged', 'anonymized'].includes(customer.status),
        );
    },

    async getCustomer360(storeId: string, customerId: string): Promise<Customer360> {
        const { data, error } = await supabase.rpc('get_customer_360_safe', {
            p_store_id: storeId,
            p_customer_id: customerId,
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Erro ao carregar Vida do Cliente.');

        return {
            customer: data.customer,
            orders: data.orders || [],
            loyalty_transactions: data.loyalty_transactions || [],
            addresses: data.addresses || [],
            consents: data.consents || [],
            sensitive_data_visible: Boolean(data.sensitive_data_visible),
        } as Customer360;
    },

    async getCustomerTimeline(storeId: string, customerId: string, limit = 150): Promise<CustomerTimelineResult> {
        const { data, error } = await supabase.rpc('get_customer_timeline_safe', {
            p_store_id: storeId,
            p_customer_id: customerId,
            p_limit: limit,
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Erro ao carregar histórico consolidado do cliente.');

        return {
            events: (data.events || []) as CustomerTimelineEvent[],
            sensitiveDataVisible: Boolean(data.sensitive_data_visible),
            identityLinkPolicy: data.identity_link_policy || 'confirmed_customer_id_only',
        };
    },

    async createAdminCustomer(input: CreateAdminCustomerInput) {
        const { data, error } = await supabase.rpc('create_admin_customer_safe', {
            p_store_id: input.storeId,
            p_full_name: input.fullName,
            p_phone: input.phone,
            p_email: input.email || null,
            p_cpf: input.cpf || null,
            p_birth_date: input.birthDate || null,
            p_tags: input.tags || [],
            p_internal_notes: input.internalNotes || null,
            p_marketing_consent: input.marketingConsent ?? false,
            p_loyalty_opt_in: input.loyaltyOptIn ?? false,
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            customer_id?: string;
        };
    },

    async updateAdminCustomer(input: UpdateAdminCustomerInput) {
        const { data, error } = await supabase.rpc('update_admin_customer_safe', {
            p_store_id: input.storeId,
            p_customer_id: input.customerId,
            p_full_name: input.fullName,
            p_phone: input.phone,
            p_email: input.email || null,
            p_cpf: input.cpf || null,
            p_birth_date: input.birthDate || null,
            p_status: input.status || 'active',
            p_tags: input.tags || [],
            p_internal_notes: input.internalNotes || null,
            p_marketing_consent: input.marketingConsent ?? false,
            p_loyalty_opt_in: input.loyaltyOptIn ?? false,
        });

        if (error) throw error;

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            customer_id?: string;
            protected_data?: boolean;
        };
    },

    async listDuplicateCandidates(storeId: string, customerId?: string | null, limit = 100) {
        const { data, error } = await supabase.rpc('get_customer_duplicate_candidates_safe', {
            p_store_id: storeId,
            p_customer_id: customerId || null,
            p_limit: limit,
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message || data?.error || 'Erro ao analisar possíveis duplicidades.');

        return {
            candidates: (data.candidates || []) as CustomerDuplicateCandidate[],
            sensitiveDataVisible: Boolean(data.sensitive_data_visible),
        };
    },

    async mergeCustomers(input: {
        storeId: string;
        canonicalCustomerId: string;
        duplicateCustomerId: string;
        reason: string;
    }) {
        const { data, error } = await supabase.rpc('merge_customers_safe', {
            p_store_id: input.storeId,
            p_canonical_customer_id: input.canonicalCustomerId,
            p_duplicate_customer_id: input.duplicateCustomerId,
            p_reason: input.reason,
        });

        if (error) throw error;
        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            merge_id?: string;
            canonical_customer_id?: string;
            duplicate_customer_id?: string;
            match_basis?: string[];
            moved_counts?: Record<string, number>;
        };
    },

    async getMergeHistory(storeId: string, customerId?: string | null, limit = 100) {
        const { data, error } = await supabase.rpc('get_customer_merge_history_safe', {
            p_store_id: storeId,
            p_customer_id: customerId || null,
            p_limit: limit,
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Erro ao carregar histórico de fusões.');

        return (data.events || []) as CustomerMergeHistoryItem[];
    },

    async getDeletionHistory(storeId: string, customerId?: string | null, limit = 100) {
        const { data, error } = await supabase.rpc('get_customer_account_deletion_history_safe', {
            p_store_id: storeId,
            p_customer_id: customerId || null,
            p_limit: limit,
        });

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Erro ao carregar histórico de exclusões.');

        return (data.events || []) as CustomerDeletionAuditItem[];
    },
};
