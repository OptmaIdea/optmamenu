import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';
import { useStockMovement } from '@/pages/private/admin/products/inventory/hooks/useStockMovement';
import type { AdjustmentType } from '../types/inventory.types';

interface AdjustmentResult {
    success: boolean;
    message?: string;
}

export const useStockAdjustment = () => {
    const [processing, setProcessing] = useState(false);
    const { registerMovement } = useStockMovement();

    const performAdjustment = async (
        productId: string,
        quantity: number,
        reason: string,
        type: AdjustmentType,
        supplierId?: string
    ): Promise<AdjustmentResult> => {
        setProcessing(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Usuário não autenticado');

            // 1. Fetch current stock for validation
            const { data: product, error: fetchError } = await supabase
                .from('products')
                .select('stock_quantity')
                .eq('id', productId)
                .single();

            if (fetchError || !product) {
                throw new Error('Produto não encontrado');
            }

            // 2. Validate stock for exit
            if (type === 'exit') {
                const newStock = product.stock_quantity - quantity;
                if (newStock < 0) {
                    return { success: false, message: 'Estoque insuficiente para esta saída.' };
                }
            }

            // 3. Register movement in stock_movements table
            // The trigger will automatically update products.stock_quantity
            const success = await registerMovement({
                productId,
                quantity: quantity,
                type: type,
                reason: reason || undefined,
                supplierId: supplierId || undefined,
            });

            if (!success) {
                throw new Error('Falha ao registrar movimentação');
            }

            // 4. Log success
            await logAction(
                `Ajuste de Estoque - ${type === 'entry' ? 'Entrada' : 'Saída'}`,
                { product_id: productId, quantity: type === 'entry' ? quantity : -quantity, reason },
                'success'
            );

            toast.success('Estoque atualizado com sucesso!');
            return { success: true };
        } catch (error: any) {
            console.error('Erro no ajuste:', error);
            toast.error('Erro ao atualizar estoque: ' + error.message);
            return { success: false, message: error.message };
        } finally {
            setProcessing(false);
        }
    };

    return { processing, performAdjustment };
};