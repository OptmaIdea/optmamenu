import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { StockMovementType, StockMovement, StockMovementFilters } from '../types/inventory.types';

interface RegisterMovementParams {
    productId: string;
    quantity: number;
    type: StockMovementType;
    reason?: string;
    orderId?: string;
    supplierId?: string;
    meta?: Record<string, any>;
}

interface FetchMovementsResult {
    movements: StockMovement[];
    total: number;
    hasMore: boolean;
}

type StoreLike = { id: string };

const isCheckConstraintSignError = (err: any) => {
    const msg = String(err?.message ?? err ?? '');
    return msg.includes('check_quantity_sign') || msg.includes('violates check constraint');
};

const getMovementSourceLabel = (source: string | null | undefined) => {
    switch (source) {
        case 'stock_transfer':
            return 'Transferência';
        case 'purchase_document':
            return 'Documento de compra';
        case 'manual':
            return 'Manual';
        case 'order':
            return 'Pedido';
        case 'reservation':
            return 'Reserva';
        case 'adjustment':
            return 'Ajuste';
        case 'inventory_entry':
            return 'Entrada';
        case 'inventory_exit':
            return 'Saída';
        default:
            return source ?? '';
    }
};

const normalizeStore = (storeData: any): StoreLike | null => {
    if (!storeData) return null;
    if (Array.isArray(storeData)) return storeData[0] ?? null;
    return storeData;
};

const extractSuggestedRpcName = (err: any): string | null => {
    const hint = String(err?.hint ?? '');
    const match = hint.match(/function public\.([a-zA-Z0-9_]+)/);
    return match?.[1] ?? null;
};

const isMissingRpcError = (err: any) => String(err?.code ?? '') === 'PGRST202';


/**
 * Calcula quantidade com sinal (fallback), caso o banco exija sinal coerente com type
 * - entry/cancellation/reservation => +
 * - exit/confirmation/clearance    => -
 */
const applySignByType = (type: StockMovementType, qtyAbs: number): number => {
    const q = Math.abs(qtyAbs);

    if (type === 'entry' || type === 'cancellation' || type === 'reservation') return q;
    if (type === 'exit' || type === 'confirmation' || type === 'clearance') return -q;

    return q;
};

/**
 * Chama a RPC apply_stock_movement_delta.
 * Assinatura confirmada pelo hint do PostgREST: p_product_id, p_quantity, p_reason, p_store_id, p_type.
 * Tentamos dois payloads: com e sem p_order_id, para compatibilidade com variações do schema.
 */
const callApplyStockMovementDelta = async (args: {
    storeId: string;
    productId: string;
    type: StockMovementType;
    qty: number;
    reason?: string;
    orderId?: string;
}) => {
    // Payload principal: assinatura exata confirmada pelo PostgREST
    const payloadBase = {
        p_product_id: args.productId,
        p_quantity: args.qty,
        p_reason: args.reason ?? null,
        p_store_id: args.storeId,
        p_type: args.type,
    };

    // Payload estendido: inclui p_order_id caso a função aceite
    const payloadWithOrder = {
        ...payloadBase,
        p_order_id: args.orderId ?? null,
    };

    // Tenta primeiro com order_id, depois sem
    for (const payload of [payloadWithOrder, payloadBase]) {
        const { data, error } = await supabase.rpc('apply_stock_movement_delta', payload);
        if (!error) return { data, error: null };

        // Se a função não existe de forma alguma (PGRST202 sem hint útil), para imediatamente
        if (isMissingRpcError(error) && !extractSuggestedRpcName(error)) {
            return { data: null, error };
        }
    }

    // Última tentativa: repete sem order_id para capturar o erro definitivo
    return supabase.rpc('apply_stock_movement_delta', payloadBase);
};

const extractMovementId = (data: any): string | null => {
    if (!data) return null;
    if (typeof data === 'string') return data;

    if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (typeof first === 'string') return first;
        if (first && typeof first.id === 'string') return first.id;
        if (first && typeof first.movement_id === 'string') return first.movement_id;
        return null;
    }

    if (typeof data === 'object') {
        if (typeof (data as any).id === 'string') return (data as any).id;
        if (typeof (data as any).movement_id === 'string') return (data as any).movement_id;
    }

    return null;
};

