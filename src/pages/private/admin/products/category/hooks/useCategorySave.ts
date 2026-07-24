import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { getActiveStoreId } from '@/utils/activeStore';
import type { CategoryFormData } from '../types/category.types';

interface SaveParams {
    storeId: string;
    categoryId?: string;
    formData: CategoryFormData;
    imageFile?: File | null;
    onSuccess: () => void;
}

const CATEGORY_IMAGE_BUCKET = 'products';

export const useCategorySave = () => {
    const [saving, setSaving] = useState(false);

    const uploadImage = async (file: File, activeStoreId: string, categoryId: string): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || 'webp';
            const uniqueName = `${Date.now()}-${uuidv4()}.${fileExt}`;
            const fileName = `${activeStoreId}/categories/${categoryId}/${uniqueName}`;
            const { error: uploadError } = await supabase.storage
                .from(CATEGORY_IMAGE_BUCKET)
                .upload(fileName, file, {
                    upsert: false,
                    cacheControl: '3600',
                    contentType: file.type || undefined,
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from(CATEGORY_IMAGE_BUCKET)
                .getPublicUrl(fileName);

            return publicUrl;
        } catch (error) {
            console.error('Erro ao fazer upload da imagem:', error);
            toast.error('Erro ao enviar imagem');
            return null;
        }
    };

    const deleteImage = async (imageUrl: string): Promise<void> => {
        try {
            const urlObj = new URL(imageUrl);
            const productsMarker = '/products/';
            const categoryMarker = '/category-images/';

            if (urlObj.pathname.includes(productsMarker)) {
                const path = urlObj.pathname.split(productsMarker)[1];
                if (path) await supabase.storage.from('products').remove([path]);
                return;
            }

            if (urlObj.pathname.includes(categoryMarker)) {
                const path = urlObj.pathname.split(categoryMarker)[1];
                if (path) await supabase.storage.from('category-images').remove([path]);
            }
        } catch (error) {
            console.error('Erro ao remover imagem:', error);
        }
    };

    const handleSave = async ({
        categoryId,
        formData,
        imageFile,
        onSuccess,
    }: Omit<SaveParams, 'storeId'>) => {
        const activeStoreId = getActiveStoreId();

        if (!activeStoreId) {
            toast.error('Nenhuma loja ativa selecionada.');
            return;
        }

        setSaving(true);
        let uploadedImageUrl: string | null = null;

        try {
            if (imageFile) {
                const tempId = categoryId || uuidv4();
                uploadedImageUrl = await uploadImage(imageFile, activeStoreId, tempId);
                if (!uploadedImageUrl) throw new Error('Falha no upload da imagem');
            }

            const basePayload = {
                name: formData.name,
                description: formData.description,
                sort_order: formData.sort_order,
                active: formData.active,
                price_logic_type: formData.price_logic_type,
                price_rules: formData.price_rules,
                pricing_strategy: formData.pricing_strategy,
                image_url: uploadedImageUrl || formData.image_url || null,
            };

            if (!categoryId) {
                const insertPayload = { ...basePayload, store_id: activeStoreId };
                const { error } = await supabase.from('categories').insert([insertPayload]);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('categories')
                    .update(basePayload)
                    .eq('id', categoryId)
                    .eq('store_id', activeStoreId)
                    .select('id, name')
                    .maybeSingle();
                if (error) throw error;
                if (!data) {
                    throw new Error('Nenhuma categoria foi alterada. Verifique a loja ativa e sua permissão.');
                }
            }

            if (categoryId && formData.image_url && uploadedImageUrl && formData.image_url !== uploadedImageUrl) {
                await deleteImage(formData.image_url);
            }

            onSuccess();
        } catch (error: any) {
            console.error('Erro ao salvar categoria:', error);
            toast.error('Erro ao salvar: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    return { saving, handleSave };
};
