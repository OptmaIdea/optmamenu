import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { MediaItem } from '@/pages/private/admin/products/products/hooks/useProductImages';
import type { PriceRule } from '../types/product.types';

interface SaveParams {
    storeId: string;
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
    onSuccess: () => void;
    onClose: () => void;
}

export const useProductSave = () => {
    const [saving, setSaving] = useState(false);

    const handleSave = async ({
        storeId,
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
        onSuccess,
        onClose,
    }: SaveParams) => {
        if (!storeId) {
            toast.error('Loja não identificada');
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
                    const fileName = `${storeId}/${productId}/${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${fileExt}`;
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

            // 2. Preparar payload
            const payload = {
                id: productId,
                store_id: storeId,
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

            // 3. Salvar no banco (upsert)
            const { error } = await supabase
                .from('products')
                .upsert(payload, { onConflict: 'id' });
            if (error) throw error;

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