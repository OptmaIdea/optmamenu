import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getActiveStoreId } from '@/utils/activeStore';
import type { StockMovementType, StockMovement, StockMovementFilters } from '../types/inventory.types';

interface RegisterMovementParams {
    productId: string;
    quantity: number;
    type: StockMovementType;
    reason?: string;
    orderId?: string;
    supplierId?: string;
    meta?: Record<string, unknown>;
}

interface FetchMovementsResult {
    movements: StockMovement[];
    total: number;
    hasMore: boolean;
}

type UnknownRecord = Record<string, unknown>;

interface StockMovementRpcItem {
    id: string;
    product_id: string;
    product_name?: string | null;
    order_id?: string | null;
    quantity: number;
    type: StockMovementType;
    reason?: string | null;
    reason_code?: string | null;
    user_id?: string | null;
    created_by?: string | null;
    previous_stock: number;
    new_stock: number;
    created_at: string;
    transfer_id?: string | null;
    location_id?: string | null;
    from_location_id?: string | null;
    to_location_id?: string | null;
    supplier_id?: string | null;
    supplier_name?: string | null;
    purchase_document_number?: string | null;
    source?: string | null;
    source_id?: string | null;
    divergence_qty?: number | null;
    divergence_resolution?: string | null;
    divergence_reason?: string | null;
    products?: { name?: string | null };
}

interface StockMovementsRpcResult {
    ok?: boolean;
    error?: string;
    items?: StockMovementRpcItem[];
    total?: number;
}

interface StockMovementMetadataRow {
    id?: string | null;
    metadata?: Record<string, unknown> | null;
}

interface StockLocationRow {
    id: string;
    name: string;
    code: string;
}

interface SupplierRow {
    id: string;
    name: string;
}

interface PurchaseDocumentRow {
    id: string;
    supplier_id: string | null;
    supplier?: SupplierRow | SupplierRow[] | null;
}

interface StockTransferRow {
    id: string;
    transfer_code: string | null;
}

const isRecord = (value: unknown): value is UnknownRecord =>
    typeof value === 'object' && value !== null;

const getStringProperty = (value: unknown, property: string): string | null => {
    if (!isRecord(value)) return null;
    const propertyValue = value[property];
    return typeof propertyValue === 'string' ? propertyValue : null;
};

const getErrorMessage = (error: unknown) =>
    isRecord(error) && typeof error.message === 'string' ? error.message : String(error ?? '');

const isCheckConstraintSignError = (err: unknown) => {
    const msg = getErrorMessage(err);
    return msg.includes('check_quantity_sign') || msg.includes('violates check constraint');
};

