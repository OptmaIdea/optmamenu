import { useCallback, useEffect, useState } from 'react';
import {
    acceptStoreMemberInvite,
    declineStoreMemberInvite,
    getMyPendingStoreInvites,
} from '@/services/myStoreInviteService';
import type {
    AcceptStoreInviteResult,
    MyPendingStoreInvite,
} from '@/types/myStoreInvites';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function useMyStoreInvites() {
    const [invites, setInvites] = useState<MyPendingStoreInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [accepting, setAccepting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const result = await getMyPendingStoreInvites();
            setInvites(result);
        } catch (err: unknown) {
            console.error('Erro ao carregar convites do usuário:', err);
            setError(getErrorMessage(err, 'Erro ao carregar convites'));
            setInvites([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const acceptInvite = useCallback(
        async (storeId: string): Promise<AcceptStoreInviteResult> => {
            setAccepting(true);
            setError(null);

            try {
                const result = await acceptStoreMemberInvite(storeId);
                await refresh();
                return result;
            } catch (err: unknown) {
                console.error('Erro ao aceitar convite:', err);
                setError(getErrorMessage(err, 'Erro ao aceitar convite'));
                throw err;
            } finally {
                setAccepting(false);
            }
        },
        [refresh]
    );

    const declineInvite = useCallback(
        async (inviteId: string, reason?: string) => {
            setAccepting(true);
            setError(null);

            try {
                const result = await declineStoreMemberInvite(inviteId, reason);
                await refresh();
                return result;
            } catch (err: unknown) {
                console.error('Erro ao recusar convite:', err);
                setError(getErrorMessage(err, 'Erro ao recusar convite'));
                throw err;
            } finally {
                setAccepting(false);
            }
        },
        [refresh]
    );

    return {
        invites,
        loading,
        accepting,
        error,
        refresh,
        acceptInvite,
        declineInvite,
    };
}
