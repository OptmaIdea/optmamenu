import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import type {
  StoreMemberForPermissionsRow,
  StoreMemberPermissionDetailRow,
  StorePermissionMatrixRow,
  StoreSensitiveActionMatrixRow,
} from '@/types/security';

type LoadingState = {
  matrix: boolean;
  sensitiveActions: boolean;
  members: boolean;
  memberDetail: boolean;
  saving: boolean;
};

export function useSecurityPermissionsAdmin() {
  const [permissionMatrix, setPermissionMatrix] = useState<StorePermissionMatrixRow[]>([]);
  const [sensitiveActions, setSensitiveActions] = useState<StoreSensitiveActionMatrixRow[]>([]);
  const [memberPermissionDetail, setMemberPermissionDetail] = useState<StoreMemberPermissionDetailRow[]>([]);
  const [membersForPermissions, setMembersForPermissions] = useState<StoreMemberForPermissionsRow[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    matrix: true,
    sensitiveActions: true,
    members: true,
    memberDetail: false,
    saving: false,
  });
  const [error, setError] = useState<string | null>(null);

  const storeId = useMemo(() => getActiveStoreId(), []);

  const fetchPermissionMatrix = useCallback(async () => {
    if (!storeId) {
      setPermissionMatrix([]);
      setLoading((prev) => ({ ...prev, matrix: false }));
      return;
    }

    setError(null);
    setLoading((prev) => ({ ...prev, matrix: true }));

    const { data, error: rpcError } = await supabase.rpc('get_store_permission_matrix', {
      p_store_id: storeId,
    });

    if (rpcError) {
      setError(rpcError.message);
      setPermissionMatrix([]);
    } else {
      const rows = (data ?? []) as StorePermissionMatrixRow[];
      rows.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'));
      setPermissionMatrix(rows);
    }

    setLoading((prev) => ({ ...prev, matrix: false }));
  }, [storeId]);

  const fetchSensitiveActions = useCallback(async () => {
    if (!storeId) {
      setSensitiveActions([]);
      setLoading((prev) => ({ ...prev, sensitiveActions: false }));
      return;
    }

    setError(null);
    setLoading((prev) => ({ ...prev, sensitiveActions: true }));

    const { data, error: rpcError } = await supabase.rpc('get_store_sensitive_action_matrix', {
      p_store_id: storeId,
    });

    if (rpcError) {
      setError(rpcError.message);
      setSensitiveActions([]);
    } else {
      setSensitiveActions((data ?? []) as StoreSensitiveActionMatrixRow[]);
    }

    setLoading((prev) => ({ ...prev, sensitiveActions: false }));
  }, [storeId]);

  const fetchMembersForPermissions = useCallback(async () => {
    if (!storeId) {
      setMembersForPermissions([]);
      setLoading((prev) => ({ ...prev, members: false }));
      return;
    }

    setError(null);
    setLoading((prev) => ({ ...prev, members: true }));

    const { data, error: rpcError } = await supabase.rpc('get_store_members_for_permissions', {
      p_store_id: storeId,
    });

    setLoading((prev) => ({ ...prev, members: false }));

    if (rpcError) {
      setError(rpcError.message);
      setMembersForPermissions([]);
      return;
    }

    setMembersForPermissions((data ?? []) as StoreMemberForPermissionsRow[]);
  }, [storeId]);

  const fetchMemberPermissionDetail = useCallback(async (memberId: string) => {
    if (!memberId) {
      setMemberPermissionDetail([]);
      return [];
    }

    setError(null);
    setLoading((prev) => ({ ...prev, memberDetail: true }));

    const { data, error: rpcError } = await supabase.rpc('get_store_member_permission_detail', {
      p_member_id: memberId,
    });

    setLoading((prev) => ({ ...prev, memberDetail: false }));

    if (rpcError) {
      setError(rpcError.message);
      setMemberPermissionDetail([]);
      throw rpcError;
    }

    const rows = (data ?? []) as StoreMemberPermissionDetailRow[];
    rows.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'));
    setMemberPermissionDetail(rows);
    return rows;
  }, []);

  const updateMemberPermissions = useCallback(
    async (params: {
      memberId: string;
      permissions: Record<string, boolean>;
      sensitiveActions?: Record<string, unknown>;
      reason?: string;
    }) => {
      setLoading((prev) => ({ ...prev, saving: true }));

      const { error: rpcError } = await supabase.rpc('update_store_member_permissions', {
        p_member_id: params.memberId,
        p_permissions: params.permissions,
        p_sensitive_actions: params.sensitiveActions ?? {},
        p_reason: params.reason ?? null,
      });

      setLoading((prev) => ({ ...prev, saving: false }));

      if (rpcError) {
        throw rpcError;
      }

      await fetchMemberPermissionDetail(params.memberId);
    },
    [fetchMemberPermissionDetail]
  );

  const updateRolePermission = useCallback(
    async (params: {
      role: string;
      permissionCode: string;
      allowed: boolean;
      reason?: string;
    }) => {
      if (!storeId) {
        throw new Error('Nenhuma loja ativa selecionada.');
      }

      setLoading((prev) => ({ ...prev, saving: true }));

      const { error: rpcError } = await supabase.rpc('update_store_role_permission_template', {
        p_store_id: storeId,
        p_role: params.role,
        p_permission_code: params.permissionCode,
        p_allowed: params.allowed,
        p_reason: params.reason ?? null,
      });

      setLoading((prev) => ({ ...prev, saving: false }));

      if (rpcError) {
        throw rpcError;
      }

      await fetchPermissionMatrix();
    },
    [storeId, fetchPermissionMatrix]
  );

  const updateSensitiveAction = useCallback(
    async (params: {
      actionCode: string;
      enabled: boolean;
      requirement: string;
      minRole: string;
      tokenEnabled: boolean;
      tokenExpirySeconds: number;
      maxAttempts: number;
      requireReason: boolean;
      reason?: string;
    }) => {
      if (!storeId) {
        throw new Error('Nenhuma loja ativa selecionada.');
      }

      setLoading((prev) => ({ ...prev, saving: true }));

      const { error: rpcError } = await supabase.rpc('update_store_sensitive_action_rule', {
        p_store_id: storeId,
        p_action_code: params.actionCode,
        p_enabled: params.enabled,
        p_requirement: params.requirement,
        p_min_role: params.minRole,
        p_token_enabled: params.tokenEnabled,
        p_token_expiry_seconds: params.tokenExpirySeconds,
        p_max_attempts: params.maxAttempts,
        p_require_reason: params.requireReason,
        p_reason: params.reason ?? null,
      });

      setLoading((prev) => ({ ...prev, saving: false }));

      if (rpcError) {
        throw rpcError;
      }

      await fetchSensitiveActions();
    },
    [storeId, fetchSensitiveActions]
  );

  useEffect(() => {
    void fetchPermissionMatrix();
    void fetchSensitiveActions();
    void fetchMembersForPermissions();
  }, [fetchPermissionMatrix, fetchSensitiveActions, fetchMembersForPermissions]);

  return {
    storeId,
    permissionMatrix,
    sensitiveActions,
    memberPermissionDetail,
    membersForPermissions,
    loading,
    error,
    refresh: async () => {
      await Promise.all([
        fetchPermissionMatrix(),
        fetchSensitiveActions(),
        fetchMembersForPermissions(),
      ]);
    },
    updateRolePermission,
    updateSensitiveAction,
    fetchMembersForPermissions,
    fetchMemberPermissionDetail,
    updateMemberPermissions,
  };
}