export const useStockMovement = () => {
    const [loading, setLoading] = useState(false);

    const getUserAndStore = async (): Promise<{ userId: string; store: StoreLike } | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: storeData, error: storeError } = await supabase.rpc(
            'get_user_store_by_id',
            { p_user_id: user.id }
        );
        if (storeError) throw storeError;

        const store = normalizeStore(storeData);
        if (!store?.id) return null;

        return { userId: user.id, store };
    };

    /**
     * Registra uma nova movimentação de estoque via RPC (evita insert direto)
     * Regra atual: "o type define o sinal".
     * Então tentamos primeiro qty absoluta. Se o banco reclamar de constraint de sinal,
     * fazemos fallback com qty assinada baseada no type.
     */
    const registerMovement = async (params: RegisterMovementParams): Promise<boolean> => {
        setLoading(true);
        try {
            const ctx = await getUserAndStore();
            if (!ctx) throw new Error('Usuário não autenticado ou loja não encontrada');

            const qtyAbs = Math.abs(params.quantity);

            // 1) tentativa principal: qty absoluta (type define sinal no banco)
            let { data, error } = await callApplyStockMovementDelta({
                storeId: ctx.store.id,
                productId: params.productId,
                type: params.type,
                qty: qtyAbs,
                reason: params.reason,
                orderId: params.orderId,
            });

            // 2) fallback: se o banco exigir sinal coerente, tentamos com qty assinada
            if (error && isCheckConstraintSignError(error)) {
                const qtySigned = applySignByType(params.type, qtyAbs);

                const retry = await callApplyStockMovementDelta({
                    storeId: ctx.store.id,
                    productId: params.productId,
                    type: params.type,
                    qty: qtySigned,
                    reason: params.reason,
                    orderId: params.orderId,
                });

                data = retry.data;
                error = retry.error;
            }

            if (error) {
                console.error('Erro ao registrar movimentação (RPC):', error);
                throw error;
            }

            // Se houver fornecedor e/ou meta, tenta persistir no movimento recém-criado.
            // A RPC pode (ou não) retornar o id; então fazemos fallback pelo último movimento do produto.
            if (params.supplierId || params.meta) {
                let movementId = extractMovementId(data);
                let currentMeta: any = null;

                if (!movementId) {
                    const { data: latest, error: latestErr } = await supabase
                        .from('stock_movements')
                        .select('id, metadata')
                        .eq('store_id', ctx.store.id)
                        .eq('product_id', params.productId)
                        .eq('type', params.type)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (!latestErr) {
                        movementId = latest?.id ?? null;
                        currentMeta = (latest as any)?.metadata ?? null;
                    }
                } else {
                    const { data: row, error: rowErr } = await supabase
                        .from('stock_movements')
                        .select('metadata')
                        .eq('id', movementId)
                        .maybeSingle();

                    if (!rowErr) currentMeta = (row as any)?.metadata ?? null;
                }

                if (movementId) {
                    const nextMeta =
                        params.meta
                            ? { ...(currentMeta ?? {}), ...(params.meta ?? {}) }
                            : currentMeta;

                    const updatePayload: Record<string, any> = {};
                    if (params.supplierId) updatePayload.supplier_id = params.supplierId;
                    if (params.meta) updatePayload.metadata = nextMeta;

                    const { error: updErr } = await supabase
                        .from('stock_movements')
                        .update(updatePayload)
                        .eq('id', movementId);

                    if (updErr) {
                        console.warn('Não foi possível atualizar dados no movimento:', updErr);
                    }
                }
            }

            return true;
        } catch (error: any) {
            console.error('Erro no registro de movimentação:', error);
            toast.error(
                error.message?.includes('Estoque insuficiente')
                    ? error.message
                    : 'Erro ao registrar movimentação de estoque'
            );
            return false;
        } finally {
            setLoading(false);
        }
    };

    /**
     * Busca movimentações com filtros e paginação (filtrando por store_id)
     */
    const fetchMovements = async (
        filters: StockMovementFilters = {},
        page: number = 1,
        pageSize: number = 50
    ): Promise<FetchMovementsResult> => {
        setLoading(true);
        try {
            const ctx = await getUserAndStore();
            if (!ctx) return { movements: [], total: 0, hasMore: false };

            let query = supabase
                .from('stock_movements')
                .select(
                    `
                    *,
                    products!inner (
                        name
                    )
                `,
                    { count: 'exact' }
                )
                .eq('store_id', ctx.store.id);

            if (filters.productId) query = query.eq('product_id', filters.productId);
            if (filters.productIds && filters.productIds.length > 0) {
                query = query.in('product_id', filters.productIds);
            }
            if (filters.type) query = query.eq('type', filters.type);

            if (filters.locationId) {
                query = query.or(
                    `location_id.eq.${filters.locationId},from_location_id.eq.${filters.locationId},to_location_id.eq.${filters.locationId}`
                );
            }

            if (filters.startDate) query = query.gte('created_at', filters.startDate);

            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setDate(end.getDate() + 1);
                query = query.lt('created_at', end.toISOString());
            }

            if (filters.search?.trim()) {
                const searchTerm = filters.search.trim();
                query = query.or(
                    [
                        `reason.ilike.%${searchTerm}%`,
                        `reason_code.ilike.%${searchTerm}%`,
                        `source.ilike.%${searchTerm}%`,
                    ].join(',')
                );
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const allLocationIds = Array.from(
                new Set(
                    (data || [])
                        .flatMap((item: any) => [
                            item.location_id,
                            item.from_location_id,
                            item.to_location_id,
                        ])
                        .filter(Boolean)
                )
            );

            let locationMap = new Map<string, { name: string; code: string }>();

            if (allLocationIds.length > 0) {
                const { data: locationsData, error: locationsError } = await supabase
                    .from('stock_locations')
                    .select('id, name, code')
                    .in('id', allLocationIds);

                if (locationsError) throw locationsError;

                locationMap = new Map(
                    (locationsData || []).map((loc: any) => [
                        loc.id,
                        { name: loc.name, code: loc.code },
                    ])
                );
            }

            const allSupplierIds = Array.from(
                new Set(
                    (data || [])
                        .map((item: any) => item.supplier_id)
                        .filter(Boolean)
                )
            );

            let supplierMap = new Map<string, { name: string }>();

            if (allSupplierIds.length > 0) {
                const { data: suppliersData, error: suppliersError } = await supabase
                    .from('suppliers')
                    .select('id, name')
                    .in('id', allSupplierIds);

                if (suppliersError) throw suppliersError;

                supplierMap = new Map(
                    (suppliersData || []).map((supplier: any) => [
                        supplier.id,
                        { name: supplier.name },
                    ])
                );
            }

            const purchaseDocumentIds = Array.from(
                new Set(
                    (data || [])
                        .filter((item: any) => item.source === 'purchase_document' && item.source_id)
                        .map((item: any) => item.source_id)
                )
            );

            let purchaseDocMap = new Map<
                string,
                {
                    purchase_document_number: string | null;
                    supplier_id: string | null;
                    supplier_name: string | null;
                }
            >();

            if (purchaseDocumentIds.length > 0) {
                const { data: purchaseDocs, error: purchaseDocsError } = await supabase
                    .from('purchase_documents')
                    .select(`
                        id,
                        supplier_id,
                        supplier:suppliers (
                            id,
                            name
                        )
                    `)
                    .in('id', purchaseDocumentIds);

                if (purchaseDocsError) throw purchaseDocsError;

                purchaseDocMap = new Map(
                    (purchaseDocs || []).map((doc: any) => {
                        const supplier = Array.isArray(doc.supplier) ? doc.supplier[0] : doc.supplier;

                        return [
                            doc.id,
                            {
                                purchase_document_number: null,
                                supplier_id: doc.supplier_id ?? supplier?.id ?? null,
                                supplier_name: supplier?.name ?? null,
                            },
                        ];
                    })
                );
            }

            const allTransferIds = Array.from(
                new Set(
                    (data || [])
                        .map((item: any) => item.transfer_id)
                        .filter(Boolean)
                )
            );

            let transferMap = new Map<string, { transfer_code: string | null }>();

            if (allTransferIds.length > 0) {
                const { data: transfersData, error: transfersError } = await supabase
                    .from('stock_transfers')
                    .select('id, transfer_code')
                    .in('id', allTransferIds);

                if (transfersError) throw transfersError;

                transferMap = new Map(
                    (transfersData || []).map((transfer: any) => [
                        transfer.id,
                        { transfer_code: transfer.transfer_code ?? null },
                    ])
                );
            }

            const movements: StockMovement[] = (data || []).map((item: any) => {
                const purchaseInfo =
                    item.source === 'purchase_document' && item.source_id
                        ? purchaseDocMap.get(item.source_id)
                        : null;
                const supplierId = item.supplier_id ?? purchaseInfo?.supplier_id ?? null;

                return {
                    id: item.id,
                    product_id: item.product_id,
                    product_name: item.products?.name,
                    order_id: item.order_id ?? item.source_id ?? null,
                    quantity: item.quantity,
                    type: item.type,
                    reason: item.reason ?? item.reason_code ?? null,
                    user_id: item.user_id ?? item.created_by ?? null,
                    previous_stock: item.previous_stock,
                    new_stock: item.new_stock,
                    created_at: item.created_at,
                    transfer_id: item.transfer_id ?? null,

                    location_id: item.location_id ?? null,
                    location_name: item.location_id ? locationMap.get(item.location_id)?.name ?? null : null,
                    location_code: item.location_id ? locationMap.get(item.location_id)?.code ?? null : null,

                    from_location_id: item.from_location_id ?? null,
                    from_location_name: item.from_location_id
                        ? locationMap.get(item.from_location_id)?.name ?? null
                        : null,
                    from_location_code: item.from_location_id
                        ? locationMap.get(item.from_location_id)?.code ?? null
                        : null,

                    to_location_id: item.to_location_id ?? null,
                    to_location_name: item.to_location_id
                        ? locationMap.get(item.to_location_id)?.name ?? null
                        : null,
                    to_location_code: item.to_location_id
                        ? locationMap.get(item.to_location_id)?.code ?? null
                        : null,

                    supplier_id: supplierId,
                    supplier_name:
                        item.supplier_name ??
                        purchaseInfo?.supplier_name ??
                        (supplierId ? supplierMap.get(supplierId)?.name ?? null : null),
                    purchase_document_number:
                        item.purchase_document_number ??
                        purchaseInfo?.purchase_document_number ??
                        null,

                    source: item.source ?? null,
                    source_label: getMovementSourceLabel(item.source),
                    source_id: item.source_id ?? null,
                    transfer_code: item.transfer_id
                        ? transferMap.get(item.transfer_id)?.transfer_code ?? item.transfer_id
                        : null,
                    divergence_qty: item.divergence_qty ?? null,
                    divergence_resolution: item.divergence_resolution ?? null,
                    divergence_reason: item.divergence_reason ?? null,
                };
            });

            const total = count || 0;
            const hasMore = total > page * pageSize;

            return { movements, total, hasMore };
        } catch (error: any) {
            console.error('Erro ao buscar movimentações:', error);
            toast.error('Erro ao carregar histórico de movimentações');
            return { movements: [], total: 0, hasMore: false };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Busca movimentações de um produto específico (filtrando por store_id)
     */
    const getProductMovements = async (productId: string): Promise<StockMovement[]> => {
        try {
            const ctx = await getUserAndStore();
            if (!ctx) return [];

            const { data, error } = await supabase
                .from('stock_movements')
                .select('*')
                .eq('store_id', ctx.store.id)
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            return (data || []) as unknown as StockMovement[];
        } catch (error: any) {
            console.error('Erro ao buscar movimentações do produto:', error);
            return [];
        }
    };

    /**
     * Verifica se um produto tem movimentações registradas
     * - primeiro tenta RPC product_has_movements (se existir)
     * - fallback: busca direta
     */
    const hasMovements = async (productId: string): Promise<boolean> => {
        try {
            const ctx = await getUserAndStore();
            if (!ctx) return false;

            const { data, error } = await supabase.rpc('product_has_movements', {
                p_product_id: productId,
            });

            if (error) throw error;
            return data || false;
        } catch (error: any) {
            console.error('Erro ao verificar movimentações:', error);
            const movements = await getProductMovements(productId);
            return movements.length > 0;
        }
    };

    return {
        loading,
        registerMovement,
        fetchMovements,
        getProductMovements,
        hasMovements,
    };
};
