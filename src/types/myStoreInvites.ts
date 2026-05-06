import type { StoreMemberRole } from '@/types/security';

export interface MyPendingStoreInvite {
    invite_id: string;
    store_id: string;
    store_name: string;
    store_slug: string;
    store_logo_url: string | null;
    email: string;
    role: Exclude<StoreMemberRole, 'owner'>;
    status: 'pending';
    invited_by: string | null;
    invited_by_email: string | null;
    invited_at: string;
    expires_at: string;
    created_at: string;
}

export interface AcceptStoreInviteResult {
    mode: 'accepted_invite';
    invite_id: string;
    member_id: string;
    store_id: string;
    user_id: string;
    email: string;
    role: Exclude<StoreMemberRole, 'owner'>;
    status: 'active';
}