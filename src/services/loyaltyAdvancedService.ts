import { supabase } from '@/lib/supabase';

export interface LoyaltyProgramAdvanced {
    id: string;
    store_id: string;
    name: string;
    is_active: boolean;
    points_per_currency: number;
    min_order_value: number;
    enable_join_bonus?: boolean | null;
    join_bonus_points?: number | null;
    enable_birthday_bonus?: boolean | null;
    birthday_bonus_points?: number | null;
    enable_cashback?: boolean | null;
    points_validity_months?: number | null;
    min_points_redemption?: number | null;
    enable_stamps?: boolean | null;
    min_order_for_stamp?: number | null;
    stamps_target?: number | null;
    points_per_stamp_block?: number | null;
    warn_voucher_expiry_1?: number | null;
    warn_voucher_expiry_2?: number | null;
    warn_voucher_expiry_3?: number | null;
    program_terms?: string | null;
    voucher_terms?: string | null;
    reentry_bonus_mode?: 'none' | 'percentage' | 'fixed' | null;
    reentry_bonus_percentage?: number | null;
    reentry_bonus_fixed_points?: number | null;
    reentry_bonus_cooldown_days?: number | null;
    reentry_bonus_max_awards?: number | null;
    loyalty_audit_retention_months?: number | null;
    updated_at?: string | null;
}

export interface LoyaltyTierAdvanced {
    id: string;
    store_id: string;
    name: string;
    min_points: number;
    multiplier: number;
    color: string;
    position: number;
}

