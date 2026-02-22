import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';
import { extractBucketPathFromUrl, uniqueNonEmpty } from '@/utils/supabaseStorage';

export const useProductDelete = () => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async (product: any, onSuccess: () => void) => {
        setIsDeleting(true);
        try {
            // 1. Verificar movimentações de estoque (PRIORIDADE)
            const { data: movementData } = await supabase.rpc('product_has_movements', {
                p_product_id: product.id,
            });
            const hasMovements = movementData || false;

            // 2. Verificar pedidos
            const { count: orderCount } = await supabase
                .from('order_items')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', product.id);
            const hasOrders = (orderCount ?? 0) > 0;

            // Se tiver movimentações de estoque, NÃO excluir - apenas descontinuar
            if (hasMovements) {
                // Verificar se há estoque
                const { data: productData } = await supabase
                    .from('products')
                    .select('stock_quantity')
                    .eq('id', product.id)
                    .single();

                const hasStock = (productData?.stock_quantity || 0) > 0;

                if (hasStock) {
                    toast.error(
                        'Produto NÃO pode ser excluído/descontinuado pois possui histórico de movimentações e estoque.\n\n' +
                        'Para remover este produto:\n' +
                        '1. Vá em "Controle de Estoque"\n' +
                        '2. Clique em "Saída" para zerar o estoque\n' +
                        '3. O produto será automaticamente descontinuado'
                    );
                    setIsDeleting(false);
                    return;
                }

                // Descontinuar (sem estoque, mas com movimentações)
                const { error } = await supabase
                    .from('products')
                    .update({ is_discontinued: true, active: false })
                    .eq('id', product.id);
                if (error) throw error;
                toast.success('Produto descontinuado (possui histórico de movimentações).');
                await logAction('Descontinuar Produto', { product_id: product.id, name: product.name, reason: 'Histórico de movimentações' }, 'success');
                onSuccess();
                setIsDeleting(false);
                return;
            }

// 3. Se for exclusão permanente, apagar imagens do Storage antes de deletar no banco
// Observação: em descontinuação (por movimentação/pedidos), mantemos imagens para histórico/admin.
let productImages: string[] = Array.isArray(product.images) ? product.images : [];

// Garanta que temos as imagens mais recentes do banco (em listas, às vezes o produto vem sem images)
const { data: freshProduct } = await supabase
    .from('products')
    .select('images')
    .eq('id', product.id)
    .maybeSingle();

if (freshProduct?.images && Array.isArray(freshProduct.images)) {
    productImages = freshProduct.images;
}

const deleteProductImagesFromBucket = async () => {
    if (!productImages?.length) return;
    const bucket = 'products';
    const paths = uniqueNonEmpty(
        productImages.map((url: string) => extractBucketPathFromUrl(url, bucket))
    );
    if (paths.length > 0) {
        const { error: storageError } = await supabase.storage.from(bucket).remove(paths);
        if (storageError) throw storageError;
    }
};

if (hasOrders) {

                // Descontinuar (tem pedidos, mas não tem movimentações de estoque)
                const { error } = await supabase
                    .from('products')
                    .update({ is_discontinued: true, active: false })
                    .eq('id', product.id);
                if (error) throw error;
                toast.success('Produto descontinuado (possui pedidos vinculados).');
                await logAction('Descontinuar Produto', { product_id: product.id, name: product.name, reason: 'Pedidos vinculados' }, 'success');
            } else {
                // Exclusão permanente (sem movimentações e sem pedidos)
                await deleteProductImagesFromBucket();
                const { error } = await supabase
                    .from('products')
                    .delete()
                    .eq('id', product.id);
                if (error) throw error;
                toast.success('Produto excluído permanentemente.');
                await logAction('Excluir Produto', { product_id: product.id, name: product.name }, 'success');
            }
            onSuccess();
        } catch (error: any) {
            toast.error('Erro ao processar: ' + error.message);
            await logAction(
                'Excluir/Descontinuar Produto',
                { product_id: product.id, name: product.name, error: error.message },
                'failure'
            );
        } finally {
            setIsDeleting(false);
        }
    };

    return { handleDelete, isDeleting };
};