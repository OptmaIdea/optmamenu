import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type CurrentStore = {
  id: string;
  slug?: string | null;
  name?: string | null;
  active?: boolean | null;
  user_id?: string | null;
};

type UseCurrentStoreResult = {
  store: CurrentStore | null;
  storeId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Padrão do projeto: resolve a loja do usuário logado via RPC get_user_store_by_id.
 * Evita duplicação de código em páginas /admin.
 */
export function useCurrentStore(): UseCurrentStoreResult {
  const [store, setStore] = useState<CurrentStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;

      const userId = authData?.user?.id;
      if (!userId) {
        setStore(null);
        return;
      }

      const { data: storeData, error: storeErr } = await supabase.rpc('get_user_store_by_id', {
        p_user_id: userId,
      });

      if (storeErr) throw storeErr;

      // ⚠️ O RPC pode retornar:
      // - um objeto
      // - uma lista (PostgREST costuma embrulhar em array)
      // Normalizamos para sempre retornar 1 objeto ou null.
      const normalized = Array.isArray(storeData)
        ? ((storeData[0] as any) ?? null)
        : ((storeData as any) ?? null);

      setStore(normalized);
    } catch (e: any) {
      console.error('useCurrentStore error:', e);
      setError(e?.message || 'Erro ao carregar a loja do usuário.');
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    store,
    storeId: store?.id ?? null,
    loading,
    error,
    refresh,
  };
}