const getMovementSourceLabel = (source: string | null | undefined) => {
    switch (source) {
        case 'physical_count_adjustment':
            return 'Ajuste por contagem física';
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



const extractSuggestedRpcName = (err: unknown): string | null => {
    const hint = isRecord(err) && typeof err.hint === 'string' ? err.hint : '';
    const match = hint.match(/function public\.([a-zA-Z0-9_]+)/);
    return match?.[1] ?? null;
};

const isMissingRpcError = (err: unknown) =>
    isRecord(err) && String(err.code ?? '') === 'PGRST202';


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

const extractMovementId = (data: unknown): string | null => {
    if (!data) return null;
    if (typeof data === 'string') return data;

    if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (typeof first === 'string') return first;
        const id = getStringProperty(first, 'id');
        if (id) return id;
        const movementId = getStringProperty(first, 'movement_id');
        if (movementId) return movementId;
        return null;
    }

    const id = getStringProperty(data, 'id');
    if (id) return id;
    const movementId = getStringProperty(data, 'movement_id');
    if (movementId) return movementId;

    return null;
};

const matchesMovementFilters = (item: StockMovementRpcItem, filters: StockMovementFilters) => {
    if (filters.productId && item.product_id !== filters.productId) return false;
    if (filters.productIds?.length && !filters.productIds.includes(item.product_id)) return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.source && item.source !== filters.source) return false;
    if (filters.reasonCode && item.reason_code !== filters.reasonCode && item.reason !== filters.reasonCode) return false;
    if (filters.locationId) {
        const locationMatches =
            item.location_id === filters.locationId ||
            item.from_location_id === filters.locationId ||
            item.to_location_id === filters.locationId;
        if (!locationMatches) return false;
    }
    if (filters.startDate && item.created_at < filters.startDate) return false;
    if (filters.endDate && item.created_at > filters.endDate) return false;
    if (filters.search?.trim()) {
        const term = filters.search.trim().toLowerCase();
        const haystack = [
            item.product_name,
            item.products?.name,
            item.reason,
            item.reason_code,
            item.supplier_name,
            item.purchase_document_number,
            item.source,
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        if (!haystack.includes(term)) return false;
    }

    return true;
};

export const useStockMovement = () => {
    const [loading, setLoading] = useState(false);

    // Removido: getUserAndStore (substituído por getActiveStoreId local)

    /**
     * Registra uma nova movimentação de estoque via RPC (evita insert direto)
     * Regra atual: "o type define o sinal".
     * Então tentamos primeiro qty absoluta. Se o banco reclamar de constraint de sinal,
     * fazemos fallback com qty assinada baseada no type.
     */
    const registerMovement = async (params: RegisterMovementParams): Promise<boolean> => {
        setLoading(true);
        try {
            const activeStoreId = getActiveStoreId();
            if (!activeStoreId) throw new Error('Usuário não autenticado ou loja não encontrada');

            const qtyAbs = Math.abs(params.quantity);

            // 1) tentativa principal: qty absoluta (type define sinal no banco)
            let { data, error } = await callApplyStockMovementDelta({
                storeId: activeStoreId,
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
                    storeId: activeStoreId,
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
                let currentMeta: Record<string, unknown> | null = null;

                if (!movementId) {
                    const { data: latest, error: latestErr } = await supabase
                        .from('stock_movements')
                        .select('id, metadata')
                        .eq('store_id', activeStoreId)
                        .eq('product_id', params.productId)
                        .eq('type', params.type)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (!latestErr) {
                        movementId = latest?.id ?? null;
                        currentMeta = (latest as StockMovementMetadataRow | null)?.metadata ?? null;
                    }
                } else {
                    const { data: row, error: rowErr } = await supabase
                        .from('stock_movements')
                        .select('metadata')
                        .eq('id', movementId)
                        .maybeSingle();

                    if (!rowErr) currentMeta = (row as StockMovementMetadataRow | null)?.metadata ?? null;
                }

                if (movementId) {
                    const nextMeta =
                        params.meta
                            ? { ...(currentMeta ?? {}), ...(params.meta ?? {}) }
                            : currentMeta;

                    const updatePayload: Record<string, unknown> = {};
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
        } catch (error: unknown) {
            console.error('Erro no registro de movimentação:', error);
            const message = getErrorMessage(error);
            toast.error(
                message.includes('Estoque insuficiente')
                    ? message
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
            const activeStoreId = getActiveStoreId();
            if (!activeStoreId) {
                console.warn('Nenhuma loja ativa selecionada para movimentações.');
                return { movements: [], total: 0, hasMore: false };
            }


            const offset = (page - 1) * pageSize;
            const { data: result, error } = await supabase.rpc('get_stock_movements_safe', {
                p_store_id: activeStoreId,
                p_limit: pageSize,
                p_offset: offset,
            });

            if (error) {
                console.error('Erro ao buscar movimentações:', error);
                throw error;
            }

            const rawResponse = result as unknown;

            const rpcResult =
                typeof rawResponse === 'string'
                    ? (JSON.parse(rawResponse) as StockMovementsRpcResult)
                    : (rawResponse as StockMovementsRpcResult | null);


            if (!rpcResult?.ok) {
                console.warn('Falha ao buscar movimentações:', rpcResult?.error);
                return { movements: [], total: 0, hasMore: false };
            }

            const rawItems = rpcResult.items || [];

            const filteredItems = rawItems.filter((item) => matchesMovementFilters(item, filters));

            const data: StockMovementRpcItem[] = filteredItems.map((item) => ({
                ...item,
                products: {
                    name: item.product_name,
                },
            }));

            const count = Number(rpcResult.total || 0);

            const allLocationIds = Array.from(
                new Set(
                    data
                        .flatMap((item) => [
                            item.location_id,
                            item.from_location_id,
                            item.to_location_id,
                        ])
                        .filter((locationId): locationId is string => Boolean(locationId))
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
                    ((locationsData || []) as StockLocationRow[]).map((loc) => [
                        loc.id,
                        { name: loc.name, code: loc.code },
                    ])
                );
            }

            const allSupplierIds = Array.from(
                new Set(
                    data
                        .map((item) => item.supplier_id)
                        .filter((supplierId): supplierId is string => Boolean(supplierId))
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
                    ((suppliersData || []) as SupplierRow[]).map((supplier) => [
                        supplier.id,
                        { name: supplier.name },
                    ])
                );
            }

            const purchaseDocumentIds = Array.from(
                new Set(
                    data
                        .filter((item) => item.source === 'purchase_document' && item.source_id)
                        .map((item) => item.source_id)
                        .filter((sourceId): sourceId is string => Boolean(sourceId))
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
                    ((purchaseDocs || []) as PurchaseDocumentRow[]).map((doc) => {
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
                    data
                        .map((item) => item.transfer_id || (item.source === 'stock_transfer' ? item.source_id : null))
                        .filter((transferId): transferId is string => Boolean(transferId))
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
                    ((transfersData || []) as StockTransferRow[]).map((transfer) => [
                        transfer.id,
                        { transfer_code: transfer.transfer_code ?? null },
                    ])
                );
            }

            const movements: StockMovement[] = data.map((item) => {
                const purchaseInfo =
                    item.source === 'purchase_document' && item.source_id
                        ? purchaseDocMap.get(item.source_id)
                        : null;
                const supplierId = item.supplier_id ?? purchaseInfo?.supplier_id ?? null;
                const transferId = item.transfer_id || (item.source === 'stock_transfer' ? item.source_id : null);

                return {
                    id: item.id,
                    product_id: item.product_id,
                    product_name: item.products?.name ?? undefined,
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
                    transfer_code: transferId
                        ? transferMap.get(transferId)?.transfer_code ?? null
                        : null,
                    divergence_qty: item.divergence_qty ?? null,
                    divergence_resolution: item.divergence_resolution ?? null,
                    divergence_reason: item.divergence_reason ?? null,
                };
            });

            const total = count || 0;
            const hasMore = total > page * pageSize;

            return { movements, total, hasMore };
        } catch (error: unknown) {
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
            const activeStoreId = getActiveStoreId();
            if (!activeStoreId) return [];

            const { data, error } = await supabase
                .from('stock_movements')
                .select('*')
                .eq('store_id', activeStoreId)
                .eq('product_id', productId)
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            return (data || []) as unknown as StockMovement[];
        } catch (error: unknown) {
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
            const activeStoreId = getActiveStoreId();
            if (!activeStoreId) return false;

            const { data, error } = await supabase.rpc('product_has_movements', {
                p_product_id: productId,
            });

            if (error) throw error;
            return data || false;
        } catch (error: unknown) {
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
