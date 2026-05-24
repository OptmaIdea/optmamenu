// src/types/security.ts
import type { PermissionRiskLevel } from './permissions';

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

export type StoreRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'stock_operator'
  | 'cashier'
  | 'sales'
  | 'staff'
  | 'viewer';


export type SensitiveRequirement =
  | 'none'
  | 'pin'
  | 'master_password'
  | 'pin_or_master'
  | 'owner_approval'
  | 'token'
  | 'pin_and_token';

export type StorePermissionMatrixRow = {
  permission_code: string;
  module: string;
  action: string;
  label: string;
  description: string | null;
  risk_level: PermissionRiskLevel;
  active: boolean;
  sort_order: number | null;
  owner_allowed: boolean;
  admin_allowed: boolean;
  manager_allowed: boolean;
  stock_operator_allowed: boolean;
  cashier_allowed: boolean;
  sales_allowed: boolean;
  staff_allowed: boolean;
  viewer_allowed: boolean;
};

export type StoreMemberPermissionDetailRow = {
  member_id: string;
  store_id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  role: StoreRole | string;
  status: string;
  permission_code: string;
  module: string;
  action: string;
  label: string;
  description: string | null;
  risk_level: PermissionRiskLevel;
  role_allowed: boolean;
  override_value: boolean | null;
  effective_allowed: boolean;
  source: string;
};

export type StoreSensitiveActionMatrixRow = {
  action_code: string;
  module: string;
  label: string;
  description: string | null;
  risk_level: PermissionRiskLevel;
  active: boolean;
  enabled: boolean;
  requirement: SensitiveRequirement;
  min_role: StoreRole | string;
  token_enabled: boolean;
  token_expiry_seconds: number;
  max_attempts: number;
  require_reason: boolean;
  source: string;
  sort_order: number | null;
};