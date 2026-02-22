import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Product } from '../types/product.types';

export const useProducts = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: store, error: storeError } = await supabase
                .from('stores')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (storeError || !store) {
                console.error('Store not found:', storeError);
                return;
            }

            const { data, error } = await supabase
                .from('products')
                .select(`
          *,
          category:categories(id, name, price_logic_type, price_rules)
        `)
                .eq('store_id', store.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const parsedData: Product[] = data?.map(p => {
                let parsedImages = p.images;
                if (typeof p.images === 'string') {
                    try {
                        if (p.images.startsWith('{')) {
                            parsedImages = p.images.replace(/^{|}$/g, '').split(',');
                        } else {
                            parsedImages = JSON.parse(p.images);
                        }
                    } catch {
                        parsedImages = [];
                    }
                }

                return {
                    ...p,
                    price_rules: typeof p.price_rules === 'string' ? JSON.parse(p.price_rules) : p.price_rules,
                    images: Array.isArray(parsedImages) ? parsedImages : [],
                    category: p.category ? {
                        ...p.category,
                        price_rules: typeof p.category.price_rules === 'string' ? JSON.parse(p.category.price_rules) : p.category.price_rules
                    } : undefined
                };
            }) || [];

            setProducts(parsedData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Erro ao carregar produtos');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDelete = useCallback(async (product: Product) => {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;

        setDeletingId(product.id);
        try {
            // Verificar se há movimentações de estoque
            const { data: movementData } = await supabase.rpc('product_has_movements', {
                p_product_id: product.id,
            });
            const hasMovements = movementData || false;

            // Se tiver movimentações, NÃO excluir - produto só pode ser descontinuado
            if (hasMovements) {
                toast.error(
                    'Produto NÃO pode ser excluído pois possui histórico de movimentações. \n\n' +
                    'Para remover este produto, você deve:\n' +
                    '1. Ir em "Controle de Estoque"\n' +
                    '2. Clicar em "Saída" para zerar o estoque\n' +
                    '3. O produto será automaticamente descontinuado'
                );
                setDeletingId(null);
                return;
            }

            // Verificar se há pedidos vinculados
            const { count: orderCount } = await supabase
                .from('order_items')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', product.id);

            if (orderCount && orderCount > 0) {
                // Se tiver pedidos, desativar
                await supabase
                    .from('products')
                    .update({ active: false })
                    .eq('id', product.id);
                setProducts(prev =>
                    prev.map(p => p.id === product.id ? { ...p, active: false } : p)
                );
                toast.success('Produto desativado (possui pedidos vinculados)');
            } else {
                // Delete images from storage
                if (product.store_id) {
                    const folderPath = `${product.store_id}/${product.id}`;
                    const { data: files } = await supabase.storage
                        .from('products')
                        .list(folderPath);
                    if (files?.length) {
                        await supabase.storage
                            .from('products')
                            .remove(files.map(f => `${folderPath}/${f.name}`));
                    }
                }

                await supabase
                    .from('products')
                    .delete()
                    .eq('id', product.id);

                setProducts(prev => prev.filter(p => p.id !== product.id));
                toast.success('Produto excluído com sucesso');
            }
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message);
            console.error(error);
        } finally {
            setDeletingId(null);
        }
    }, []);

    const handleRefresh = useCallback(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    return {
        products,
        loading,
        deletingId,
        lastUpdated,
        handleRefresh,
        handleDelete,
    };
};