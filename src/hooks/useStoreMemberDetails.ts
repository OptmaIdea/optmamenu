import { useCallback, useEffect, useState } from 'react';
import {
    createStoreMemberOccurrence,
    getStoreMemberOccurrences,
    getStoreMemberPrivateDetails,
    upsertStoreMemberPrivateDetails,
} from '@/services/userMemberDetailsService';
import type {
    StoreMemberOccurrence,
    StoreMemberOccurrenceInput,
    StoreMemberPrivateDetails,
    StoreMemberPrivateDetailsInput,
} from '@/types/userMemberDetails';

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function useStoreMemberDetails(memberId: string | null) {
    const [details, setDetails] = useState<StoreMemberPrivateDetails | null>(null);
    const [occurrences, setOccurrences] = useState<StoreMemberOccurrence[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!memberId) {
            setDetails(null);
            setOccurrences([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [memberDetails, memberOccurrences] = await Promise.all([
                getStoreMemberPrivateDetails(memberId),
                getStoreMemberOccurrences(memberId),
            ]);

            setDetails(memberDetails);
            setOccurrences(memberOccurrences);
        } catch (err: unknown) {
            console.error('Erro ao carregar detalhes do membro:', err);
            setError(getErrorMessage(err, 'Erro ao carregar detalhes do membro'));
            setDetails(null);
            setOccurrences([]);
        } finally {
            setLoading(false);
        }
    }, [memberId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const saveDetails = useCallback(
        async (input: StoreMemberPrivateDetailsInput) => {
            setSaving(true);
            setError(null);

            try {
                const result = await upsertStoreMemberPrivateDetails(input);
                setDetails(result);
                return result;
            } catch (err: unknown) {
                console.error('Erro ao salvar detalhes do membro:', err);
                setError(getErrorMessage(err, 'Erro ao salvar detalhes do membro'));
                throw err;
            } finally {
                setSaving(false);
            }
        },
        []
    );

    const addOccurrence = useCallback(
        async (input: StoreMemberOccurrenceInput) => {
            setSaving(true);
            setError(null);

            try {
                const result = await createStoreMemberOccurrence(input);
                setOccurrences((current) => [result, ...current]);
                return result;
            } catch (err: unknown) {
                console.error('Erro ao criar ocorrência:', err);
                setError(getErrorMessage(err, 'Erro ao criar ocorrência'));
                throw err;
            } finally {
                setSaving(false);
            }
        },
        []
    );

    return {
        details,
        occurrences,
        loading,
        saving,
        error,
        refresh,
        saveDetails,
        addOccurrence,
    };
}