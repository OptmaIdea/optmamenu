import { supabase } from '@/lib/supabase';
import type {
  CurrentUserSecurityContext,
  StoreMemberAdmin,
  StoreMemberRole,
  StoreMemberStatus,
} from '@/types/security';

const EMPTY_SECURITY_CONTEXT: CurrentUserSecurityContext = {
  authenticated: false,
  user_id: null,
  email: null,
  profile: null,
  memberships: [],
  primary_membership: null,
  has_pin: false,
  is_global_admin: false,
};

export async function getCurrentUserSecurityContext(): Promise<CurrentUserSecurityContext> {
  const { data, error } = await supabase.rpc('get_current_user_security_context_v2');

  if (error) {
    console.error('Erro ao carregar contexto de segurança:', error);
    throw error;
  }

  return (data ?? EMPTY_SECURITY_CONTEXT) as CurrentUserSecurityContext;
}

export async function getStoreMembers(storeId: string): Promise<StoreMemberAdmin[]> {
  const { data, error } = await supabase.rpc('get_store_members_v2', {
    p_store_id: storeId,
  });

  if (error) {
    console.error('Erro ao listar membros da loja:', error);
    throw error;
  }

  return (data ?? []) as StoreMemberAdmin[];
}

export async function addStoreMemberByEmail(params: {
  storeId: string;
  email: string;
  role?: Exclude<StoreMemberRole, 'owner'>;
  status?: StoreMemberStatus;
  permissions?: Record<string, unknown>;
  sensitiveActions?: Record<string, unknown>;
}): Promise<StoreMemberAdmin | null> {
  const { data, error } = await supabase.rpc('add_store_member_by_email', {
    p_store_id: params.storeId,
    p_email: params.email,
    p_role: params.role ?? 'staff',
    p_status: params.status ?? 'active',
    p_permissions: params.permissions ?? {},
    p_sensitive_actions: params.sensitiveActions ?? {},
  });

  if (error) {
    console.error('Erro ao adicionar membro por e-mail:', error);
    throw error;
  }

  return Array.isArray(data) ? ((data[0] ?? null) as StoreMemberAdmin | null) : null;
}

export async function updateStoreMemberStatus(params: {
  memberId: string;
  status: StoreMemberStatus;
  reason?: string;
}): Promise<StoreMemberAdmin | null> {
  const { data, error } = await supabase.rpc('update_store_member_status', {
    p_member_id: params.memberId,
    p_status: params.status,
    p_reason: params.reason ?? null,
  });

  if (error) {
    console.error('Erro ao atualizar status do membro:', error);
    throw error;
  }

  return Array.isArray(data) ? ((data[0] ?? null) as StoreMemberAdmin | null) : null;
}

export async function updateStoreMemberRole(params: {
  memberId: string;
  role: Exclude<StoreMemberRole, 'owner'>;
  reason?: string;
}): Promise<StoreMemberAdmin | null> {
  const { data, error } = await supabase.rpc('update_store_member_role', {
    p_member_id: params.memberId,
    p_role: params.role,
    p_reason: params.reason ?? null,
  });

  if (error) {
    console.error('Erro ao atualizar papel do membro:', error);
    throw error;
  }

  return Array.isArray(data) ? ((data[0] ?? null) as StoreMemberAdmin | null) : null;
}

export type StoreMemberAccessTimelineItem = {
    event_id: string;
    event_at: string;
    event_type: string;
    event_label: string;
    severity: string;
    title: string;
    description: string | null;
    resulting_status: string | null;
    old_status: string | null;
    old_role: string | null;
    new_role: string | null;
    old_custom_role_id: string | null;
    new_custom_role_id: string | null;
    visible_to_member: boolean;
    created_by: string | null;
    created_by_email: string | null;
    metadata: Record<string, unknown> | null;
};

export async function getStoreMemberAccessTimeline(
    storeId: string,
    memberId: string
): Promise<StoreMemberAccessTimelineItem[]> {
    const { data, error } = await supabase.rpc('get_store_member_access_timeline', {
        p_store_id: storeId,
        p_member_id: memberId,
    });

    if (error) {
        console.error('Erro ao carregar timeline de acesso do colaborador:', error);
        throw error;
    }

    return Array.isArray(data) ? (data as StoreMemberAccessTimelineItem[]) : [];
}

export type CreateStoreMemberOccurrenceInput = {
    memberId: string;
    occurrenceType: string;
    severity: string;
    title?: string | null;
    description?: string | null;
    occurredAt?: string | null;
    visibleToMember?: boolean;
    metadata?: Record<string, unknown>;
};

