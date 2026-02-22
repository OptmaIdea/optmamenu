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

export const useStockMovement = () => {
    const [loading, setLoading] = useState(false);

    /**
     * Registra uma nova movimentação de estoque
     * A trigger no banco atualizará automaticamente o estoque do produto
     */
    const registerMovement = async (params: RegisterMovementParams): Promise<boolean> => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Usuário não autenticado');
            }

            // Para entry/cancellation, quantidade deve ser positiva
            // Para exit/confirmation/clearance, quantidade deve ser negativa
            let adjustedQuantity = params.quantity;
            if (params.type === 'reservation') {
                // Reserva é sempre positiva
                adjustedQuantity = Math.abs(params.quantity);
            } else if (params.type === 'entry' || params.type === 'cancellation') {
                // Entrada e cancelamento são positivos
                adjustedQuantity = Math.abs(params.quantity);
            } else if (params.type === 'exit' || params.type === 'confirmation' || params.type === 'clearance') {
                // Saída, confirmação e zeramento são negativos
                adjustedQuantity = -Math.abs(params.quantity);
            }

            const { error } = await supabase
                .from('stock_movements')
                .insert({
                    product_id: params.productId,
                    order_id: params.orderId || null,
                    quantity: adjustedQuantity,
                    type: params.type,
                    reason: params.reason || null,
                    user_id: user.id,
                });

            if (error) {
                console.error('Erro ao registrar movimentação:', error);
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
     * Busca movimentações com filtros e paginação
     */
    const fetchMovements = async (
        filters: StockMovementFilters = {},
        page: number = 1,
        pageSize: number = 50
    ): Promise<FetchMovementsResult> => {
        setLoading(true);
        try {
            let query = supabase
                .from('stock_movements')
                .select(`
                    *,
                    products!inner (
                        name
                    )
                `, { count: 'exact' });

            // Aplicar filtros
            if (filters.productId) {
                query = query.eq('product_id', filters.productId);
            }
            if (filters.type) {
                query = query.eq('type', filters.type);
            }
            if (filters.startDate) {
                query = query.gte('created_at', filters.startDate);
            }
            if (filters.endDate) {
                // Adiciona um dia para incluir o último dia completo
                const end = new Date(filters.endDate);
                end.setDate(end.getDate() + 1);
                query = query.lt('created_at', end.toISOString());
            }

            // Paginação e ordenação
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;

            const { data, error, count } = await query
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            // Transformar dados para o tipo StockMovement
            const movements: StockMovement[] = (data || []).map((item: any) => ({
                id: item.id,
                product_id: item.product_id,
                product_name: item.products?.name,
                order_id: item.order_id,
                quantity: item.quantity,
                type: item.type,
                reason: item.reason,
                user_id: item.user_id,
                previous_stock: item.previous_stock,
                new_stock: item.new_stock,
                created_at: item.created_at,
            }));

            const total = count || 0;
            const hasMore = total > (page * pageSize);

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
     * Busca movimentações de um produto específico
     */
    const getProductMovements = async (productId: string): Promise<StockMovement[]> => {
        try {
            const { data, error } = await supabase
                .from('stock_movements')
                .select('*')
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
     */
    const hasMovements = async (productId: string): Promise<boolean> => {
        try {
            const { data, error } = await supabase.rpc('product_has_movements', {
                p_product_id: productId,
            });

            if (error) throw error;

            return data || false;
        } catch (error: any) {
            console.error('Erro ao verificar movimentações:', error);
            // Fallback: busca direta
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
