import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getActiveStoreId } from '@/utils/activeStore';
import type { MediaItem } from '@/pages/private/admin/products/products/hooks/useProductImages';
import type { PriceRule } from '../types/product.types';


interface SaveParams {
    productId: string;
    name: string;
    description: string;
    price: string;
    categoryId: string | null;
    active: boolean;
    mediaItems: MediaItem[];
    imagesToDelete: string[];
    pricingMode: 'inherit' | 'custom';
    priceLogicType: 'standard' | 'category_volume';
    priceRules: PriceRule[];
    stockQuantity: number;
    minStock: number;
    maxStock: number;
    isEditing: boolean;
    canManageProducts: boolean;
    onSuccess: () => void;
    onClose: () => void;
}

export const useProductSave = () => {
    const [saving, setSaving] = useState(false);

    const handleSave = async ({
        productId,
        name,
        description,
        price,
        categoryId,
        active,
        mediaItems,
        imagesToDelete,
        pricingMode,
        priceLogicType,
        priceRules,
        stockQuantity,
        minStock,
        maxStock,
        isEditing,
        canManageProducts,
        onSuccess,
        onClose,
    }: SaveParams) => {
        if (!canManageProducts) {
            toast.error('Você não tem permissão para gerenciar produtos.');
            return;
        }

        const activeStoreId = getActiveStoreId();

        if (!activeStoreId) {
            toast.error('Nenhuma loja ativa selecionada.');
            return;
        }

        setSaving(true);
        const uploadedPaths: string[] = [];

        try {
            // 1. Processar imagens novas
            const finalImageUrls: string[] = [];

            for (const item of mediaItems) {
                if (item.type === 'url') {
                    finalImageUrls.push(item.value as string);
                } else if (item.type === 'file') {
                    const file = item.value as File;
                    const fileExt = file.name.split('.').pop();
                    const fileName = `${activeStoreId}/${productId}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
                    const { error: uploadError } = await supabase.storage
                        .from('products')
                        .upload(fileName, file);
                    if (uploadError) throw uploadError;
                    const { data: { publicUrl } } = supabase.storage
                        .from('products')
                        .getPublicUrl(fileName);
                    finalImageUrls.push(publicUrl);
                    uploadedPaths.push(fileName);
                }
            }

            // 2. Preparar payload base
            const basePayload = {
                name,
                description,
                price: parseFloat(price.replace(',', '.')) || 0,
                category_id: categoryId || null,
                active,
                images: finalImageUrls,
                use_category_pricing: pricingMode === 'inherit',
                price_logic_type: priceLogicType,
                price_rules: priceRules,
                stock_quantity: stockQuantity || 0,
                min_stock: minStock || 0,
                max_stock: maxStock || 0,
            };

            // 3. Salvar no banco (INSERT ou UPDATE separados)
            if (!isEditing) {
                // INSERT: inclui id e store_id
                const insertPayload = {
                    ...basePayload,
                    id: productId,
                    store_id: activeStoreId,
                };
                const { error } = await supabase
                    .from('products')
                    .insert(insertPayload);
                if (error) throw error;
            } else {
                // UPDATE: filtra pela loja ativa para evitar edição cruzada
                const { data, error } = await supabase
                    .from('products')
                    .update(basePayload)
                    .eq('id', productId)
                    .eq('store_id', activeStoreId)
                    .select('id, name')
                    .maybeSingle();

                if (error) {
                    console.error('Erro ao salvar produto:', error);
                    throw new Error('Não foi possível salvar o produto.');
                }

                if (!data) {
                    throw new Error(
                        'Nenhum produto foi alterado. Verifique se o produto pertence à loja ativa ou se há permissão para editar.'
                    );
                }
            }

            // 4. Limpar imagens removidas
            if (imagesToDelete.length > 0) {
                const pathsToDelete = imagesToDelete
                    .map(url => {
                        try {
                            const urlObj = new URL(url);
                            const parts = urlObj.pathname.split('/products/');
                            return parts.length > 1 ? parts[1] : null;
                        } catch { return null; }
                    })
                    .filter((p): p is string => p !== null);
                if (pathsToDelete.length > 0) {
                    await supabase.storage.from('products').remove(pathsToDelete);
                }
            }

            toast.success(isEditing ? '✅ Produto atualizado com sucesso!' : '🎉 Produto criado com sucesso!');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error('Erro ao salvar: ' + error.message);
            // Rollback das imagens enviadas em caso de erro
            if (uploadedPaths.length > 0) {
                await supabase.storage.from('products').remove(uploadedPaths);
            }
        } finally {
            setSaving(false);
        }
    };

    return { saving, handleSave };
};