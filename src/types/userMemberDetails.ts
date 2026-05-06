export type StoreMemberOccurrenceType =
    | 'note'
    | 'warning'
    | 'praise'
    | 'training'
    | 'incident'
    | 'role_change'
    | 'absence'
    | 'exit'
    | 'other';

export type StoreMemberOccurrenceSeverity =
    | 'info'
    | 'low'
    | 'medium'
    | 'high'
    | 'critical';

export interface StoreMemberPrivateDetails {
    id: string;
    store_id: string;
    member_id: string;
    user_id: string;
    nickname: string | null;
    address: Record<string, unknown>;
    started_at: string | null;
    ended_at: string | null;
    exit_reason: string | null;
    internal_notes: string | null;
    metadata: Record<string, unknown>;
    created_by: string | null;
    updated_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface StoreMemberPrivateDetailsInput {
    storeId: string;
    memberId: string;
    userId: string;
    nickname?: string | null;
    address?: Record<string, unknown>;
    startedAt?: string | null;
    endedAt?: string | null;
    exitReason?: string | null;
    internalNotes?: string | null;
    metadata?: Record<string, unknown>;
}

export interface StoreMemberOccurrence {
    id: string;
    store_id: string;
    member_id: string;
    user_id: string;
    occurrence_type: StoreMemberOccurrenceType;
    severity: StoreMemberOccurrenceSeverity;
    title: string;
    description: string | null;
    occurred_at: string;
    visible_to_member: boolean;
    created_by: string | null;
    created_by_email: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface StoreMemberOccurrenceInput {
    storeId: string;
    memberId: string;
    userId: string;
    occurrenceType: StoreMemberOccurrenceType;
    severity?: StoreMemberOccurrenceSeverity;
    title: string;
    description?: string | null;
    occurredAt?: string | null;
    visibleToMember?: boolean;
    createdByEmail?: string | null;
    metadata?: Record<string, unknown>;
}