export async function createStoreMemberOccurrenceV2(
    input: CreateStoreMemberOccurrenceInput
) {
    const { data, error } = await supabase.rpc('create_store_member_occurrence_v2', {
        p_member_id: input.memberId,
        p_occurrence_type: input.occurrenceType,
        p_severity: input.severity,
        p_title: input.title ?? null,
        p_description: input.description ?? null,
        p_occurred_at: input.occurredAt ?? null,
        p_visible_to_member: input.visibleToMember ?? false,
        p_metadata: input.metadata ?? {},
    });

    if (error) {
        console.error('Erro ao registrar ocorrência do usuário:', error);
        throw error;
    }

    return Array.isArray(data) ? data[0] ?? null : data;
}

export type UpdateStoreMemberProfileDetailsInput = {
    memberId: string;

    profileName?: string | null;
    profilePhone?: string | null;
    profileMobilePhone?: string | null;
    profileWhatsappPhone?: string | null;
    profileCpf?: string | null;
    profileBirthdate?: string | null;

    profileZipCode?: string | null;
    profileAddress?: string | null;
    profileAddressNumber?: string | null;
    profileComplement?: string | null;
    profileDistrict?: string | null;
    profileCity?: string | null;
    profileState?: string | null;

    profileInstagramUrl?: string | null;
    profileFacebookUrl?: string | null;
    profileWebsiteUrl?: string | null;

    internalAlias?: string | null;
    jobTitle?: string | null;
    department?: string | null;
    internalNotes?: string | null;

    reason?: string | null;
};

export async function updateStoreMemberProfileDetails(
    input: UpdateStoreMemberProfileDetailsInput
) {
    const { data, error } = await supabase.rpc('update_store_member_profile_details', {
        p_member_id: input.memberId,

        p_profile_name: input.profileName ?? null,
        p_profile_phone: input.profilePhone ?? null,
        p_profile_mobile_phone: input.profileMobilePhone ?? null,
        p_profile_whatsapp_phone: input.profileWhatsappPhone ?? null,
        p_profile_cpf: input.profileCpf ?? null,
        p_profile_birthdate: input.profileBirthdate || null,

        p_profile_zip_code: input.profileZipCode ?? null,
        p_profile_address: input.profileAddress ?? null,
        p_profile_address_number: input.profileAddressNumber ?? null,
        p_profile_complement: input.profileComplement ?? null,
        p_profile_district: input.profileDistrict ?? null,
        p_profile_city: input.profileCity ?? null,
        p_profile_state: input.profileState ?? null,

        p_profile_instagram_url: input.profileInstagramUrl ?? null,
        p_profile_facebook_url: input.profileFacebookUrl ?? null,
        p_profile_website_url: input.profileWebsiteUrl ?? null,

        p_internal_alias: input.internalAlias ?? null,
        p_job_title: input.jobTitle ?? null,
        p_department: input.department ?? null,
        p_internal_notes: input.internalNotes ?? null,

        p_reason: input.reason ?? 'Atualização de dados complementares pela tela de usuários.',
    });

    if (error) {
        console.error('Erro ao atualizar dados complementares do usuário:', error);
        throw error;
    }

    return Array.isArray(data) ? data[0] ?? null : data;
}

export type UpdateCurrentUserProfileInput = {
    name?: string | null;
    internalAlias?: string | null;
    phone?: string | null;
    mobilePhone?: string | null;
    whatsappPhone?: string | null;
    birthdate?: string | null;
    zipCode?: string | null;
    address?: string | null;
    addressNumber?: string | null;
    complement?: string | null;
    district?: string | null;
    city?: string | null;
    state?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    websiteUrl?: string | null;
    avatarUrl?: string | null;
    cpf?: string | null;
};

export async function updateCurrentUserProfile(
    input: UpdateCurrentUserProfileInput
) {
    const { data, error } = await supabase.rpc('update_current_user_profile', {
        p_name: input.name ?? null,
        p_internal_alias: input.internalAlias ?? null,
        p_phone: input.phone ?? null,
        p_mobile_phone: input.mobilePhone ?? null,
        p_whatsapp_phone: input.whatsappPhone ?? null,
        p_birthdate: input.birthdate || null,
        p_zip_code: input.zipCode ?? null,
        p_address: input.address ?? null,
        p_address_number: input.addressNumber ?? null,
        p_complement: input.complement ?? null,
        p_district: input.district ?? null,
        p_city: input.city ?? null,
        p_state: input.state ?? null,
        p_instagram_url: input.instagramUrl ?? null,
        p_facebook_url: input.facebookUrl ?? null,
        p_website_url: input.websiteUrl ?? null,
        p_avatar_url: input.avatarUrl ?? null,
        p_cpf: input.cpf ?? null,
    });

    if (error) {
        console.error('Erro ao atualizar perfil do próprio usuário:', error);
        throw error;
    }

    return data;
}
