export interface ProductStock {
    id: string;
    name: string;
    price: number;
    image_url: string;
    physical_stock: number;
    reserved_stock: number;
    available_stock: number;
}

export interface SecurityLog {
    id: string;
    created_at: string;
    action: string;
    user_email: string;
    user_name?: string | null;
    details: Record<string, unknown>;
    outcome: 'success' | 'failure';
}

export interface FAQItem {
    question: string;
    answer: string;
    category: string;
}

// ============================================
// USUÁRIOS DO SISTEMA (Admin/Staff)
// ============================================

export type UserRole =
    | 'owner'
    | 'super_admin'
    | 'admin'
    | 'manager'
    | 'stock_operator'
    | 'cashier'
    | 'sales'
    | 'staff'
    | 'viewer';

export type UserStatus =
    | 'active'
    | 'inactive'
    | 'suspended'
    | 'invited'
    | 'pending';

export interface UserAdmin {
    id: string;
    email: string | null;
    phone: string | null;
    full_name: string | null;
    cpf: string | null;
    avatar_url: string | null;
    role: UserRole;
    status: UserStatus;
    is_admin: boolean;
    is_active: boolean;
    email_verified: boolean;
    last_sign_in_at: string | null;
    created_at: string;
    updated_at: string;
    internal_notes?: string | null;
    stores?: StoreUser[];
    last_seen_at?: string | null;
    last_session_action?: string | null;
    last_session_at?: string | null;
    last_session_details?: Record<string, unknown> | null;
}

export interface StoreUser {
    id: string;
    store_id: string;
    user_id: string;
    store_name: string;
    store_slug: string;
    role: UserRole;
    created_at: string;
    config?: Record<string, unknown>;
}

export interface UserFilters {
    search?: string;
    role?: UserRole;
    status?: UserStatus;
    store_id?: string;
    page?: number;
    limit?: number;
    sort_by?: 'created_at' | 'last_sign_in_at' | 'full_name' | 'email';
    sort_order?: 'asc' | 'desc';
}

export interface UserFormData {
    email: string;
    password?: string;
    full_name: string;
    phone?: string;
    cpf?: string;
    role: UserRole;
    is_admin: boolean;
    internal_notes?: string;
    store_id?: string;
}

export interface UserStats {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    pending: number;
}
