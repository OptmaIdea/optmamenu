export type PermissionRiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type SensitiveActionRequirement =
    | 'none'
    | 'pin'
    | 'master_password'
    | 'pin_or_master'
    | 'owner_approval'
    | 'token'
    | 'pin_and_token';

export interface EffectiveStorePermission {
    permission_code: string;
    module: string;
    action: string;
    label: string;
    description: string | null;
    risk_level: PermissionRiskLevel;
    allowed: boolean;
    source?: string;
    role?: string;
    role_allowed?: boolean;
    custom_role_override?: boolean | null;
    override_value?: boolean | null;
}

export interface SensitiveActionRequirementResult {
    allowed: boolean;
    reason: string;
    action_code: string;
    module?: string;
    label?: string;
    description?: string | null;
    risk_level?: PermissionRiskLevel;
    requirement?: SensitiveActionRequirement;
    min_role?: string;
    current_role?: string;
    current_role_rank?: number;
    min_role_rank?: number;
    token_enabled?: boolean;
    token_expiry_seconds?: number;
    max_attempts?: number;
    require_reason?: boolean;
    has_pin?: boolean;
    source?: string;
}