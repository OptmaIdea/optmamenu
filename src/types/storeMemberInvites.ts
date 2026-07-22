import type { StoreMemberRole } from '@/types/security';

export type StoreMemberInviteStatus =
    | 'pending'
    | 'accepted'
    | 'cancelled'
    | 'expired';

export type StoreMemberInviteEmailStatus =
    | 'pending'
    | 'sending'
    | 'sent'
    | 'failed'
    | 'not_required';

export type StoreMemberInviteEmailMode = 'invite' | 'magic_link';

export interface StoreMemberInvite {
    invite_id: string;
    store_id: string;
    email: string;
    role: Exclude<StoreMemberRole, 'owner'>;
    status: StoreMemberInviteStatus;
    invited_by: string | null;
    invited_by_email: string | null;
    invited_at: string;
    accepted_at: string | null;
    accepted_by: string | null;
    cancelled_at: string | null;
    cancelled_by: string | null;
    cancel_reason: string | null;
    expires_at: string;
    permissions: Record<string, unknown>;
    sensitive_actions: Record<string, unknown>;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
    email_status?: StoreMemberInviteEmailStatus;
    email_sent_at?: string | null;
    email_error?: string | null;
    email_attempts?: number;
    auth_user_id?: string | null;
    email_mode?: StoreMemberInviteEmailMode | null;
}

export interface CreateStoreMemberInviteResult {
    mode: 'linked_existing_user' | 'pending_invite';
    member_id?: string;
    invite_id?: string;
    store_id: string;
    user_id?: string;
    email: string;
    role: Exclude<StoreMemberRole, 'owner'>;
    status: 'active' | 'pending';
    expires_at?: string;
    target_user_exists_in_auth?: boolean;
    email_status?: StoreMemberInviteEmailStatus;
    email_sent_at?: string | null;
    email_mode?: StoreMemberInviteEmailMode;
    auth_user_id?: string | null;
}
