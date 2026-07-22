import { useCallback, useEffect, useState } from 'react';
import {
    cancelStoreMemberInvite,
    createStoreMemberInvite,
    getStoreMemberInvites,
} from '@/services/storeMemberInviteService';
import type {
    CreateStoreMemberInviteResult,
    StoreMemberInvite,
} from '@/types/storeMemberInvites';
import type { StoreMemberRole } from '@/types/security';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function useStoreMemberInvites(storeId: string | null) {
    const [invites, setInvites] = useState<StoreMemberInvite[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!storeId) {
            setInvites([]);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await getStoreMemberInvites(storeId);
            setInvites(result);
        } catch (err: unknown) {
            console.error('Erro ao carregar convites:', err);
            setError(getErrorMessage(err, 'Erro ao carregar convites'));
            setInvites([]);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const createInvite = useCallback(
        async (params: {
            email: string;
            role: Exclude<StoreMemberRole, 'owner'>;
            inviteAlias?: string;
            fullName?: string;
            phone?: string;
            cpf?: string;
            internalNotes?: string;
            permissions?: Record<string, unknown>;
            sensitiveActions?: Record<string, unknown>;
            expiresInDays?: number;
        }): Promise<CreateStoreMemberInviteResult> => {
            if (!storeId) {
                throw new Error('Loja atual não encontrada.');
            }

            setSaving(true);
            setError(null);

            try {
                const result = await createStoreMemberInvite({
                    storeId,
                    email: params.email,
                    role: params.role,
                    inviteAlias: params.inviteAlias,
                    fullName: params.fullName,
                    phone: params.phone,
                    cpf: params.cpf,
                    internalNotes: params.internalNotes,
                    permissions: params.permissions,
                    sensitiveActions: params.sensitiveActions,
                    expiresInDays: params.expiresInDays ?? 7,
                });

                await refresh();
                return result;
            } catch (err: unknown) {
                console.error('Erro ao criar convite:', err);
                setError(getErrorMessage(err, 'Erro ao criar convite'));
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [storeId, refresh]
    );

    const cancelInvite = useCallback(
        async (inviteId: string, reason?: string) => {
            setSaving(true);
            setError(null);

            try {
                const result = await cancelStoreMemberInvite({
                    inviteId,
                    reason,
                });

                await refresh();
                return result;
            } catch (err: unknown) {
                console.error('Erro ao cancelar convite:', err);
                setError(getErrorMessage(err, 'Erro ao cancelar convite'));
                throw err;
            } finally {
                setSaving(false);
            }
        },
        [refresh]
    );

    return {
        invites,
        loading,
        saving,
        error,
        refresh,
        createInvite,
        cancelInvite,
    };
}