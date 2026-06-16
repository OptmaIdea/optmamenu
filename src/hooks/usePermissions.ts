import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    getEffectiveStorePermissions,
    getSensitiveActionRequirement,
    userHasStorePermission,
} from '@/services/permissionService';
import type {
    EffectiveStorePermission,
    SensitiveActionRequirementResult,
} from '@/types/permissions';

interface UsePermissionsResult {
    permissions: EffectiveStorePermission[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    allowedPermissions: string[];
    permissionsByModule: Record<string, EffectiveStorePermission[]>;
    hasPermission: (permissionCode: string) => boolean;
    checkPermission: (permissionCode: string) => Promise<boolean>;
    getActionRequirement: (actionCode: string) => Promise<SensitiveActionRequirementResult>;
}

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

export function usePermissions(storeId: string | null): UsePermissionsResult {
    const [permissions, setPermissions] = useState<EffectiveStorePermission[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!storeId) {
            setPermissions([]);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await getEffectiveStorePermissions(storeId);
            setPermissions(result);
        } catch (err: unknown) {
            console.error('Erro no hook usePermissions:', err);
            setError(getErrorMessage(err, 'Erro ao carregar permissões'));
            setPermissions([]);
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    useEffect(() => {
        if (!storeId) return;

        let refreshTimer: ReturnType<typeof setTimeout> | null = null;

        const scheduleRefresh = () => {
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }

            refreshTimer = setTimeout(() => {
                void refresh();
            }, 500);
        };

        const channel = supabase
            .channel(`permissions:${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'store_role_permission_templates',
                    filter: `store_id=eq.${storeId}`,
                },
                scheduleRefresh
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'store_custom_roles',
                    filter: `store_id=eq.${storeId}`,
                },
                scheduleRefresh
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'store_members',
                    filter: `store_id=eq.${storeId}`,
                },
                scheduleRefresh
            )
            .subscribe();

        return () => {
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }

            void supabase.removeChannel(channel);
        };
    }, [storeId, refresh]);

    const allowedPermissions = useMemo(
        () =>
            permissions
                .filter((permission) => permission.allowed)
                .map((permission) => permission.permission_code),
        [permissions]
    );

    const permissionsByModule = useMemo(() => {
        return permissions.reduce<Record<string, EffectiveStorePermission[]>>((acc, permission) => {
            if (!acc[permission.module]) {
                acc[permission.module] = [];
            }

            acc[permission.module].push(permission);
            return acc;
        }, {});
    }, [permissions]);

    const hasPermission = useCallback(
        (permissionCode: string) => {
            return allowedPermissions.includes(permissionCode);
        },
        [allowedPermissions]
    );

    const checkPermission = useCallback(
        async (permissionCode: string) => {
            if (!storeId) return false;
            return userHasStorePermission(storeId, permissionCode);
        },
        [storeId]
    );

    const getActionRequirement = useCallback(
        async (actionCode: string) => {
            if (!storeId) {
                return {
                    allowed: false,
                    reason: 'missing_store_id',
                    action_code: actionCode,
                };
            }

            return getSensitiveActionRequirement(storeId, actionCode);
        },
        [storeId]
    );

    return {
        permissions,
        loading,
        error,
        refresh,
        allowedPermissions,
        permissionsByModule,
        hasPermission,
        checkPermission,
        getActionRequirement,
    };
}