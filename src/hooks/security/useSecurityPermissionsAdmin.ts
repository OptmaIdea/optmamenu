import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';
import { notifyPermissionsChanged } from '@/utils/permissionEvents';
import type {
  StoreMemberForPermissionsRow,
  StoreMemberPermissionDetailRow,
  StorePermissionMatrixRow,
  StoreSensitiveActionMatrixRow,
} from '@/types/security';

type LoadingState = {
  matrix: boolean;
  matrixRefreshing: boolean;
  sensitiveActions: boolean;
  sensitiveActionsRefreshing: boolean;
  members: boolean;
  membersRefreshing: boolean;
  memberDetail: boolean;
  memberDetailRefreshing: boolean;
  saving: boolean;
};

function normalizeRoleCode(role: string) {
  const normalized = String(role || '').trim().toLowerCase();

  const map: Record<string, string> = {
    proprietário: 'owner',
    proprietario: 'owner',
    administrador: 'admin',
    gerente: 'manager',
    estoque: 'stock_operator',
    'operador de estoque': 'stock_operator',
    caixa: 'cashier',
    vendas: 'sales',
    equipe: 'staff',
    visualizador: 'viewer',
  };

  return map[normalized] ?? normalized;
}

function normalizePermissionMatrixRows(data: unknown): StorePermissionMatrixRow[] {
  return ((Array.isArray(data) ? data : []) as Partial<StorePermissionMatrixRow>[]).map((item) => ({
    permission_code: item.permission_code ?? '',
    label: item.label ?? '',
    description: item.description ?? null,
    module: item.module ?? '',
    action: item.action ?? '',
    risk_level: item.risk_level ?? 'medium',
    active: item.active ?? true,
    sort_order: item.sort_order ?? null,

    owner_allowed: true,
    admin_allowed: Boolean(item.admin_allowed),
    manager_allowed: Boolean(item.manager_allowed),
    stock_operator_allowed: Boolean(item.stock_operator_allowed),
    cashier_allowed: Boolean(item.cashier_allowed),
    sales_allowed: Boolean(item.sales_allowed),
    staff_allowed: Boolean(item.staff_allowed),
    viewer_allowed: Boolean(item.viewer_allowed),
    macro_group: item.macro_group,
    group_key: item.group_key,
    group_label: item.group_label,
    item_key: item.item_key,
    item_label: item.item_label,
    action_key: item.action_key,
    action_label: item.action_label,
    depends_on: item.depends_on,
    access_permission_key: item.access_permission_key,
    ui_sort_order: item.ui_sort_order,
    show_in_permission_ui: item.show_in_permission_ui,
  }));
}

type UseSecurityPermissionsAdminOptions =
  | boolean
  | {
      enabled?: boolean;
      matrix?: boolean;
      sensitiveActions?: boolean;
      members?: boolean;
    };

