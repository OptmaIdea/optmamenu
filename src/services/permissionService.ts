import { supabase } from '@/lib/supabase';
import type {
    EffectiveStorePermission,
    SensitiveActionRequirementResult,
} from '@/types/permissions';

export async function getEffectiveStorePermissions(
    storeId: string
): Promise<EffectiveStorePermission[]> {
    const { data, error } = await supabase.rpc('get_effective_store_permissions', {
        p_store_id: storeId,
    });

    if (error) {
        console.error('Erro ao carregar permissões efetivas:', error);
        throw error;
    }

    return (data ?? []) as EffectiveStorePermission[];
}

export async function userHasStorePermission(
    storeId: string,
    permissionCode: string
): Promise<boolean> {
    const { data, error } = await supabase.rpc('user_has_store_permission', {
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