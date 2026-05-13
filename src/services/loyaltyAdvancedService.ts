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
    program_terms?: string | null;
    voucher_terms?: string | null;
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

export interface LoyaltyAdvancedSettings {
    program: LoyaltyProgramAdvanced | null;
    tiers: LoyaltyTierAdvanced[];
    point_rules: LoyaltyPointRule[];
    benefit_rules: CustomerBenefitRule[];
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

export const LoyaltyAdvancedService = {
    async getSettings(storeId: string): Promise<LoyaltyAdvancedSettings> {
        const { data, error } = await supabase.rpc('get_loyalty_advanced_settings_safe', {
            p_store_id: storeId,
        });

        if (error) throw error;

        if (!data?.ok) {
            throw new Error(data?.error || 'Erro ao carregar fidelidade avançada.');
        }

        return {
            program: data.program || null,
            tiers: data.tiers || [],
            point_rules: data.point_rules || [],
            benefit_rules: data.benefit_rules || [],
        };
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

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            rule_id?: string;
            code?: string;
        };
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

        return data as {
            ok: boolean;
            error?: string;
            message?: string;
            benefit_rule_id?: string;
            code?: string;
        };
    },
};
