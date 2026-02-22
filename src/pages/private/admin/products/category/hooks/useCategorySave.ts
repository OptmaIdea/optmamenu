import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import type { CategoryFormData } from '../types/category.types';

interface SaveParams {
    storeId: string;
    categoryId?: string; // se fornecido, é edição; senão, criação
    formData: CategoryFormData;
    imageFile?: File | null; // arquivo de imagem para upload (substitui image_url se fornecido)
    onSuccess: () => void;
}

export const useCategorySave = () => {
    const [saving, setSaving] = useState(false);

    const uploadImage = async (file: File, storeId: string, categoryId: string): Promise<string | null> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${storeId}/${categoryId}/cover.${fileExt}`; // único por categoria
            const { error: uploadError } = await supabase.storage
                .from('category-images')
                .upload(fileName, file, { upsert: true }); // sobrescreve se já existir

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('category-images')
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
            const parts = urlObj.pathname.split('/category-images/');
            if (parts.length > 1) {
                await supabase.storage.from('category-images').remove([parts[1]]);
            }
        } catch (e) {
            console.error('Erro ao remover imagem:', e);
        }
    };

    const handleSave = async ({
        storeId,
        categoryId,
        formData,
        imageFile,
        onSuccess,
    }: SaveParams) => {
        setSaving(true);
        let uploadedImageUrl: string | null = null;

        try {
            // 1. Se houver um novo arquivo de imagem, faz o upload e obtém a URL
            if (imageFile) {
                const tempId = categoryId || uuidv4(); // usa o ID existente ou gera um temporário
                uploadedImageUrl = await uploadImage(imageFile, storeId, tempId);
                if (!uploadedImageUrl) throw new Error('Falha no upload da imagem');
            }

            // 2. Prepara o payload
            const payload = {
                store_id: storeId,
                name: formData.name,
                description: formData.description,
                sort_order: formData.sort_order,
                active: formData.active,
                price_logic_type: formData.price_logic_type,
                price_rules: formData.price_rules,
                image_url: uploadedImageUrl || formData.image_url || null,
            };

            // 3. Se for edição, inclui o id
            let query;
            if (categoryId) {
                query = supabase
                    .from('categories')
                    .update(payload)
                    .eq('id', categoryId)
                    .select();
            } else {
                query = supabase
                    .from('categories')
                    .insert([payload])
                    .select();
            }

            const { error } = await query.maybeSingle();
            if (error) throw error;

            // 4. Se a categoria antiga tinha uma imagem e foi substituída, remove a antiga
            if (categoryId && formData.image_url && uploadedImageUrl && formData.image_url !== uploadedImageUrl) {
                await deleteImage(formData.image_url);
            }

            toast.success(categoryId ? 'Categoria atualizada com sucesso!' : 'Categoria criada com sucesso!');
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