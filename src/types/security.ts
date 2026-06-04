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
  internal_alias?: string | null;
  phone?: string | null;
  cpf?: string | null;
  city?: string | null;
  is_admin?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
  profile_avatar_url?: string | null;
  avatar_url?: string | null;
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
  custom_role_id?: string | null;
  custom_role_name?: string | null;
  custom_role_base_role?: StoreRole | string | null;
  custom_role_permissions?: Record<string, boolean>;
  custom_role_sensitive_actions?: Record<string, unknown>;
  access_blocked?: boolean | null;
  access_message?: string | null;
  profile_avatar_url?: string | null;
  avatar_url?: string | null;
  internal_alias?: string | null;
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
  custom_role_id?: string | null;
  custom_role_name?: string | null;
  custom_role_base_role?: StoreRole | string | null;
  custom_role_active?: boolean | null;

  profile_mobile_phone?: string | null;
  profile_whatsapp_phone?: string | null;
  profile_cpf?: string | null;
  profile_birthdate?: string | null;

  profile_zip_code?: string | null;
  profile_address?: string | null;
  profile_address_number?: string | null;
  profile_complement?: string | null;
  profile_district?: string | null;
  profile_city?: string | null;
  profile_state?: string | null;

  profile_instagram_url?: string | null;
  profile_facebook_url?: string | null;
  profile_website_url?: string | null;

  internal_alias?: string | null;
  department?: string | null;
  internal_notes?: string | null;

  profile_avatar_url?: string | null;
  avatar_url?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
  exit_reason?: string | null;
  status_reason?: string | null;
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

export type StoreMemberForPermissionsRow = {
  member_id: string;
  store_id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  role: StoreRole | string;
  status: string;
  permissions: Record<string, boolean>;
  sensitive_actions: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type LoginStoreOption = {
  store_id: string;
  store_name: string;
  store_slug: string | null;
  store_logo_url: string | null;
  role: string;
  status: string;
  status_reason?: string | null;
  is_owner: boolean;
  is_primary_owner: boolean;
  access_blocked?: boolean | null;
  access_message?: string | null;
  sort_order: number;
};

export interface StoreMemberSessionSummaryRow {
  member_id: string;
  last_seen_at: string | null;
  last_session_action: string | null;
  last_session_at: string | null;
  last_session_details: Record<string, unknown> | null;
};

export type StoreMemberFullHistoryRow = {
  event_id: string;
  event_at: string;
  module: string;
  action: string;
  title: string;
  description: string | null;
  outcome: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  source: string;
};

export type StoreMemberFullHistoryFilters = {
  dateFrom?: string | null;
  dateTo?: string | null;
  module?: string | null;
  action?: string | null;
  outcome?: string | null;
  search?: string | null;
  limit?: number;
  offset?: number;
};


export type StoreCustomRole = {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  base_role: StoreRole | string;
  active: boolean;
  permissions: Record<string, boolean>;
  sensitive_actions: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreCustomRoleFormData = {
  id?: string;
  name: string;
  description: string;
  base_role: StoreRole | string;
  active: boolean;
  permissions: Record<string, boolean>;
  sensitive_actions: Record<string, unknown>;
};
