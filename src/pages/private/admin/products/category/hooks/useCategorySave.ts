import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import { getActiveStoreId } from '@/utils/activeStore';
import { optimizeImageForUpload, IMAGE_PROFILES } from '@/utils/imageOptimization';
import type { CategoryFormData } from '../types/category.types';

interface SaveParams {
    storeId: string;
    categoryId?: string;
    formData: CategoryFormData;
    imageFile?: File | null;
    onSuccess: () => void;
}

export const useCategorySave = () => {
    const [saving, setSaving] = useState(false);

    const uploadImage = async (file: File, activeStoreId: string, categoryId: string): Promise<string | null> => {
        try {
            const optimized = await optimizeImageForUpload(file, IMAGE_PROFILES.category);
            const fileName = `${activeStoreId}/${categoryId}/category.webp`;

            const { error: uploadError } = await supabase.storage
                .from('category-images')
                .upload(fileName, optimized.file, {
                    upsert: true,
                    cacheControl: '31536000',
                    contentType: 'image/webp',
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('category-images')
                .getPublicUrl(fileName);

            return `${publicUrl}?v=${Date.now()}`;
        } catch (error) {
            console.error('Erro ao fazer upload da imagem de categoria:', error);
            toast.error('Erro ao enviar imagem da categoria');
            return null;
        }
    };

    const deleteImage = async (
        imageUrl: string | null | undefined,
        activeStoreId: string,
        categoryId: string
    ): Promise<void> => {
        const pathsToRemove = new Set<string>([
            `${activeStoreId}/${categoryId}/category.webp`,
        ]);

        if (imageUrl) {
            try {
                const urlObj = new URL(imageUrl);
                const productsMarker = '/products/';
                const categoryMarker = '/category-images/';

                if (urlObj.pathname.includes(productsMarker)) {
                    const legacyProductPath = urlObj.pathname.split(productsMarker)[1];
                    if (legacyProductPath) {
                        const { error } = await supabase.storage
                            .from('products')
                            .remove([decodeURIComponent(legacyProductPath)]);
                        if (error) throw error;
                    }
                } else if (urlObj.pathname.includes(categoryMarker)) {
                    const legacyCategoryPath = urlObj.pathname.split(categoryMarker)[1];
                    if (legacyCategoryPath) {
                        pathsToRemove.add(decodeURIComponent(legacyCategoryPath));
                    }
                }
            } catch (error) {
                if (error instanceof TypeError) {
                    console.warn('URL legada de categoria inválida; removendo pelo caminho determinístico.', imageUrl);
                } else {
                    throw error;
                }
            }
        }

        const { error: removeError } = await supabase.storage
            .from('category-images')
            .remove(Array.from(pathsToRemove));

        if (removeError) throw removeError;
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

            const finalImageUrl = imageFile ? uploadedImageUrl : formData.image_url;

            const basePayload = {
                name: formData.name,
                description: formData.description,
                sort_order: formData.sort_order,
                active: formData.active,
                price_logic_type: formData.price_logic_type,
                price_rules: formData.price_rules,
                pricing_strategy: formData.pricing_strategy,
                image_url: finalImageUrl || null,
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

                // Em uma categoria já existente, salvar sem imagem significa remover
                // o objeto determinístico, mesmo que a URL já tenha sido zerada no formulário.
                if (!finalImageUrl) {
                    await deleteImage(formData.image_url, activeStoreId, categoryId);
                }
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