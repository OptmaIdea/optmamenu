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