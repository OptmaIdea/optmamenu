import { supabase } from '@/lib/supabase';
import type {
    CreateStoreMemberInviteResult,
    StoreMemberInvite,
} from '@/types/storeMemberInvites';
import type { StoreMemberRole } from '@/types/security';

export async function createStoreMemberInvite(params: {
    storeId: string;
    email: string;
    role: Exclude<StoreMemberRole, 'owner'>;
    permissions?: Record<string, unknown>;
    sensitiveActions?: Record<string, unknown>;
    expiresInDays?: number;
}): Promise<CreateStoreMemberInviteResult> {
    const { data, error } = await supabase.rpc('create_store_member_invite', {
        p_store_id: params.storeId,
        p_email: params.email,
        p_role: params.role,
        p_permissions: params.permissions ?? {},
        p_sensitive_actions: params.sensitiveActions ?? {},
        p_expires_in_days: params.expiresInDays ?? 7,
    });

    if (error) {
        console.error('Erro ao criar convite de membro:', error);
        throw error;
    }

    return data as CreateStoreMemberInviteResult;
}

export async function getStoreMemberInvites(
    storeId: string
): Promise<StoreMemberInvite[]> {
    const { data, error } = await supabase.rpc('get_store_member_invites', {
        p_store_id: storeId,
    });

    if (error) {
        console.error('Erro ao listar convites de membros:', error);
        throw error;
    }

    return (data ?? []) as StoreMemberInvite[];
}

export async function cancelStoreMemberInvite(params: {
    inviteId: string;
    reason?: string;
}): Promise<{ invite_id: string; status: 'cancelled' }> {
    const { data, error } = await supabase.rpc('cancel_store_member_invite', {
        p_invite_id: params.inviteId,
        p_reason: params.reason ?? null,
    });

    if (error) {
        console.error('Erro ao cancelar convite:', error);
        throw error;
    }

    return data as { invite_id: string; status: 'cancelled' };
}