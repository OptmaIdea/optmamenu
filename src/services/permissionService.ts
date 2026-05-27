import { supabase } from '@/lib/supabase';
import type {
    EffectiveStorePermission,
    SensitiveActionRequirementResult,
} from '@/types/permissions';

export async function getEffectiveStorePermissions(
    storeId: string
): Promise<EffectiveStorePermission[]> {
    const { data, error } = await supabase.rpc('get_current_user_store_permissions_v2', {
        p_store_id: storeId,
    });

    if (error) {
        console.error('Erro ao carregar permissões efetivas:', error);
        throw error;
    }

    return (data ?? []).map((row: {
        permission_code: string;
        role_allowed: boolean;
        custom_role_override: boolean | null;
        individual_override: boolean | null;
        effective_allowed: boolean;
        source: string;
    }) => {
        const [module = 'other', action = 'access'] = row.permission_code.split('.');

        return {
            permission_code: row.permission_code,
            module,
            action,
            label: row.permission_code,
            description: null,
            risk_level: 'medium',
            allowed: row.effective_allowed,
            source: row.source,
            role_allowed: row.role_allowed,
            custom_role_override: row.custom_role_override,
            override_value: row.individual_override,
        } as EffectiveStorePermission;
    });
}

export async function userHasStorePermission(
    storeId: string,
    permissionCode: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc('user_has_store_permission_v2', {
        p_store_id: storeId,
        p_permission_code: permissionCode,
    });

    if (error) {
        console.error('Erro ao verificar permissão:', error);
        throw error;
    }

    return Boolean(data);
}

export async function getSensitiveActionRequirement(
    storeId: string,
    actionCode: string
): Promise<SensitiveActionRequirementResult> {
    const { data, error } = await supabase.rpc('get_sensitive_action_requirement', {
        p_store_id: storeId,
        p_action_code: actionCode,
    });

    if (error) {
        console.error('Erro ao resolver ação sensível:', error);
        throw error;
    }

    return (data ?? {
        allowed: false,
        reason: 'empty_response',
        action_code: actionCode,
    }) as SensitiveActionRequirementResult;
}