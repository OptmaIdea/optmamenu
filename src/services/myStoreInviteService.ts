import { supabase } from '@/lib/supabase';
import type {
    AcceptStoreInviteResult,
    MyPendingStoreInvite,
} from '@/types/myStoreInvites';

export async function getMyPendingStoreInvites(): Promise<MyPendingStoreInvite[]> {
    const { data, error } = await supabase.rpc('get_my_pending_store_invites');

    if (error) {
        console.error('Erro ao buscar meus convites pendentes:', error);
        throw error;
    }

    return (data ?? []) as MyPendingStoreInvite[];
}

export async function acceptStoreMemberInvite(
    storeId: string
): Promise<AcceptStoreInviteResult> {
    const { data, error } = await supabase.rpc('accept_store_member_invite', {
        p_store_id: storeId,
    });

    if (error) {
        console.error('Erro ao aceitar convite de loja:', error);
        throw error;
    }

    return data as AcceptStoreInviteResult;
}

export async function declineStoreMemberInvite(
    inviteId: string,
    reason?: string
): Promise<{ invite_id: string; store_id: string; email: string; status: 'declined' }> {
    const { data, error } = await supabase.rpc('decline_my_store_member_invite', {
        p_invite_id: inviteId,
        p_reason: reason ?? 'Recusado pelo convidado',
    });

    if (error) {
        console.error('Erro ao recusar convite de loja:', error);
        throw error;
    }

    return data as {
        invite_id: string;
        store_id: string;
        email: string;
        status: 'declined';
    };
}
