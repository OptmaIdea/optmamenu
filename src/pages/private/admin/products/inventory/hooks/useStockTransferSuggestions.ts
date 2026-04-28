import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentStore } from '@/hooks/store/useCurrentStore';
import type { StockTransferSuggestion } from '../types/transferSuggestion.types';

export function useStockTransferSuggestions() {
  const { storeId, loading: storeLoading } = useCurrentStore();
  const [suggestions, setSuggestions] = useState<StockTransferSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    if (!storeId) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc(
      'get_stock_transfer_suggestions_by_store',
      {
        p_store_id: storeId,
      }
    );

    if (rpcError) {
      console.error('Erro ao carregar sugestões de transferência:', rpcError);
      setError(rpcError.message ?? 'Erro ao carregar sugestões de transferência');
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setSuggestions((data ?? []) as StockTransferSuggestion[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    if (!storeLoading) {
      fetchSuggestions();
    }
  }, [fetchSuggestions, storeLoading]);

  return {
    suggestions,
    loading,
    error,
    refresh: fetchSuggestions,
  };
}
