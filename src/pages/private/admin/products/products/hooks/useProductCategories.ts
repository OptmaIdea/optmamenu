import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category } from '../types/product.types';
import { toast } from 'sonner';

export const useProductCategories = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [categoryId, setCategoryId] = useState('');
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [storeId, setStoreId] = useState<string | null>(null);

    const fetchCategories = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: storeData, error } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (error || !storeData) return;
            const store = Array.isArray(storeData) ? storeData[0] : storeData;
            if (store) {
                setStoreId(store.id);
                const { data } = await supabase
                    .from('categories')
                    .select('*')
                    .eq('store_id', store.id)
                    .order('sort_order', { ascending: true });
                if (data) setCategories(data);
            }
        } catch (error) {
            console.error('Erro ao buscar categorias:', error);
        }
    }, []);

    const findCategoryById = useCallback((id: string): Category | undefined => {
        return categories.find(c => c.id === id);
    }, [categories]);

    const createCategory = async (name: string) => {
        if (!name.trim()) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: storeData, error: storeError } = await supabase.rpc(
                'get_user_store_by_id',
                { p_user_id: user.id }
            );
            if (storeError || !storeData) throw new Error('Loja não encontrada');
            const store = Array.isArray(storeData) ? storeData[0] : storeData;
            if (!store) throw new Error('Loja não encontrada');
            const { data: newCategory, error: insertError } = await supabase
                .from('categories')
                .insert([{ name, store_id: store.id }])
                .select()
                .maybeSingle();
            if (insertError) throw insertError;
            setCategories(prev => [...prev, newCategory]);
            setCategoryId(newCategory.id);
            setIsCreatingCategory(false);
            setNewCategoryName('');
        } catch (error) {
            toast.error('Erro ao criar categoria');
        }
    };

    return {
        categories,
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