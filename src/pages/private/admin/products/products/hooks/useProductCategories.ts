import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category } from '../types/product.types';
import { toast } from 'sonner';
import { getActiveStoreId } from '@/utils/activeStore';

export const useProductCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(false);
    const [categoryId, setCategoryId] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [storeId, setStoreId] = useState<string | null>(null);

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                return;
            }

            setStoreId(activeStoreId);

            const { data, error } = await supabase
                .from('categories')
                .select('id, name, active, sort_order')
                .eq('store_id', activeStoreId)
                .order('sort_order', { ascending: true })
                .order('name', { ascending: true });

            if (error) throw error;
            if (data) setCategories(data as unknown as Category[]);
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCategories();
    }, [fetchCategories]);

    const findCategoryById = useCallback((id: string): Category | undefined => {
        return categories.find(c => c.id === id);
    }, [categories]);

    const createCategory = async (name: string) => {
        if (!name.trim()) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                throw new Error('Nenhuma loja ativa selecionada.');
            }

            const { data: newCategory, error: insertError } = await supabase
                .from('categories')
                .insert([{ name, store_id: activeStoreId }])
                .select('id, name, active, sort_order')
                .maybeSingle();

            if (insertError) throw insertError;
            if (newCategory) {
                setCategories(prev => [...prev, newCategory as unknown as Category]);
                setCategoryId(newCategory.id);
            }
            setIsCreatingCategory(false);
            setNewCategoryName('');
        } catch (error) {
            console.error('Erro ao criar categoria:', error);
            toast.error('Erro ao criar categoria');
        }
    };

    return {
        categories,
        loading,
        categoryId,
        setCategoryId,
        storeId,
        setStoreId,
        isCreatingCategory,
        setIsCreatingCategory,
        newCategoryName,
        setNewCategoryName,
        fetchCategories,
        findCategoryById,
        createCategory,
    };
};