export function useSecurityPermissionsAdmin(options: UseSecurityPermissionsAdminOptions = true) {
  const enabled = typeof options === 'boolean' ? options : options.enabled ?? true;
  const matrixEnabled = typeof options === 'boolean' ? options : options.matrix ?? enabled;
  const sensitiveActionsEnabled =
    typeof options === 'boolean' ? options : options.sensitiveActions ?? enabled;
  const membersEnabled = typeof options === 'boolean' ? options : options.members ?? enabled;

  const [permissionMatrix, setPermissionMatrix] = useState<StorePermissionMatrixRow[]>([]);
  const [sensitiveActions, setSensitiveActions] = useState<StoreSensitiveActionMatrixRow[]>([]);
  const [memberPermissionDetail, setMemberPermissionDetail] = useState<StoreMemberPermissionDetailRow[]>([]);
  const [membersForPermissions, setMembersForPermissions] = useState<StoreMemberForPermissionsRow[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    matrix: true,
    matrixRefreshing: false,
    sensitiveActions: true,
    sensitiveActionsRefreshing: false,
    members: true,
    membersRefreshing: false,
    memberDetail: false,
    memberDetailRefreshing: false,
    saving: false,
  });
  const [error, setError] = useState<string | null>(null);

  const currentStoreId = useMemo(() => getActiveStoreId(), []);

  const fetchPermissionMatrix = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!currentStoreId) {
      setPermissionMatrix([]);
      setLoading((prev) => ({
        ...prev,
        matrix: false,
        matrixRefreshing: false,
      }));
      return;
    }

    setError(null);
    setLoading((prev) => ({
      ...prev,
      matrix: silent ? prev.matrix : true,
      matrixRefreshing: silent,
    }));

    const { data, error: rpcError } = await supabase.rpc('get_store_permission_matrix_v3', {
      p_store_id: currentStoreId,
    });

    if (rpcError) {
      setError(rpcError.message);
      if (!silent) {
        setPermissionMatrix([]);
      }
    } else {
      const rows = normalizePermissionMatrixRows(data);
      rows.sort((a, b) => (a.label || '').localeCompare(b.label || '', 'pt-BR'));
      setPermissionMatrix(rows);
    }

    setLoading((prev) => ({
      ...prev,
      matrix: false,
      matrixRefreshing: false,
    }));
  }, [currentStoreId]);

  const fetchSensitiveActions = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!currentStoreId) {
      setSensitiveActions([]);
      setLoading((prev) => ({
        ...prev,
        sensitiveActions: false,
        sensitiveActionsRefreshing: false,
      }));
      return;
    }

    setError(null);
    setLoading((prev) => ({
      ...prev,
      sensitiveActions: silent ? prev.sensitiveActions : true,
      sensitiveActionsRefreshing: silent,
    }));

    const { data, error: rpcError } = await supabase.rpc('get_store_sensitive_action_matrix', {
      p_store_id: currentStoreId,
    });

    if (rpcError) {
      setError(rpcError.message);
      if (!silent) {
        setSensitiveActions([]);
      }
    } else {
      setSensitiveActions((data ?? []) as StoreSensitiveActionMatrixRow[]);
    }

    setLoading((prev) => ({
      ...prev,
      sensitiveActions: false,
      sensitiveActionsRefreshing: false,
    }));
  }, [currentStoreId]);

  const fetchMembersForPermissions = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!currentStoreId) {
      setMembersForPermissions([]);
      setLoading((prev) => ({
        ...prev,
        members: false,
        membersRefreshing: false,
      }));
      return;
    }

    setError(null);
    setLoading((prev) => ({
      ...prev,
      members: silent ? prev.members : true,
      membersRefreshing: silent,
    }));

    const { data, error: rpcError } = await supabase.rpc('get_store_members_for_permissions', {
      p_store_id: currentStoreId,
    });

    setLoading((prev) => ({
      ...prev,
      members: false,
      membersRefreshing: false,
    }));

    if (rpcError) {
      setError(rpcError.message);
      if (!silent) {
        setMembersForPermissions([]);
      }
      return;
    }

    setMembersForPermissions((data ?? []) as StoreMemberForPermissionsRow[]);
  }, [currentStoreId]);

  const fetchMemberPermissionDetail = useCallback(async (
    memberId: string,
    options?: { silent?: boolean }
  ) => {
    const silent = options?.silent ?? false;

    if (!memberId) {
      setMemberPermissionDetail([]);
      return [];
    }

    setError(null);
    setLoading((prev) => ({
      ...prev,
      memberDetail: silent ? prev.memberDetail : true,
      memberDetailRefreshing: silent,
    }));

    const { data, error: rpcError } = await supabase.rpc('get_store_member_permission_detail', {
      p_member_id: memberId,
    });

    setLoading((prev) => ({
      ...prev,
      memberDetail: false,
      memberDetailRefreshing: false,
    }));

    if (rpcError) {
      setError(rpcError.message);
      if (!silent) {
        setMemberPermissionDetail([]);
      }
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

      notifyPermissionsChanged(currentStoreId, 'member_permissions_update');

      await fetchMemberPermissionDetail(params.memberId, { silent: true });
    },
    [currentStoreId, fetchMemberPermissionDetail]
  );

  const updateRolePermission = useCallback(
    async (params: {
      role: string;
      permissionCode: string;
      allowed: boolean;
      reason?: string;
    }) => {
      const { role, permissionCode, allowed, reason } = params;

      if (!currentStoreId) {
        throw new Error('Nenhuma loja ativa selecionada.');
      }

      setLoading((prev) => ({ ...prev, saving: true }));

      const { error: rpcError } = await supabase.rpc('set_store_role_permission_v3', {
        p_store_id: currentStoreId,
        p_role: normalizeRoleCode(role),
        p_permission_code: permissionCode,
        p_allowed: allowed,
        p_reason: reason ?? null,
      });

      setLoading((prev) => ({ ...prev, saving: false }));

      if (rpcError) {
        throw rpcError;
      }

      notifyPermissionsChanged(currentStoreId, 'role_permission_update');

      await fetchPermissionMatrix({ silent: true });
    },
    [currentStoreId, fetchPermissionMatrix]
  );

  const updateRolePermissionsBulk = useCallback(
    async (params: {
      role: string;
      changes: Array<{
        permission_code: string;
        allowed: boolean;
      }>;
      reason?: string | null;
    }) => {
      if (!currentStoreId) {
        throw new Error('Nenhuma loja ativa selecionada.');
      }

      setLoading((prev) => ({ ...prev, saving: true }));

      const { error: rpcError } = await supabase.rpc('set_store_role_permissions_bulk_v3', {
        p_store_id: currentStoreId,
        p_role: normalizeRoleCode(params.role),
        p_changes: params.changes,
        p_reason: params.reason ?? null,
      });

      setLoading((prev) => ({ ...prev, saving: false }));

      if (rpcError) {
        throw rpcError;
      }

      notifyPermissionsChanged(currentStoreId, 'role_permissions_bulk_update');

      await fetchPermissionMatrix({ silent: true });
    },
    [currentStoreId, fetchPermissionMatrix]
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
      if (!currentStoreId) {
        throw new Error('Nenhuma loja ativa selecionada.');
      }

      setLoading((prev) => ({ ...prev, saving: true }));

      const { error: rpcError } = await supabase.rpc('update_store_sensitive_action_rule', {
        p_store_id: currentStoreId,
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

      await fetchSensitiveActions({ silent: true });
    },
    [currentStoreId, fetchSensitiveActions]
  );

  useEffect(() => {
    if (!enabled) return;

    if (matrixEnabled) {
      void fetchPermissionMatrix();
    } else {
      setPermissionMatrix([]);
      setLoading((prev) => ({
        ...prev,
        matrix: false,
        matrixRefreshing: false,
      }));
    }

    if (sensitiveActionsEnabled) {
      void fetchSensitiveActions();
    } else {
      setSensitiveActions([]);
      setLoading((prev) => ({
        ...prev,
        sensitiveActions: false,
        sensitiveActionsRefreshing: false,
      }));
    }

    if (membersEnabled) {
      void fetchMembersForPermissions();
    } else {
      setMembersForPermissions([]);
      setLoading((prev) => ({
        ...prev,
        members: false,
        membersRefreshing: false,
      }));
    }
  }, [
    enabled,
    matrixEnabled,
    sensitiveActionsEnabled,
    membersEnabled,
    fetchPermissionMatrix,
    fetchSensitiveActions,
    fetchMembersForPermissions,
  ]);

  useEffect(() => {
    if (!enabled || !currentStoreId) return;

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleAdminRefresh = () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        const tasks: Promise<void>[] = [];

        if (matrixEnabled) {
          tasks.push(fetchPermissionMatrix({ silent: true }));
        }

        if (membersEnabled) {
          tasks.push(fetchMembersForPermissions({ silent: true }));
        }

        if (sensitiveActionsEnabled) {
          tasks.push(fetchSensitiveActions({ silent: true }));
        }

        void Promise.all(tasks);
      }, 500);
    };

    const channel = supabase
      .channel(`security-admin:${currentStoreId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_role_permission_templates',
          filter: `store_id=eq.${currentStoreId}`,
        },
        scheduleAdminRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_custom_roles',
          filter: `store_id=eq.${currentStoreId}`,
        },
        scheduleAdminRefresh
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_members',
          filter: `store_id=eq.${currentStoreId}`,
        },
        scheduleAdminRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      void supabase.removeChannel(channel);
    };
  }, [
    enabled,
    currentStoreId,
    matrixEnabled,
    membersEnabled,
    sensitiveActionsEnabled,
    fetchPermissionMatrix,
    fetchMembersForPermissions,
    fetchSensitiveActions,
  ]);

  return {
    storeId: currentStoreId,
    permissionMatrix,
    sensitiveActions,
    memberPermissionDetail,
    membersForPermissions,
    loading,
    error,
    refresh: async () => {
      const tasks: Promise<void>[] = [];

      if (matrixEnabled) {
        tasks.push(fetchPermissionMatrix());
      }

      if (sensitiveActionsEnabled) {
        tasks.push(fetchSensitiveActions());
      }

      if (membersEnabled) {
        tasks.push(fetchMembersForPermissions());
      }

      await Promise.all(tasks);
    },
    updateRolePermission,
    updateRolePermissionsBulk,
    updateSensitiveAction,
    fetchMembersForPermissions,
    fetchMemberPermissionDetail,
    updateMemberPermissions,
  };
}
