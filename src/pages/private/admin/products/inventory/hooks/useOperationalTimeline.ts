import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { OperationalTimelineEvent } from '../types/operationalTimeline.types';

type UseOperationalTimelineOptions = {
    enabled?: boolean;
    limit?: number;

    storeId?: string | null;
    entityType?: string | null;
    entityId?: string | null;

    relatedSupplierId?: string | null;
    relatedProductId?: string | null;
    relatedPurchaseQuotationId?: string | null;
    relatedPurchaseDocumentId?: string | null;
    relatedStockTransferId?: string | null;
    relatedStockMovementId?: string | null;
};

export function useOperationalTimeline({
    enabled = true,
    limit = 50,
    storeId,
    entityType,
    entityId,
    relatedSupplierId,
    relatedProductId,
    relatedPurchaseQuotationId,
    relatedPurchaseDocumentId,
    relatedStockTransferId,
    relatedStockMovementId,
}: UseOperationalTimelineOptions) {
    const [events, setEvents] = useState<OperationalTimelineEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refetch = useCallback(async () => {
        if (!enabled) {
            setEvents([]);
            setLoading(false);
            setError(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            let query = supabase
                .from('v_operational_timeline_events')
                .select('*')
                .order('occurred_at', { ascending: false })
                .limit(limit);

            if (storeId) {
                query = query.eq('store_id', storeId);
            }

            if (entityType) {
                query = query.eq('entity_type', entityType);
            }

            if (entityId) {
                query = query.eq('entity_id', entityId);
            }

            if (relatedSupplierId) {
                query = query.eq('related_supplier_id', relatedSupplierId);
            }

            if (relatedProductId) {
                query = query.eq('related_product_id', relatedProductId);
            }

            if (relatedPurchaseQuotationId) {
                query = query.eq('related_purchase_quotation_id', relatedPurchaseQuotationId);
            }

            if (relatedPurchaseDocumentId) {
                query = query.eq('related_purchase_document_id', relatedPurchaseDocumentId);
            }

            if (relatedStockTransferId) {
                query = query.eq('related_stock_transfer_id', relatedStockTransferId);
            }

            if (relatedStockMovementId) {
                query = query.eq('related_stock_movement_id', relatedStockMovementId);
            }

            const { data, error: queryError } = await query;

            if (queryError) {
                throw queryError;
            }

            setEvents((data ?? []) as OperationalTimelineEvent[]);
        } catch (caughtError) {
            const normalizedError =
                caughtError instanceof Error
                    ? caughtError
                    : new Error('Não foi possível carregar a linha do tempo operacional.');

            setError(normalizedError);
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [
        enabled,
        limit,
        storeId,
        entityType,
        entityId,
        relatedSupplierId,
        relatedProductId,
        relatedPurchaseQuotationId,
        relatedPurchaseDocumentId,
        relatedStockTransferId,
        relatedStockMovementId,
    ]);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    return {
        events,
        loading,
        error,
        refetch,
    };
}