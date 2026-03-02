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

const normalizeStore = (storeData: any): StoreLike | null => {
    if (!storeData) return null;
    if (Array.isArray(storeData)) return storeData[0] ?? null;
    return storeData;
};

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
 * Tenta chamar a RPC apply_stock_movement_delta com possíveis assinaturas.
 * Como você não sabe a assinatura exata, tentamos variações comuns de nomes de parâmetros.
 * - Não enviamos parâmetros extras; payload precisa bater com o que existe no Postgres.
 */
const callApplyStockMovementDelta = async (args: {
    storeId: string;
    productId: string;
    type: StockMovementType;
    qty: number; // pode ser abs (positivo) ou signed (fallback)
    reason?: string;
    orderId?: string;
}) => {
    const payloads: Array<Record<string, any>> = [
        // Assinaturas "novas" (mais completas)
        {
            p_store_id: args.storeId,
            p_product_id: args.productId,
            p_type: args.type,
            p_quantity: args.qty,
            p_reason: args.reason ?? null,
            p_order_id: args.orderId ?? null,
        },
        {
            p_store_id: args.storeId,
            p_product_id: args.productId,
            p_type: args.type,
            p_qty: args.qty,
            p_reason: args.reason ?? null,
            p_order_id: args.orderId ?? null,
        },

        // Assinaturas "enxutas" (sem reason/order)
        {
            p_store_id: args.storeId,
            p_product_id: args.productId,
            p_type: args.type,
            p_quantity: args.qty,
        },
        {
            p_store_id: args.storeId,
            p_product_id: args.productId,
            p_type: args.type,
            p_qty: args.qty,
        },

        // Algumas variações de naming (caso o projeto antigo tenha seguido outro padrão)
        {
            store_id: args.storeId,
            product_id: args.productId,
            type: args.type,
            quantity: args.qty,
            reason: args.reason ?? null,
            order_id: args.orderId ?? null,
        },
    ];

    let lastError: any = null;

    for (const payload of payloads) {
        const { data, error } = await supabase.rpc('apply_stock_movement_delta', payload);
        if (!error) return { data, error: null };
        lastError = error;
    }

    return { data: null, error: lastError };
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
            let { error } = await callApplyStockMovementDelta({
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

                error = retry.error;
            }

            if (error) {
                console.error('Erro ao registrar movimentação (RPC):', error);
                throw error;
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

            if (filters.startDate) query = query.gte('created_at', filters.startDate);

            if (filters.endDate) {
                const end = new Date(filters.endDate);
                end.setDate(end.getDate() + 1);
                query = query.lt('created_at', end.toISOString());
            }

            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            const movements: StockMovement[] = (data || []).map((item: any) => ({
                id: item.id,
                product_id: item.product_id,
                product_name: item.products?.name,
                order_id: item.order_id ?? item.source_id ?? null,
                quantity: item.quantity,
                type: item.type,
                reason: item.reason ?? item.reason_code ?? null,
                // compat: alguns schemas têm user_id, outros created_by
                user_id: item.user_id ?? item.created_by ?? null,
                previous_stock: item.previous_stock,
                new_stock: item.new_stock,
                created_at: item.created_at,
            }));

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