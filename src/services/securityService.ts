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
    cpf?: string | null;
};

export async function updateCurrentUserProfile(
    input: UpdateCurrentUserProfileInput
) {
    const { data, error } = await supabase.rpc('update_current_user_profile', {
        p_name: input.name ?? null,
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
        p_cpf: input.cpf ?? null,
    });

    if (error) {
        console.error('Erro ao atualizar perfil do próprio usuário:', error);
        throw error;
    }

    return data;
}

/**
 * Atualiza o apelido (internal_alias) do usuário logado dentro de uma loja específica.
 * Separado de updateCurrentUserProfile pois internal_alias é por loja (store_members),
 * enquanto os demais dados pessoais ficam em profiles.
 */
export async function updateMyStoreMemberAlias(params: {
    storeId: string;
    internalAlias: string | null;
}) {
    const { data, error } = await supabase.rpc('update_my_store_member_alias', {
        p_store_id: params.storeId,
        p_internal_alias: params.internalAlias ?? '',
    });

    if (error) {
        console.error('Erro ao atualizar apelido do membro:', error);
        throw error;
    }

    return Array.isArray(data) ? data[0] ?? null : data;
}

/**
 * Atualiza os dados de vínculo (store_members) do próprio colaborador logado.
 */
export async function updateMyStoreMemberProfile(params: {
  storeId: string;
  internalAlias?: string | null;
  memberEmail?: string | null;
  memberPhone?: string | null;
  memberMobilePhone?: string | null;
  memberWhatsappPhone?: string | null;
  memberZipCode?: string | null;
  memberAddress?: string | null;
  memberAddressNumber?: string | null;
  memberComplement?: string | null;
  memberDistrict?: string | null;
  memberCity?: string | null;
  memberState?: string | null;
  memberAdditionalInfo?: Array<{ title: string; text: string; sensitive: boolean }> | null;
}) {
  const { data, error } = await supabase.rpc('update_my_store_member_profile', {
    p_store_id: params.storeId,
    p_internal_alias: params.internalAlias ?? null,
    p_member_email: params.memberEmail ?? null,
    p_member_phone: params.memberPhone ?? null,
    p_member_mobile_phone: params.memberMobilePhone ?? null,
    p_member_whatsapp_phone: params.memberWhatsappPhone ?? null,
    p_member_zip_code: params.memberZipCode ?? null,
    p_member_address: params.memberAddress ?? null,
    p_member_address_number: params.memberAddressNumber ?? null,
    p_member_complement: params.memberComplement ?? null,
    p_member_district: params.memberDistrict ?? null,
    p_member_city: params.memberCity ?? null,
    p_member_state: params.memberState ?? null,
    p_member_additional_info: params.memberAdditionalInfo ?? [],
  });

  if (error) {
    console.error('Erro ao atualizar dados de vínculo do colaborador:', error);
    throw error;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

export type UpdateMyProfileDetailsInput = {
    name?: string | null;
    internalAlias?: string | null;
    phone?: string | null;
    mobilePhone?: string | null;
    whatsappPhone?: string | null;
    cpf?: string | null;
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
};

export async function updateMyProfileDetails(
    input: UpdateMyProfileDetailsInput
) {
    const { data, error } = await supabase.rpc('update_my_profile_details', {
        p_name: input.name ?? null,
        p_internal_alias: input.internalAlias ?? null,
        p_phone: input.phone ?? null,
        p_mobile_phone: input.mobilePhone ?? null,
        p_whatsapp_phone: input.whatsappPhone ?? null,
        p_cpf: input.cpf ?? null,
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
    });

    if (error) {
        console.error('Erro ao atualizar detalhes do próprio perfil:', error);
        throw error;
    }

    return data;
}

export type CompleteMyStoreMemberOnboardingInput = {
    storeId: string;
    internalAlias?: string | null;
    memberEmail?: string | null;
    memberPhone?: string | null;
    memberMobilePhone?: string | null;
    memberWhatsappPhone?: string | null;
    memberZipCode?: string | null;
    memberAddress?: string | null;
    memberAddressNumber?: string | null;
    memberComplement?: string | null;
    memberDistrict?: string | null;
    memberCity?: string | null;
    memberState?: string | null;
    memberAdditionalInfo?: Array<{ title: string; text: string; sensitive: boolean }> | null;
};

export async function completeMyStoreMemberOnboarding(
    input: CompleteMyStoreMemberOnboardingInput
) {
    const { data, error } = await supabase.rpc('complete_my_store_member_onboarding', {
        p_store_id: input.storeId,
        p_internal_alias: input.internalAlias ?? null,
        p_member_email: input.memberEmail ?? null,
        p_member_phone: input.memberPhone ?? null,
        p_member_mobile_phone: input.memberMobilePhone ?? null,
        p_member_whatsapp_phone: input.memberWhatsappPhone ?? null,
        p_member_zip_code: input.memberZipCode ?? null,
        p_member_address: input.memberAddress ?? null,
        p_member_address_number: input.memberAddressNumber ?? null,
        p_member_complement: input.memberComplement ?? null,
        p_member_district: input.memberDistrict ?? null,
        p_member_city: input.memberCity ?? null,
        p_member_state: input.memberState ?? null,
        p_member_additional_info: input.memberAdditionalInfo ?? []
    });

    if (error) {
        console.error('Erro ao concluir onboarding do colaborador:', error);
        throw error;
    }

    return data;
}

export type ProfileChangeRequestType =
  | 'name_change'
  | 'cpf_change'
  | 'birthdate_change'
  | 'identity_change'
  | 'contact_update'
  | 'address_update'
  | 'avatar_update'
  | 'additional_info_update'
  | 'additional_info_remove'
  | 'third_party_update'
  | 'other';

export type ProfileChangeRequestStatus =
  | 'pending'
  | 'awaiting_member_confirmation'
  | 'correction_requested'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'applied';

export type ProposedChangeValue = {
  old?: unknown;
  new?: unknown;
  label?: string;
};

export type ProfileChangeRequest = {
  request_id: string;
  store_id: string;
  member_id: string;
  user_id: string;
  user_email?: string | null;
  profile_name?: string | null;
  internal_alias?: string | null;

  request_type: ProfileChangeRequestType;
  status: ProfileChangeRequestStatus;

  requested_changes: Record<string, unknown>;
  current_snapshot?: Record<string, unknown>;
  admin_proposed_changes?: Record<string, ProposedChangeValue>;
  applied_changes?: Record<string, ProposedChangeValue>;

  reason: string;
  admin_notes?: string | null;
  member_feedback?: string | null;

  requested_by?: string | null;
  requested_by_email?: string | null;
  reviewed_by?: string | null;
  reviewed_by_email?: string | null;
  proposed_by?: string | null;
  proposed_by_email?: string | null;

  reviewed_at?: string | null;
  proposed_at?: string | null;
  member_responded_at?: string | null;
  applied_at?: string | null;

  visible_to_member?: boolean;
  sensitive: boolean;
  metadata?: Record<string, unknown>;

  created_at: string;
  updated_at?: string;
};

export const PROFILE_REQUEST_TYPE_LABELS: Record<string, string> = {
  name_change: 'Alteração de nome',
  cpf_change: 'Alteração de CPF',
  birthdate_change: 'Alteração de data de nascimento',
  identity_change: 'Alteração documental',
  contact_update: 'Alteração de contato',
  address_update: 'Alteração de endereço',
  avatar_update: 'Alteração de avatar',
  additional_info_update: 'Alteração de informação adicional',
  additional_info_remove: 'Remoção de informação adicional',
  third_party_update: 'Alteração por terceiro',
  other: 'Outra solicitação',
};

export const PROFILE_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  awaiting_member_confirmation: 'Aguardando sua conferência',
  correction_requested: 'Correção solicitada',
  approved: 'Aprovada',
  rejected: 'Rejeitada',
  cancelled: 'Cancelada',
  applied: 'Aplicada',
};

export async function createMyProfileChangeRequest(params: {
  memberId: string;
  requestType: ProfileChangeRequestType;
  requestedChanges: Record<string, unknown>;
  reason: string;
  sensitive?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc('create_my_profile_change_request_v2', {
    p_member_id: params.memberId,
    p_request_type: params.requestType,
    p_requested_changes: params.requestedChanges,
    p_reason: params.reason,
    p_sensitive: params.sensitive ?? false,
    p_metadata: params.metadata ?? {},
  });

  if (error) {
    console.error('Erro ao criar solicitação cadastral:', error);
    throw error;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function listMyProfileChangeRequests(
  storeId: string,
  limit = 100
): Promise<ProfileChangeRequest[]> {
  const { data, error } = await supabase.rpc('list_my_profile_change_requests', {
    p_store_id: storeId,
    p_limit: limit,
  });

  if (error) {
    console.error('Erro ao listar minhas solicitações cadastrais:', error);
    throw error;
  }

  return (data ?? []) as ProfileChangeRequest[];
}

export async function listStoreProfileChangeRequests(params: {
  storeId: string;
  status?: ProfileChangeRequestStatus | null;
  requestType?: ProfileChangeRequestType | null;
  limit?: number;
  offset?: number;
}): Promise<ProfileChangeRequest[]> {
  const { data, error } = await supabase.rpc('list_store_profile_change_requests', {
    p_store_id: params.storeId,
    p_status: params.status ?? null,
    p_request_type: params.requestType ?? null,
    p_limit: params.limit ?? 100,
    p_offset: params.offset ?? 0,
  });

  if (error) {
    console.error('Erro ao listar solicitações cadastrais da loja:', error);
    throw error;
  }

  return (data ?? []) as ProfileChangeRequest[];
}

export async function reviewStoreProfileChangeRequest(params: {
  requestId: string;
  decision: 'approve' | 'reject' | 'cancel';
  adminNotes?: string | null;
}) {
  const { data, error } = await supabase.rpc('review_store_profile_change_request', {
    p_request_id: params.requestId,
    p_decision: params.decision,
    p_admin_notes: params.adminNotes ?? null,
  });

  if (error) {
    console.error('Erro ao revisar solicitação cadastral:', error);
    throw error;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function proposeStoreProfileChangeRequest(params: {
  requestId: string;
  proposedChanges: Record<string, ProposedChangeValue>;
  adminNotes?: string | null;
}) {
  const { data, error } = await supabase.rpc('propose_store_profile_change_request', {
    p_request_id: params.requestId,
    p_proposed_changes: params.proposedChanges,
    p_admin_notes: params.adminNotes ?? null,
  });

  if (error) {
    console.error('Erro ao propor alteração cadastral:', error);
    throw error;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function respondMyProfileChangeRequest(params: {
  requestId: string;
  decision: 'confirm' | 'request_correction';
  memberFeedback?: string | null;
}) {
  const { data, error } = await supabase.rpc('respond_my_profile_change_request', {
    p_request_id: params.requestId,
    p_decision: params.decision,
    p_member_feedback: params.memberFeedback ?? null,
  });

  if (error) {
    console.error('Erro ao responder solicitação cadastral:', error);
    throw error;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}


export async function cancelMyProfileChangeRequest(params: {
  requestId: string;
  reason?: string | null;
}) {
  const { data, error } = await supabase.rpc('cancel_my_profile_change_request', {
    p_request_id: params.requestId,
    p_reason: params.reason ?? null,
  });

  if (error) {
    console.error('Erro ao cancelar solicita��o cadastral:', error);
    throw error;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}
