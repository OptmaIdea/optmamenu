// src/types/security.ts

export type StoreMemberRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'stock_operator'
  | 'cashier'
  | 'sales'
  | 'viewer'
  | 'staff';

export type StoreMemberStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'invited';

export interface SecurityProfile {
  id?: string;
  name?: string | null;
  phone?: string | null;
  cpf?: string | null;
  city?: string | null;
  is_admin?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StoreMembershipContext {
  member_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  store_logo_url: string | null;
  role: StoreMemberRole;
  status: StoreMemberStatus;
  permissions: Record<string, unknown>;
  sensitive_actions: Record<string, unknown>;
  is_owner: boolean;
  is_primary_owner: boolean;
  created_at: string;
  updated_at: string;
}

export interface CurrentUserSecurityContext {
  authenticated: boolean;
  user_id: string | null;
  email: string | null;
  profile: SecurityProfile | null;
  memberships: StoreMembershipContext[];
  primary_membership: StoreMembershipContext | null;
  has_pin: boolean;
  is_global_admin: boolean;
}

export interface StoreMemberAdmin {
  member_id: string;
  store_id: string;
  user_id: string;
  user_email: string | null;
  profile_name: string | null;
  profile_phone: string | null;
  role: StoreMemberRole;
  status: StoreMemberStatus;
  permissions: Record<string, unknown>;
  sensitive_actions: Record<string, unknown>;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}