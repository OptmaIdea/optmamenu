import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import type {
  StorePermissionMatrixRow,
  StoreSensitiveActionMatrixRow,
} from '@/types/security';

type LoadingState = {
  matrix: boolean;
  sensitiveActions: boolean;
  saving: boolean;
};

export function useSecurityPermissionsAdmin() {
  const [permissionMatrix, setPermissionMatrix] = useState<StorePermissionMatrixRow[]>([]);
  const [sensitiveActions, setSensitiveActions] = useState<StoreSensitiveActionMatrixRow[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    matrix: true,
    sensitiveActions: true,
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
      setPermissionMatrix((data ?? []) as StorePermissionMatrixRow[]);
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
  }, [fetchPermissionMatrix, fetchSensitiveActions]);

  return {
    storeId,
    permissionMatrix,
    sensitiveActions,
    loading,
    error,
    refresh: async () => {
      await Promise.all([fetchPermissionMatrix(), fetchSensitiveActions()]);
    },
    updateRolePermission,
    updateSensitiveAction,
  };
}
