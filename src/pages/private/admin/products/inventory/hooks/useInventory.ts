import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { ProductStock } from '../types/inventory.types';

export const useInventory = () => {
    const [products, setProducts] = useState<ProductStock[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchInventory = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: storeData, error: storeError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (storeError || !storeData) {
                setProducts([]);
                return;
            }
            const store = Array.isArray(storeData) ? storeData[0] : storeData;

            // Buscar produtos diretamente da tabela products, excluindo descontinuados
            const { data: productsData, error: productsError } = await supabase
                .from('products')
                .select(`
                    id,
                    store_id,
                    category_id,
                    name,
                    description,
                    price,
                    images,
                    stock_quantity,
                    active,
                    is_discontinued,
                    min_stock,
                    max_stock,
                    created_at
                `)
                .eq('store_id', store.id)
                .eq('is_discontinued', false)
                .eq('active', true)
                .order('name');

            if (productsError) throw productsError;

            // Transformar dados para o formato ProductStock
            const transformedData: ProductStock[] = (productsData || []).map(p => ({
                id: p.id,
                store_id: p.store_id,
                category_id: p.category_id,
                name: p.name,
                description: p.description,
                price: p.price,
                images: p.images,
                physical_stock: p.stock_quantity || 0,
                active: p.active,
                discontinued: p.is_discontinued || false,
                is_discontinued: p.is_discontinued || false,
                reserved_stock: 0,
                available_stock: p.stock_quantity || 0,
                created_at: p.created_at,
            }));

            setProducts(transformedData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Erro ao buscar inventário:', error);
            toast.error('Erro ao carregar estoque');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInventory();

        const channel = supabase
            .channel('inventory-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                fetchInventory
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchInventory]);

    const refresh = useCallback(() => {
        fetchInventory();
    }, [fetchInventory]);

    return {
        products,
        loading,
        lastUpdated,
        refresh,
    };
};