export interface LoyaltyPointRule {
    id: string;
    store_id: string;
    code: string;
    name: string;
    description?: string | null;
    trigger_event: string;
    rule_type: string;
    points_mode: string;
    points_value: number;
    priority: number;
    stackable: boolean;
    active: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    conditions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface CustomerBenefitRule {
    id: string;
    store_id: string;
    code: string;
    name: string;
    description?: string | null;
    benefit_type: string;
    target_type: string;
    target_tier_id?: string | null;
    target_tier_name?: string | null;
    target_customer_id?: string | null;
    target_customer_name?: string | null;
    target_customer_phone?: string | null;
    target_tag?: string | null;
    discount_percent?: number | null;
    discount_amount?: number | null;
    bonus_points?: number | null;
    free_delivery: boolean;
    minimum_order_value: number;
    max_uses_total?: number | null;
    max_uses_per_customer?: number | null;
    active: boolean;
    starts_at?: string | null;
    ends_at?: string | null;
    conditions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface LoyaltyReward {
    id: string;
    program_id: string;
    title: string;
    description?: string | null;
    points_cost: number;
    type: string;
    discount_amount?: number | null;
    max_redemptions_per_customer?: number | null;
    is_active: boolean;
    stock_quantity?: number | null;
    voucher_validity_days?: number | null;
    image_url?: string | null;
    additional_cash_cost?: number | null;
    offer_valid_until?: string | null;
    product_id?: string | null;
    product_quantity?: number | null;
    discount_percentage?: number | null;
    max_discount_value?: number | null;
    min_order_value?: number | null;
}

export interface LoyaltyCategoryRule {
    id: string;
    name: string;
    loyalty_eligible: boolean;
    loyalty_multiplier: number;
}

export interface LoyaltyOverview {
    participants: number;
    points_in_circulation: number;
    active_blocks: number;
    transactions_30d: number;
}

export interface LoyaltyCustomer {
    id: string;
    full_name?: string | null;
    nickname?: string | null;
    phone?: string | null;
    phone_e164?: string | null;
    status: string;
    loyalty_opt_in: boolean;
    loyalty_points: number;
    loyalty_tier?: string | null;
    current_tier_id?: string | null;
    last_point_activity_at?: string | null;
    total_orders?: number | null;
    total_spent?: number | null;
    source?: string | null;
    person_type?: string | null;
    email_verified?: boolean | null;
    cpf_last4?: string | null;
    first_joined_at?: string | null;
    last_joined_at?: string | null;
    join_count?: number | null;
}

export interface LoyaltyAdminTransaction {
    id: string;
    customer_id: string;
    customer_name?: string | null;
    customer_nickname?: string | null;
    customer_phone?: string | null;
    type: string;
    points: number;
    description?: string | null;
    order_id?: string | null;
    order_code?: string | null;
    related_transaction_id?: string | null;
    reward_id?: string | null;
    created_by?: string | null;
    created_at: string;
}

export interface LoyaltyMembershipBlock {
    id: string;
    customer_id?: string | null;
    customer_name?: string | null;
    cpf_last4?: string | null;
    reason?: string | null;
    blocked_at: string;
    unblocked_at?: string | null;
}

export interface LoyaltyMembershipAuditEvent {
    id: string;
    customer_id?: string | null;
    customer_name?: string | null;
    cpf_last4?: string | null;
    event_type: string;
    join_sequence?: number | null;
    bonus_points: number;
    applied_rule?: Record<string, unknown> | null;
    reason?: string | null;
    source?: string | null;
    occurred_at: string;
    retention_until: string;
}

export interface LoyaltyAdvancedSettings {
    program: LoyaltyProgramAdvanced | null;
    tiers: LoyaltyTierAdvanced[];
    point_rules: LoyaltyPointRule[];
    benefit_rules: CustomerBenefitRule[];
    rewards: LoyaltyReward[];
    category_rules: LoyaltyCategoryRule[];
    overview: LoyaltyOverview;
}

export interface UpsertLoyaltyPointRuleInput {
    storeId: string;
    ruleId?: string | null;
    code?: string | null;
    name: string;
    description?: string | null;
    triggerEvent: string;
    ruleType: string;
    pointsMode: string;
    pointsValue: number;
    priority: number;
    stackable: boolean;
    active: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    conditions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface UpsertCustomerBenefitRuleInput {
    storeId: string;
    ruleId?: string | null;
    code?: string | null;
    name: string;
    description?: string | null;
    benefitType: string;
    targetType: string;
    targetTierId?: string | null;
    targetCustomerId?: string | null;
    targetTag?: string | null;
    discountPercent?: number | null;
    discountAmount?: number | null;
    bonusPoints?: number | null;
    freeDelivery: boolean;
    minimumOrderValue: number;
    maxUsesTotal?: number | null;
    maxUsesPerCustomer?: number | null;
    active: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    conditions?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

type RpcResult = {
    ok: boolean;
    error?: string;
    message?: string;
    [key: string]: unknown;
};

function assertOk(data: RpcResult | null, fallback: string): RpcResult {
    if (!data?.ok) {
        throw new Error(data?.message || data?.error || fallback);
    }
    return data;
}

export const LoyaltyAdvancedService = {
    async getSettings(storeId: string): Promise<LoyaltyAdvancedSettings> {
        const { data, error } = await supabase.rpc('get_loyalty_advanced_settings_safe', {
            p_store_id: storeId,
        });

        if (error) throw error;
        const result = assertOk(data as RpcResult, 'Erro ao carregar fidelidade.');

        return {
            program: (result.program as LoyaltyProgramAdvanced | null) || null,
            tiers: (result.tiers as LoyaltyTierAdvanced[]) || [],
            point_rules: (result.point_rules as LoyaltyPointRule[]) || [],
            benefit_rules: (result.benefit_rules as CustomerBenefitRule[]) || [],
            rewards: (result.rewards as LoyaltyReward[]) || [],
            category_rules: (result.category_rules as LoyaltyCategoryRule[]) || [],
            overview: (result.overview as LoyaltyOverview) || {
                participants: 0,
                points_in_circulation: 0,
                active_blocks: 0,
                transactions_30d: 0,
            },
        };
    },

    async updateProgram(storeId: string, patch: Partial<LoyaltyProgramAdvanced>) {
        const { data, error } = await supabase.rpc('update_loyalty_program_safe', {
            p_store_id: storeId,
            p_patch: patch,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível atualizar o programa.');
    },

    async upsertPointRule(input: UpsertLoyaltyPointRuleInput) {
        const { data, error } = await supabase.rpc('upsert_loyalty_point_rule_safe', {
            p_store_id: input.storeId,
            p_rule_id: input.ruleId || null,
            p_code: input.code || null,
            p_name: input.name,
            p_description: input.description || null,
            p_trigger_event: input.triggerEvent,
            p_rule_type: input.ruleType,
            p_points_mode: input.pointsMode,
            p_points_value: input.pointsValue,
            p_priority: input.priority,
            p_stackable: input.stackable,
            p_active: input.active,
            p_starts_at: input.startsAt || null,
            p_ends_at: input.endsAt || null,
            p_conditions: input.conditions || {},
            p_metadata: input.metadata || {},
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível salvar a regra.');
    },

    async upsertBenefitRule(input: UpsertCustomerBenefitRuleInput) {
        const { data, error } = await supabase.rpc('upsert_customer_benefit_rule_safe', {
            p_store_id: input.storeId,
            p_rule_id: input.ruleId || null,
            p_code: input.code || null,
            p_name: input.name,
            p_description: input.description || null,
            p_benefit_type: input.benefitType,
            p_target_type: input.targetType,
            p_target_tier_id: input.targetTierId || null,
            p_target_customer_id: input.targetCustomerId || null,
            p_target_tag: input.targetTag || null,
            p_discount_percent: input.discountPercent ?? null,
            p_discount_amount: input.discountAmount ?? null,
            p_bonus_points: input.bonusPoints ?? null,
            p_free_delivery: input.freeDelivery,
            p_minimum_order_value: input.minimumOrderValue,
            p_max_uses_total: input.maxUsesTotal ?? null,
            p_max_uses_per_customer: input.maxUsesPerCustomer ?? null,
            p_active: input.active,
            p_starts_at: input.startsAt || null,
            p_ends_at: input.endsAt || null,
            p_conditions: input.conditions || {},
            p_metadata: input.metadata || {},
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível salvar o benefício.');
    },

    async upsertTier(input: {
        storeId: string;
        tierId?: string | null;
        name: string;
        minPoints: number;
        multiplier: number;
        color: string;
        position: number;
    }) {
        const { data, error } = await supabase.rpc('upsert_loyalty_tier_safe', {
            p_store_id: input.storeId,
            p_tier_id: input.tierId || null,
            p_name: input.name,
            p_min_points: input.minPoints,
            p_multiplier: input.multiplier,
            p_color: input.color,
            p_position: input.position,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível salvar o nível.');
    },

    async deleteTier(storeId: string, tierId: string) {
        const { data, error } = await supabase.rpc('delete_loyalty_tier_safe', {
            p_store_id: storeId,
            p_tier_id: tierId,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível excluir o nível.');
    },

    async updateCategoryRule(storeId: string, categoryId: string, eligible: boolean, multiplier: number) {
        const { data, error } = await supabase.rpc('update_loyalty_category_rule_safe', {
            p_store_id: storeId,
            p_category_id: categoryId,
            p_eligible: eligible,
            p_multiplier: multiplier,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível atualizar a categoria.');
    },

    async getCustomers(storeId: string, search = '', limit = 100): Promise<LoyaltyCustomer[]> {
        const { data, error } = await supabase.rpc('get_loyalty_customers_safe', {
            p_store_id: storeId,
            p_search: search || null,
            p_limit: limit,
        });
        if (error) throw error;
        const result = assertOk(data as RpcResult, 'Não foi possível carregar participantes.');
        return (result.customers as LoyaltyCustomer[]) || [];
    },

    async getTransactions(storeId: string, customerId?: string | null, limit = 200): Promise<LoyaltyAdminTransaction[]> {
        const { data, error } = await supabase.rpc('get_admin_loyalty_transactions_safe', {
            p_store_id: storeId,
            p_customer_id: customerId || null,
            p_limit: limit,
        });
        if (error) throw error;
        const result = assertOk(data as RpcResult, 'Não foi possível carregar o extrato.');
        return (result.transactions as LoyaltyAdminTransaction[]) || [];
    },

    async adjustPoints(storeId: string, customerId: string, pointsDelta: number, reason: string) {
        const { data, error } = await supabase.rpc('adjust_customer_loyalty_points_safe', {
            p_store_id: storeId,
            p_customer_id: customerId,
            p_points_delta: pointsDelta,
            p_reason: reason,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível ajustar os pontos.');
    },

    async getBlocksAndReentry(storeId: string, limit = 200): Promise<{
        blocks: LoyaltyMembershipBlock[];
        events: LoyaltyMembershipAuditEvent[];
        reentry_policy: Partial<LoyaltyProgramAdvanced>;
        audit_purpose: string;
    }> {
        const { data, error } = await supabase.rpc('get_loyalty_blocks_and_reentry_safe', {
            p_store_id: storeId,
            p_limit: limit,
        });
        if (error) throw error;
        const result = assertOk(data as RpcResult, 'Não foi possível carregar bloqueios e reentrada.');
        return {
            blocks: (result.blocks as LoyaltyMembershipBlock[]) || [],
            events: (result.events as LoyaltyMembershipAuditEvent[]) || [],
            reentry_policy: (result.reentry_policy as Partial<LoyaltyProgramAdvanced>) || {},
            audit_purpose: String(result.audit_purpose || ''),
        };
    },

    async setMembershipAction(
        storeId: string,
        customerId: string,
        action: 'remove' | 'ban' | 'unban',
        reason?: string | null,
    ) {
        const { data, error } = await supabase.rpc('admin_set_customer_loyalty_membership_safe', {
            p_store_id: storeId,
            p_customer_id: customerId,
            p_action: action,
            p_reason: reason || null,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível atualizar a participação.');
    },

    async upsertReward(storeId: string, rewardId: string | null, payload: Record<string, unknown>) {
        const { data, error } = await supabase.rpc('upsert_loyalty_reward_safe', {
            p_store_id: storeId,
            p_reward_id: rewardId,
            p_payload: payload,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível salvar o prêmio.');
    },

    async deleteReward(storeId: string, rewardId: string) {
        const { data, error } = await supabase.rpc('delete_loyalty_reward_safe', {
            p_store_id: storeId,
            p_reward_id: rewardId,
        });
        if (error) throw error;
        return assertOk(data as RpcResult, 'Não foi possível excluir o prêmio.');
    },
};
