export interface PriceRule {
    min: number;
    price: number;
}

export interface Category {
    id: string;
    name: string;
    description?: string;
    image_url?: string;
    slug?: string; // Made optional as it might not be in the immediate fetch or DB schema explicitly yet
    sort_order: number;
    price_logic_type?: 'standard' | 'category_volume';
    price_rules?: PriceRule[];
    active?: boolean;
}

export interface Product {
    id: string;
    // Can be null/undefined when product is not linked to a category
    category_id?: string | null;
    name: string;
    description?: string;
    price: number;
    /** If true, price should be derived from the category pricing rules (when available). */
    use_category_pricing?: boolean;
    images: string[];
    image_url?: string; // Optional fallback
    video_url?: string;
    allergens?: string[]; // 'LEITE', 'AMENDOIM', etc.
    featured: boolean;
    sales_count: number;
    stock_quantity: number;
    rating_avg: number;
    review_count: number;
    active?: boolean;
}

export interface CartItem extends Product {
    quantity: number;
    originalPrice: number; // To store base price before discounts
}

export type PaymentMethod = 'pix' | 'cash' | 'card' | 'pending';
export type OrderStatus = 'reserved' | 'confirmed' | 'ready' | 'completed' | 'cancelled';

export interface Profile {
    id: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
    is_admin: boolean;
    created_at: string;
}

export interface Customer {
    id: string;
    store_id: string;
    phone: string;
    full_name: string | null;
    nickname: string | null;
    cpf?: string;
    email?: string;
    birth_date?: string;
    loyalty_points: number;
    loyalty_tier: 'Bronze' | 'Prata' | 'Ouro';
    is_whatsapp: boolean;
    marketing_consent: boolean;
    loyalty_opt_in: boolean;
    email_verified?: boolean;
}

export interface StoreConfig {
    timer_duration_minutes?: number;
    extension_minutes?: number;
    ready_hold_minutes?: number;
    expiration_grace_minutes?: number;
    payment_timing?: {
        pay_now_enabled?: boolean;
        pay_on_pickup_enabled?: boolean;
    };
    visual_title?: string;
    visual_icon_url?: string;
    visual_color_primary?: string;
    visual_color_secondary?: string;
    visual_color_text?: string;
    visual_color_highlight?: string;
    visual_banner_url?: string;
    loyalty_active?: boolean;

    // Header
    visual_slogan?: string;

    // Institutional (About Us)
    about_text?: string;
    about_image_url?: string;

    // Contact & Footer
    contact_phone?: string;
    contact_email?: string;
    contact_whatsapp_support?: string;
    contact_address?: string;
    contact_map_link?: string;
    contact_coords?: { lat: number; lng: number };

    social_links?: {
        instagram?: string;
        facebook?: string;
        tiktok?: string;
        twitter?: string;
        website?: string;
        google_reviews?: string;
    };

    footer_text?: string;
    footer_show_contact?: boolean;

    banners?: Array<{ url: string; type: 'image' | 'video'; link?: string }>;
    custom_domain?: string;

    // Operations
    opening_time?: string;
    closing_time?: string;
    custom_consent_text?: string;
    pre_opening_minutes?: number;
    closing_buffer_minutes?: number;
    tolerance_minutes?: number;
    pre_order_minutes?: number;
    join_bonus_points?: number;
}

export interface Address {
    id?: string;
    customer_id?: string;
    street: string;
    number: string;
    district: string;
    city: string;
    state: string;
    zip_code: string;
    complement?: string;
    label?: string;
    is_default: boolean;
}

// Domain module re-exports
export * from '@/types/order';
export * from '@/types/store';
export * from '@/types/loyalty';
export * from '@/types/admin';
export * from '@/types/security';
export * from '@/types/permissions';
export * from '@/types/userMemberDetails';
export * from '@/types/storeMemberInvites';
export * from '@/types/myStoreInvites';