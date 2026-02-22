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
            const { data: store } = await supabase
                .from('stores')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
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
            const { data: store } = await supabase
                .from('stores')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();
            if (!store) throw new Error('Loja não encontrada');
            const { data, error } = await supabase
                .from('categories')
                .insert([{ name, store_id: store.id }])
                .select()
                .maybeSingle();
            if (error) throw error;
            setCategories(prev => [...prev, data]);
            setCategoryId(data.id);
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