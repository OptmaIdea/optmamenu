import { supabase } from '@/lib/supabase';
import type {
    StoreMemberOccurrence,
    StoreMemberOccurrenceInput,
    StoreMemberPrivateDetails,
    StoreMemberPrivateDetailsInput,
} from '@/types/userMemberDetails';

export async function getStoreMemberPrivateDetails(
    memberId: string
): Promise<StoreMemberPrivateDetails | null> {
    const { data, error } = await supabase
        .from('store_member_private_details')
        .select('*')
        .eq('member_id', memberId)
        .maybeSingle();

    if (error) {
        console.error('Erro ao buscar detalhes privados do membro:', error);
        throw error;
    }

    return (data ?? null) as StoreMemberPrivateDetails | null;
}

export async function upsertStoreMemberPrivateDetails(
    input: StoreMemberPrivateDetailsInput
): Promise<StoreMemberPrivateDetails> {
    const payload = {
        store_id: input.storeId,
        member_id: input.memberId,
        user_id: input.userId,
        nickname: input.nickname ?? null,
        address: input.address ?? {},
        started_at: input.startedAt ?? null,
        ended_at: input.endedAt ?? null,
        exit_reason: input.exitReason ?? null,
        internal_notes: input.internalNotes ?? null,
        metadata: input.metadata ?? {},
    };

    const { data, error } = await supabase
        .from('store_member_private_details')
        .upsert(payload, {
            onConflict: 'member_id',
        })
        .select('*')
        .single();

    if (error) {
        console.error('Erro ao salvar detalhes privados do membro:', error);
        throw error;
    }

    return data as StoreMemberPrivateDetails;
}

export async function getStoreMemberOccurrences(
    memberId: string
): Promise<StoreMemberOccurrence[]> {
    const { data, error } = await supabase
        .from('store_member_occurrences')
        .select('*')
        .eq('member_id', memberId)
        .order('occurred_at', { ascending: false });

    if (error) {
        console.error('Erro ao buscar ocorrências do membro:', error);
        throw error;
    }

    return (data ?? []) as StoreMemberOccurrence[];
}

export async function createStoreMemberOccurrence(
    input: StoreMemberOccurrenceInput
): Promise<StoreMemberOccurrence> {
    const payload = {
        store_id: input.storeId,
        member_id: input.memberId,
        user_id: input.userId,
        occurrence_type: input.occurrenceType,
        severity: input.severity ?? 'info',
        title: input.title,
        description: input.description ?? null,
        occurred_at: input.occurredAt ?? new Date().toISOString(),
        visible_to_member: input.visibleToMember ?? false,
        created_by_email: input.createdByEmail ?? null,
        metadata: input.metadata ?? {},
    };

    const { data, error } = await supabase
        .from('store_member_occurrences')
        .insert(payload)
        .select('*')
        .single();

    if (error) {
        console.error('Erro ao criar ocorrência do membro:', error);
        throw error;
    }

    return data as StoreMemberOccurrence;
}