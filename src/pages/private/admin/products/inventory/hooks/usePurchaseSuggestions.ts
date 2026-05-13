import { useCallback, useEffect, useState } from 'react';
import {
    stockService,
    type PurchaseSuggestionRow,
} from '@/services/stockService';

export function usePurchaseSuggestions(storeId: string | null | undefined) {
    const [suggestions, setSuggestions] = useState<PurchaseSuggestionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        if (!storeId) {
            setSuggestions([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const rows = await stockService.getPurchaseSuggestionsByStore(storeId);
            setSuggestions(rows);
        } catch (err: any) {
            console.error('Erro ao carregar sugestões de compra:', err);
            setError(err?.message ?? 'Erro ao carregar sugestões de compra.');
        } finally {
            setLoading(false);
        }
    }, [storeId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return {
        suggestions,
        loading,
        error,
        refresh,
    };
}