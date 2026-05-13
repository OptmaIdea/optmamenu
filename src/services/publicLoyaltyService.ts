import { supabaseCustomer } from '@/lib/supabase';

export interface PublicLoyaltyTransaction {
    id: string;
    type: string;
    points: number;
    description?: string | null;
    order_id?: string | null;
    created_at: string;
}

export interface PublicLoyaltyTier {
    id: string;
    name: string;
    min_points: number;
    multiplier?: number | null;
    color?: string | null;
    position?: number | null;
    points_to_next_tier?: number;
}

export interface PublicLoyaltyResponse {
    ok: boolean;
    found?: boolean;
    error?: string;
    message?: string;
    loyalty?: {
        customer: {
            id: string;
            name?: string | null;
            phone_last4?: string | null;
            loyalty_opt_in: boolean;
            last_point_activity_at?: string | null;
        };
        program?: {
            id?: string | null;
            name?: string | null;
            is_active: boolean;
            points_per_currency: number;
            min_points_redemption: number;
            points_validity_months: number;
        };
        points: number;
        current_tier?: PublicLoyaltyTier | null;
        next_tier?: PublicLoyaltyTier | null;
        recent_transactions: PublicLoyaltyTransaction[];
    } | null;
}

export const PublicLoyaltyService = {
    async getByPhone(slug: string, phone: string): Promise<PublicLoyaltyResponse> {
        const { data, error } = await supabaseCustomer.rpc(
            'get_public_customer_loyalty_by_phone',
            {
                p_slug: slug,
                p_phone: phone,
            }
        );

        if (error) {
            console.error('get_public_customer_loyalty_by_phone error:', error);
            throw error;
        }

        return data as PublicLoyaltyResponse;
    },
};