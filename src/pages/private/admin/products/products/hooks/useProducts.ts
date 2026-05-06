import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type { Product, DisplayStockStatus } from '../types/product.types';
import { getActiveStoreId } from '@/utils/activeStore';

export const useProducts = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState(new Date());

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const activeStoreId = getActiveStoreId();

            if (!activeStoreId) {
                throw new Error('Nenhuma loja ativa selecionada.');
            }

            console.log('ACTIVE STORE PRODUCTS:', activeStoreId);

            // Busca principal de produtos (cadastro, categoria, imagens, preço)
            const { data: productsRaw, error: productsError } = await supabase
                .from('products')
                .select(`
          *,
          category:categories(id, name, price_logic_type, price_rules)
        `)
                .eq('store_id', activeStoreId)
                .order('created_at', { ascending: false });

            console.log('PRODUCTS DEBUG:', { data: productsRaw, error: productsError });

            if (productsError) throw productsError;

            // Busca gerencial de estoque (Fase 6)
            const { data: managementRows, error: managementError } = await supabase.rpc(
                'get_inventory_management_products',
                {
                    p_store_id: activeStoreId,
                    p_recommended_action: null,
                    p_limit: 1000,
                }
            );

            if (managementError) {
                console.error('Erro ao carregar diagnóstico gerencial de estoque:', managementError);
            }

            // Mapa de product_id → linha gerencial
            const managementMap = new Map<string, any>(
                (managementRows || []).map((row: any) => [row.product_id, row])
            );

            const parsedData: Product[] = (productsRaw || []).map(p => {
                let parsedImages = p.images;
                if (typeof p.images === 'string') {
                    try {
                        if (p.images.startsWith('{')) {
                            parsedImages = p.images.replace(/^{|}$/g, '').split(',');
                        } else {
                            parsedImages = JSON.parse(p.images);
                        }
                    } catch {
                        parsedImages = [];
                    }
                }

                const management = managementMap.get(p.id);

                const globalOnHand = Number(management?.global_on_hand ?? 0);
                const globalReserved = Number(management?.global_reserved ?? 0);
                const globalAvailable = Number(management?.global_available ?? 0);

                const displayStockStatus: DisplayStockStatus =
                    management?.global_status === 'product_inactive'
                        ? 'inactive'
                        : management?.global_status === 'global_stockout'
                            ? 'out'
                            : management?.global_status === 'global_critical'
                                ? 'low'
                                : management?.global_status === 'global_attention'
                                    ? 'attention'
                                    : management?.global_status === 'global_excess'
                                        ? 'over'
                                        : 'ok';

                return {
                    ...p,

                    price_rules: typeof p.price_rules === 'string'
                        ? JSON.parse(p.price_rules)
                        : p.price_rules,

                    images: Array.isArray(parsedImages) ? parsedImages : [],

                    category: p.category ? {
                        ...p.category,
                        price_rules: typeof p.category.price_rules === 'string'
                            ? JSON.parse(p.category.price_rules)
                            : p.category.price_rules
                    } : undefined,

                    display_on_hand: globalOnHand,
                    display_reserved: globalReserved,
                    display_available: globalAvailable,
                    display_stock_status: displayStockStatus,

                    global_on_hand: globalOnHand,
                    global_reserved: globalReserved,
                    global_available: globalAvailable,
                    global_min_stock: Number(management?.global_min_stock ?? p.min_stock ?? 0),
                    global_max_stock: Number(management?.global_max_stock ?? p.max_stock ?? 0),
                    global_status: management?.global_status,

                    total_locations: Number(management?.total_locations ?? 0),
                    active_locations: Number(management?.active_locations ?? 0),
                    sales_locations: Number(management?.sales_locations ?? 0),
                    location_stockout_count: Number(management?.location_stockout_count ?? 0),
                    location_critical_count: Number(management?.location_critical_count ?? 0),
                    location_excess_count: Number(management?.location_excess_count ?? 0),
                    locations_with_available_stock: Number(management?.locations_with_available_stock ?? 0),
                    possible_source_locations: Number(management?.possible_source_locations ?? 0),
                    alert_locations: Array.isArray(management?.alert_locations)
                        ? management.alert_locations
                        : [],

                    recommended_action: management?.recommended_action ?? 'ok',
                };
            });

            setProducts(parsedData);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Erro ao carregar produtos');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDelete = useCallback(async (product: Product) => {
        if (!confirm('Tem certeza que deseja excluir este produto?')) return;

        setDeletingId(product.id);
        try {
            // Verificar se há movimentações de estoque
            const { data: movementData } = await supabase.rpc('product_has_movements', {
                p_product_id: product.id,
            });
            const hasMovements = movementData || false;

            // Se tiver movimentações, NÃO excluir - produto só pode ser descontinuado
            if (hasMovements) {
                toast.error(
                    'Produto NÃO pode ser excluído pois possui histórico de movimentações. \n\n' +
                    'Para remover este produto, você deve:\n' +
                    '1. Ir em "Controle de Estoque"\n' +
                    '2. Clicar em "Saída" para zerar o estoque\n' +
                    '3. O produto será automaticamente descontinuado'
                );
                setDeletingId(null);
                return;
            }

            // Verificar se há pedidos vinculados
            const { count: orderCount } = await supabase
                .from('order_items')
                .select('*', { count: 'exact', head: true })
                .eq('product_id', product.id);

            if (orderCount && orderCount > 0) {
                // Se tiver pedidos, desativar
                await supabase
                    .from('products')
                    .update({ active: false })
                    .eq('id', product.id);
                setProducts(prev =>
                    prev.map(p => p.id === product.id ? { ...p, active: false } : p)
                );
                toast.success('Produto desativado (possui pedidos vinculados)');
            } else {
                // Delete images from storage
                if (product.store_id) {
                    const folderPath = `${product.store_id}/${product.id}`;
                    const { data: files } = await supabase.storage
                        .from('products')
                        .list(folderPath);
                    if (files?.length) {
                        await supabase.storage
                            .from('products')
                            .remove(files.map(f => `${folderPath}/${f.name}`));
                    }
                }

                await supabase
                    .from('products')
                    .delete()
                    .eq('id', product.id);

                setProducts(prev => prev.filter(p => p.id !== product.id));
                toast.success('Produto excluído com sucesso');
            }
        } catch (error: any) {
            toast.error('Erro ao excluir: ' + error.message);
            console.error(error);
        } finally {
            setDeletingId(null);
        }
    }, []);

    const handleRefresh = useCallback(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    return {
        products,
        loading,
        deletingId,
        lastUpdated,
        handleRefresh,
        handleDelete,
    };
};
