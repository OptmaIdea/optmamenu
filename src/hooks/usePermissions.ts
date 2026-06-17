import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    getEffectiveStorePermissions,
    getSensitiveActionRequirement,
    userHasStorePermission,
} from '@/services/permissionService';
import {
    PERMISSIONS_CHANGED_EVENT,
    PERMISSIONS_CHANGED_STORAGE_KEY,
    type PermissionsChangedPayload,
} from '@/utils/permissionEvents';
import type {
    EffectiveStorePermission,
    SensitiveActionRequirementResult,
} from '@/types/permissions';

interface UsePermissionsResult {
    permissions: EffectiveStorePermission[];
    // true apenas durante a carga inicial (tela em branco é esperada)
    loading: boolean;
    // true durante refresh silencioso em background (UI permanece visível)
    refreshing: boolean;
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
    // loading: true apenas enquanto não há nenhuma permissão carregada (carga inicial)
    const [loading, setLoading] = useState(false);
    // refreshing: true durante atualizações em background (não bloqueia a UI)
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Rastreia se já fez ao menos uma carga bem-sucedida para este storeId
    const hasLoadedRef = useRef(false);

    const refresh = useCallback(async () => {
        if (!storeId) {
            setPermissions([]);
            setError(null);
            hasLoadedRef.current = false;
            return;
        }

        const isInitialLoad = !hasLoadedRef.current;

        if (isInitialLoad) {
            // Carga inicial: mostra loading bloqueante (sem dados anteriores para exibir)
            setLoading(true);
        } else {
            // Refresh silencioso: indica atualização sem desmontar a UI
            setRefreshing(true);
        }

        setError(null);

        try {
            const result = await getEffectiveStorePermissions(storeId);
            setPermissions(result);
            hasLoadedRef.current = true;
        } catch (err: unknown) {
            console.error('Erro no hook usePermissions:', err);
            setError(getErrorMessage(err, 'Erro ao carregar permissões'));

            if (isInitialLoad) {
                // Carga inicial falhou: zera para não exibir dados inválidos
                setPermissions([]);
            }
            // Refresh silencioso falhou: preserva as permissões anteriores
            // para não bloquear o usuário por uma falha temporária de rede
        } finally {
            if (isInitialLoad) {
                setLoading(false);
            } else {
                setRefreshing(false);
            }
        }
    }, [storeId]);

    // Quando storeId muda, reseta o flag de "já carregou" para forçar loading inicial
    useEffect(() => {
        hasLoadedRef.current = false;
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
            }, 400);
        };

        const handleLocalPermissionEvent = (event: Event) => {
            const detail = (event as CustomEvent<PermissionsChangedPayload>).detail;

            if (!detail?.storeId || detail.storeId === storeId) {
                scheduleRefresh();
            }
        };

        const handleStorageEvent = (event: StorageEvent) => {
            if (event.key !== PERMISSIONS_CHANGED_STORAGE_KEY || !event.newValue) {
                return;
            }

            try {
                const payload = JSON.parse(event.newValue) as PermissionsChangedPayload;

                if (!payload?.storeId || payload.storeId === storeId) {
                    scheduleRefresh();
                }
            } catch {
                // noop
            }
        };

        window.addEventListener(PERMISSIONS_CHANGED_EVENT, handleLocalPermissionEvent);
        window.addEventListener('storage', handleStorageEvent);

        const channel = supabase
            .channel(`effective-permissions:${storeId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'store_permission_versions',
                    filter: `store_id=eq.${storeId}`,
                },
                (payload) => {
                    console.log('[PERMISSIONS_VERSION_RT]', {
                        storeId,
                        payload,
                    });
                    scheduleRefresh();
                }
            )
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
            .subscribe((status, error) => {
                console.log('[PERMISSIONS_RT_STATUS]', {
                    storeId,
                    status,
                    error,
                });
            });

        return () => {
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }

            window.removeEventListener(PERMISSIONS_CHANGED_EVENT, handleLocalPermissionEvent);
            window.removeEventListener('storage', handleStorageEvent);

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
        refreshing,
        error,
        refresh,
        allowedPermissions,
        permissionsByModule,
        hasPermission,
        checkPermission,
        getActionRequirement,
    };
}
