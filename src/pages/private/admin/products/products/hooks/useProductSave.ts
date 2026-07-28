import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { getActiveStoreId } from '@/utils/activeStore';
import { optimizeImageForUpload, createSafeImageFilename, IMAGE_PROFILES } from '@/utils/imageOptimization';
import type { MediaItem } from '@/pages/private/admin/products/products/hooks/useProductImages';
import type { PriceRule } from '../types/product.types';

type ProductCodeInput = {
    type: 'internal' | 'sku' | 'ean';
    value: string;
};

function normalizeProductCode(value: string): string {
    return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

async function syncProductCodes(
    storeId: string,
    productId: string,
    productCodes: ProductCodeInput[]
) {
    const desired = productCodes
        .map((code) => ({ ...code, value: code.value.trim(), normalized: normalizeProductCode(code.value) }))
        .filter((code) => code.value && code.normalized);

    const normalizedCodes = desired.map((code) => code.normalized);
    if (normalizedCodes.length > 0) {
        const { data: conflicts, error: conflictError } = await supabase
            .from('product_codes')
            .select('id, product_id, normalized_code')
            .eq('store_id', storeId)
            .in('normalized_code', normalizedCodes);
        if (conflictError) throw conflictError;
        const conflict = (conflicts ?? []).find((row) => row.product_id !== productId);
        if (conflict) {
            throw new Error('SKU, EAN ou código interno já está vinculado a outro produto.');
        }
    }

    const { data: existing, error: existingError } = await supabase
        .from('product_codes')
        .select('id, code_type')
        .eq('store_id', storeId)
        .eq('product_id', productId)
        .in('code_type', ['internal', 'sku', 'ean']);
    if (existingError) throw existingError;

    await supabase
        .from('product_codes')
        .update({ is_primary: false })
        .eq('store_id', storeId)
        .eq('product_id', productId);

    const primaryType = desired.find((code) => code.type === 'internal')?.type
        ?? desired.find((code) => code.type === 'sku')?.type
        ?? desired[0]?.type;

    for (const code of desired) {
        const current = (existing ?? []).find((row) => row.code_type === code.type);
        const payload = {
            code_value: code.value,
            is_primary: code.type === primaryType,
            active: true,
        };
        if (current) {
            const { error } = await supabase
                .from('product_codes')
                .update(payload)
                .eq('id', current.id)
                .eq('store_id', storeId);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('product_codes').insert({
                store_id: storeId,
                product_id: productId,
                code_type: code.type,
                ...payload,
            });
            if (error) throw error;
        }
    }

    const desiredTypes = new Set(desired.map((code) => code.type));
    const idsToDelete = (existing ?? [])
        .filter((row) => !desiredTypes.has(row.code_type as ProductCodeInput['type']))
        .map((row) => row.id);
    if (idsToDelete.length > 0) {
        const { error } = await supabase
            .from('product_codes')
            .delete()
            .eq('store_id', storeId)
            .in('id', idsToDelete);
        if (error) throw error;
    }
}



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
    productCodes: ProductCodeInput[];
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
        stockQuantity: _stockQuantity,
        minStock,
        maxStock,
        productCodes,
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
                    const rawFile = item.value as File;
                    const optimizedResult = await optimizeImageForUpload(rawFile, IMAGE_PROFILES.product);
                    const safeName = createSafeImageFilename(rawFile.name, 'product');
                    const fileName = `${activeStoreId}/${productId}/${safeName}`;

                    const { error: uploadError } = await supabase.storage
                        .from('products')
                        .upload(fileName, optimizedResult.file, {
                            contentType: 'image/webp',
                            cacheControl: '31536000',
                            upsert: false,
                        });

                    if (uploadError) throw uploadError;

                    const { data: { publicUrl } } = supabase.storage
                        .from('products')
                        .getPublicUrl(fileName);

                    finalImageUrls.push(publicUrl);
                    uploadedPaths.push(fileName);
                }
            }

            // 2. Preparar payload base (apenas campos cadastrais permitidos)
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
                    throw error;
                }

                if (!data) {
                    throw new Error(
                        'Nenhum produto foi alterado. Verifique se o produto pertence à loja ativa ou se há permissão para editar.'
                    );
                }
            }

            await syncProductCodes(activeStoreId, productId, productCodes);

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
            const rawMessage = error?.message || '';
            if (rawMessage.includes('P0001') || rawMessage.includes('stock_quantity')) {
                toast.error('O saldo de estoque não pode ser alterado pelo cadastro do produto. Use a tela de movimentações de estoque.');
            } else {
                toast.error('Erro ao salvar: ' + rawMessage);
            }

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