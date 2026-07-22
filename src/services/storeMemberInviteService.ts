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
    fullName?: string;
    phone?: string;
    cpf?: string;
    internalNotes?: string;
    permissions?: Record<string, unknown>;
    sensitiveActions?: Record<string, unknown>;
    expiresInDays?: number;
}): Promise<CreateStoreMemberInviteResult> {
    const { data, error } = await supabase.functions.invoke(
        'create-store-member-invite',
        {
            body: {
                storeId: params.storeId,
                email: params.email,
                role: params.role,
                fullName: params.fullName?.trim() || undefined,
                phone: params.phone?.trim() || undefined,
                cpf: params.cpf?.trim() || undefined,
                internalNotes: params.internalNotes?.trim() || undefined,
                permissions: params.permissions ?? {},
                sensitiveActions: params.sensitiveActions ?? {},
                expiresInDays: params.expiresInDays ?? 7,
            },
        },
    );

    if (error) {
        console.error('Erro ao criar e enviar convite de membro:', error);
        throw new Error(
            error.message ||
            'Não foi possível criar e enviar o convite do usuário.',
        );
    }

    if (!data || typeof data !== 'object') {
        throw new Error('A função de convite retornou uma resposta inválida.');
    }

    if ('error' in data && typeof data.error === 'string') {
        throw new Error(data.error);
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
