// src/hooks/useSecurityContext.ts

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCurrentUserSecurityContext } from '@/services/securityService';
import type { CurrentUserSecurityContext } from '@/types/security';

interface UseSecurityContextResult {
  securityContext: CurrentUserSecurityContext | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  primaryStoreId: string | null;
  primaryStoreSlug: string | null;
  currentRole: string | null;
  isOwner: boolean;
  isAdminLike: boolean;
  hasPin: boolean;
}

export function useSecurityContext(): UseSecurityContextResult {
  const [securityContext, setSecurityContext] = useState<CurrentUserSecurityContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const context = await getCurrentUserSecurityContext();
      setSecurityContext(context);
        } catch (err: unknown) {
        console.error('Erro no hook useSecurityContext:', err);

        const message =
            err instanceof Error
            ? err.message
            : 'Erro ao carregar contexto de segurança';

        setError(message);
        setSecurityContext(null);
        } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const primaryMembership = securityContext?.primary_membership ?? null;

  const isOwner = Boolean(primaryMembership?.is_owner);

  const isAdminLike = useMemo(() => {
    const role = primaryMembership?.role;

    return Boolean(
      securityContext?.is_global_admin ||
      role === 'owner' ||
      role === 'admin' ||
      role === 'manager'
    );
  }, [primaryMembership?.role, securityContext?.is_global_admin]);

  return {
    securityContext,
    loading,
    error,
    refresh,
    primaryStoreId: primaryMembership?.store_id ?? null,
    primaryStoreSlug: primaryMembership?.store_slug ?? null,
    currentRole: primaryMembership?.role ?? null,
    isOwner,
    isAdminLike,
    hasPin: Boolean(securityContext?.has_pin),
  };
}