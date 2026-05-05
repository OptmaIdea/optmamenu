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
};