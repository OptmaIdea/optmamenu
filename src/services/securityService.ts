// src/services/securityService.ts

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
  const { data, error } = await supabase.rpc('get_current_user_security_context');

  if (error) {
    console.error('Erro ao carregar contexto de segurança:', error);
    throw error;
  }

  return (data ?? EMPTY_SECURITY_CONTEXT) as CurrentUserSecurityContext;
}

export async function getStoreMembers(storeId: string): Promise<StoreMemberAdmin[]> {
  const { data, error } = await supabase.rpc('get_store_members', {
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