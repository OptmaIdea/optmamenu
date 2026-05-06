import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logAction } from '@/pages/private/admin/products/products/utils/securityLog';
import type { Category } from '../types/category.types';
import { getActiveStoreId } from '@/utils/activeStore';

export const useCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                throw new Error('Nenhuma loja ativa selecionada.');
            }

            const { data: categoriesData, error: categoriesError } = await supabase
                .from('categories')
                .select(`
                    *,
                    products:products(count)
                `)
                .eq('store_id', activeStoreId)
                .order('sort_order', { ascending: true });

            if (categoriesError) throw categoriesError;

            const parsedData: Category[] = categoriesData?.map(cat => ({
                ...cat,
                price_rules: typeof cat.price_rules === 'string' ? JSON.parse(cat.price_rules) : cat.price_rules,
                products_count: cat.products?.[0]?.count || 0
            })) || [];

            setCategories(parsedData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching categories:', error);
            toast.error('Erro ao carregar categorias');
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteCategory = useCallback(async (category: Category): Promise<boolean> => {
        try {
            // 1. Verificar se há produtos vinculados
            const { count } = await supabase
                .from('products')
                .select('*', { count: 'exact', head: true })
                .eq('category_id', category.id);

            if (count && count > 0) {
                toast.error('Não é possível excluir categorias com produtos vinculados.');
                return false;
            }

            // 2. Apagar imagem do storage (se existir)
            if (category.image_url) {
                try {
                    const urlObj = new URL(category.image_url);
                    const parts = urlObj.pathname.split('/category-images/');
                    if (parts.length > 1) {
                        await supabase.storage.from('category-images').remove([parts[1]]);
                    }
                } catch (e) {
                    console.error('Erro ao remover imagem:', e);
                }
            }

            // 3. Excluir categoria
            const { error } = await supabase
                .from('categories')
                .delete()
                .eq('id', category.id);

            if (error) throw error;

            await logAction(
                'Excluir Categoria',
                { category_id: category.id, name: category.name },
                'success'
            );

            toast.success('Categoria excluída com sucesso!');
            return true;
        } catch (error: any) {
            console.error('Error deleting category:', error);
            await logAction(
                'Excluir Categoria',
                { category_id: category.id, name: category.name, error: error.message },
                'failure'
            );
            toast.error('Erro ao excluir categoria');
            return false;
        }
    }, []);

    const refresh = useCallback(() => {
        fetchCategories();
    }, [fetchCategories]);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    return {
        categories,
        loading,
        deletingId,
        lastUpdated,
        deleteCategory,
        refresh,
    };
};
