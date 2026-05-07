import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getActiveStoreId } from '@/utils/activeStore';

export type CurrentStore = {
  id: string;
  slug?: string | null;
  name?: string | null;
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
 * Resolve a loja ativa via activeStoreId (localStorage), consultando a tabela stores.
 * Garante isolamento por loja selecionada no seletor, não pela loja primária do usuário.
 */
export function useCurrentStore(): UseCurrentStoreResult {
  const [store, setStore] = useState<CurrentStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const activeStoreId = getActiveStoreId();
      if (!activeStoreId) {
        setStore(null);
        return;
      }

      const { data: storeData, error: storeErr } = await supabase
        .from('stores')
        .select('id, slug, name, user_id')
        .eq('id', activeStoreId)
        .maybeSingle();

      if (storeErr) throw storeErr;

      if (!storeData) {
        throw new Error('Loja ativa não encontrada ou sem permissão.');
      }

      setStore(storeData ?? null);
    } catch (e: any) {
      console.error('useCurrentStore error:', e);
      setError(e?.message || 'Erro ao carregar a loja ativa.');
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Re-executa sempre que o seletor de loja mudar
    const handler = () => void refresh();
    window.addEventListener('optmamenu:active-store-changed', handler);
    return () => window.removeEventListener('optmamenu:active-store-changed', handler);
  }, [refresh]);

  return {
    store,
    storeId: store?.id ?? null,
    loading,
    error,
    refresh,
  };
}
