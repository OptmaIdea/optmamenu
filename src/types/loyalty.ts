export interface FidelityProgram {
    id: string;
    name: string;
    is_active: boolean;
    points_per_currency: number;
    min_order_value: number;

    enable_join_bonus: boolean;
    join_bonus_points: number;

    enable_birthday_bonus: boolean;
    birthday_bonus_points: number;

    enable_cashback: boolean;

    // Stamps System
    enable_stamps: boolean;
    min_order_for_stamp: number;
    stamps_target: number;
    points_per_stamp_block: number;

    points_validity_months: number;
    min_points_redemption: number;

    // Notification Settings
    warn_voucher_expiry_1: number;
    warn_voucher_expiry_2: number;
    warn_voucher_expiry_3: number;
}

export interface LoyaltyTransaction {
    id: string;
    type: 'earn' | 'redeem' | 'bonus' | 'adjustment';
    points: number;
    description: string;
    created_at: string;
}

export interface Reward {
    id: string;
    title: string;
    description: string;
    points_cost: number;
    image_url?: string;
    additional_cash_cost?: number;
    voucher_validity_days: number;
    type: string;
    stock_quantity: number | null;
    max_redemptions_per_customer: number | null;
    offer_valid_until: string | null;
}

export interface Voucher {
    id: string;
    code: string;
    status: 'active' | 'used' | 'expired';
    expires_at: string;
    reward: {
        title: string;
        description: string;
        image_url?: string;
    };
    created_at: string;
    reward_id: string;
}
