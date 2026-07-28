import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Product, DisplayStockStatus } from '@/pages/private/admin/products/products/types/product.types';
import { getActiveStoreId } from '@/utils/activeStore';

export interface ProductDetailStockManagement {
    display_on_hand: number;
    display_reserved: number;
    display_available: number;
    display_stock_status: DisplayStockStatus;
    global_on_hand: number;
    global_reserved: number;
    global_available: number;
    global_min_stock: number;
    global_max_stock: number;
    global_status: string;
    recommended_action: string;
    total_locations: number;
    active_locations: number;
    sales_locations: number;
    location_stockout_count: number;
    location_critical_count: number;
    location_excess_count: number;
    locations_with_available_stock: number;
    possible_source_locations: number;
    alert_locations: any[];
}

export interface UseProductDetailResult {
    product: Product | null;
    stockManagement: ProductDetailStockManagement | null;
    loading: boolean;
    error: string | null;
    errorType: 'not_found' | 'fetch_error' | null;
    refetch: () => Promise<void>;
}

export function useProductDetail(productId: string | undefined): UseProductDetailResult {
    const [product, setProduct] = useState<Product | null>(null);
    const [stockManagement, setStockManagement] = useState<ProductDetailStockManagement | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [errorType, setErrorType] = useState<'not_found' | 'fetch_error' | null>(null);

    const fetchProductDetail = useCallback(async () => {
        if (!productId) {
            setProduct(null);
            setStockManagement(null);
            setLoading(false);
            setErrorType('not_found');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            setErrorType(null);

            const activeStoreId = getActiveStoreId();
            if (!activeStoreId) {
                setError('Nenhuma loja ativa selecionada.');
                setErrorType('not_found');
                setLoading(false);
                return;
            }

            // 1. Busca produto por id e store_id com colunas explícitas
            const { data: productRaw, error: productError } = await supabase
                .from('products')
                .select(`
                  id,
                  store_id,
                  category_id,
                  name,
                  description,
                  price,
                  active,
                  is_discontinued,
                  images,
                  use_category_pricing,
                  price_logic_type,
                  price_rules,
                  min_stock,
                  max_stock,
                  last_sale_at,
                  last_stock_entry_at,
                  created_at,
                  product_codes(id, code_type, code_value, normalized_code, is_primary, active),
                  category:categories(id, name, price_logic_type, price_rules)
                `)
                .eq('id', productId)
                .eq('store_id', activeStoreId)
                .maybeSingle();

            if (productError) throw productError;

            // Validação de segurança adicional: se o produto não existir ou pertencer a outra loja
            if (!productRaw || (productRaw as any).store_id !== activeStoreId) {
                setProduct(null);
                setStockManagement(null);
                setErrorType('not_found');
                setLoading(false);
                return;
            }

            const p: any = productRaw;

            // Parse de imagens
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

            // Parse de categoria
            const rawCategory: any = Array.isArray(p.category) ? p.category[0] : p.category;
            const categoryParsed = rawCategory
                ? {
                    id: rawCategory.id,
                    name: rawCategory.name,
                    price_logic_type: rawCategory.price_logic_type,
                    price_rules: typeof rawCategory.price_rules === 'string'
                        ? JSON.parse(rawCategory.price_rules)
                        : rawCategory.price_rules,
                }
                : undefined;

            // 2. Busca diagnóstico gerencial de estoque por RPC
            let mgmtData: ProductDetailStockManagement | null = null;

            const { data: stockMgmtRows, error: stockMgmtError } = await supabase.rpc(
                'get_product_stock_management',
                { p_product_id: productId }
            );

            if (!stockMgmtError && Array.isArray(stockMgmtRows) && stockMgmtRows.length > 0) {
                const row: any = stockMgmtRows[0];
                const globalOnHand = Number(row.global_on_hand ?? 0);
                const globalReserved = Number(row.global_reserved ?? 0);
                const globalAvailable = Number(row.global_available ?? 0);

                const displayStockStatus: DisplayStockStatus =
                    row.global_status === 'product_inactive'
                        ? 'inactive'
                        : row.global_status === 'global_stockout'
                            ? 'out'
                            : row.global_status === 'global_critical'
                                ? 'low'
                                : row.global_status === 'global_attention'
                                    ? 'attention'
                                    : row.global_status === 'global_excess'
                                        ? 'over'
                                        : 'ok';

                mgmtData = {
                    display_on_hand: globalOnHand,
                    display_reserved: globalReserved,
                    display_available: globalAvailable,
                    display_stock_status: displayStockStatus,
                    global_on_hand: globalOnHand,
                    global_reserved: globalReserved,
                    global_available: globalAvailable,
                    global_min_stock: Number(row.global_min_stock ?? p.min_stock ?? 0),
                    global_max_stock: Number(row.global_max_stock ?? p.max_stock ?? 0),
                    global_status: row.global_status ?? 'global_ok',
                    recommended_action: row.recommended_action ?? 'ok',
                    total_locations: Number(row.total_locations ?? stockMgmtRows.length),
                    active_locations: Number(row.active_locations ?? 0),
                    sales_locations: Number(row.sales_locations ?? 0),
                    location_stockout_count: Number(row.location_stockout_count ?? 0),
                    location_critical_count: Number(row.location_critical_count ?? 0),
                    location_excess_count: Number(row.location_excess_count ?? 0),
                    locations_with_available_stock: Number(row.locations_with_available_stock ?? 0),
                    possible_source_locations: Number(row.possible_source_locations ?? 0),
                    alert_locations: Array.isArray(row.alert_locations) ? row.alert_locations : [],
                };
            } else {
                // Fallback para get_inventory_management_products se get_product_stock_management falhar ou não retornar linha
                const { data: managementRows } = await supabase.rpc(
                    'get_inventory_management_products',
                    {
                        p_store_id: activeStoreId,
                        p_recommended_action: null,
                        p_limit: 1000,
                    }
                );
                const management = (managementRows || []).find((row: any) => row.product_id === productId);
                if (management) {
                    const globalOnHand = Number(management.global_on_hand ?? 0);
                    const globalReserved = Number(management.global_reserved ?? 0);
                    const globalAvailable = Number(management.global_available ?? 0);

                    mgmtData = {
                        display_on_hand: globalOnHand,
                        display_reserved: globalReserved,
                        display_available: globalAvailable,
                        display_stock_status:
                            management.global_status === 'product_inactive'
                                ? 'inactive'
                                : management.global_status === 'global_stockout'
                                    ? 'out'
                                    : management.global_status === 'global_critical'
                                        ? 'low'
                                        : management.global_status === 'global_attention'
                                            ? 'attention'
                                            : management.global_status === 'global_excess'
                                                ? 'over'
                                                : 'ok',
                        global_on_hand: globalOnHand,
                        global_reserved: globalReserved,
                        global_available: globalAvailable,
                        global_min_stock: Number(management.global_min_stock ?? p.min_stock ?? 0),
                        global_max_stock: Number(management.global_max_stock ?? p.max_stock ?? 0),
                        global_status: management.global_status ?? 'global_ok',
                        recommended_action: management.recommended_action ?? 'ok',
                        total_locations: Number(management.total_locations ?? 0),
                        active_locations: Number(management.active_locations ?? 0),
                        sales_locations: Number(management.sales_locations ?? 0),
                        location_stockout_count: Number(management.location_stockout_count ?? 0),
                        location_critical_count: Number(management.location_critical_count ?? 0),
                        location_excess_count: Number(management.location_excess_count ?? 0),
                        locations_with_available_stock: Number(management.locations_with_available_stock ?? 0),
                        possible_source_locations: Number(management.possible_source_locations ?? 0),
                        alert_locations: Array.isArray(management.alert_locations) ? management.alert_locations : [],
                    };
                }
            }

            // Fallback para last_sale_at via movimentações ESTRITAMENTE DE VENDA se a coluna do produto estiver vazia
            if (!p.last_sale_at) {
                try {
                    const { data: exitMovements } = await supabase
                        .from('stock_movements')
                        .select('created_at, source, order_id, type, reason, reason_code')
                        .eq('store_id', activeStoreId)
                        .eq('product_id', productId)
                        .eq('type', 'exit')
                        .order('created_at', { ascending: false })
                        .limit(50);

                    if (Array.isArray(exitMovements) && exitMovements.length > 0) {
                        const actualSaleMovement = exitMovements.find((m: any) => {
                            const source = String(m.source ?? '').toLowerCase();
                            const reason = String(m.reason ?? '').toLowerCase();
                            const reasonCode = String(m.reason_code ?? '').toLowerCase();
                            return (
                                Boolean(m.order_id) ||
                                ['order', 'public_order', 'direct_sale', 'pos_sale', 'sale', 'sales'].includes(source) ||
                                reason.includes('venda') ||
                                reason.includes('sale') ||
                                reasonCode.includes('venda') ||
                                reasonCode.includes('sale')
                            );
                        });

                        if (actualSaleMovement?.created_at) {
                            p.last_sale_at = actualSaleMovement.created_at;
                        }
                    }
                } catch (e) {
                    console.warn('Erro ao buscar movimentações de venda em stock_movements:', e);
                }
            }

            // Consultar locais realmente ATIVOS em stock_locations para a loja ativa
            const activeLocationSet = new Set<string>();
            try {
                const { data: activeLocs } = await supabase
                    .from('stock_locations')
                    .select('id')
                    .eq('store_id', activeStoreId)
                    .eq('active', true);

                if (Array.isArray(activeLocs)) {
                    activeLocs.forEach((loc: any) => {
                        if (loc.id) activeLocationSet.add(loc.id);
                    });
                }
            } catch (e) {
                console.warn('Erro ao consultar stock_locations ativas:', e);
            }

            const activeLocationsRegistered = activeLocationSet.size;

            // Consultar posições do produto em inventory_location_balances e deduplicar por location_id
            let locationsWithPositionCount = 0;
            let locationsWithAvailableStockCount = 0;

            try {
                const { data: locBalances } = await supabase
                    .from('inventory_location_balances')
                    .select('location_id, on_hand, available')
                    .eq('store_id', activeStoreId)
                    .eq('product_id', productId);

                if (Array.isArray(locBalances)) {
                    const positionLocationSet = new Set<string>();
                    const availableLocationSet = new Set<string>();

                    locBalances.forEach((row: any) => {
                        // Considerar apenas locais que estejam ATIVOS no cadastro da loja
                        if (row.location_id && (activeLocationSet.size === 0 || activeLocationSet.has(row.location_id))) {
                            positionLocationSet.add(row.location_id);
                            const avail = Number(row.available ?? row.on_hand ?? 0);
                            if (avail > 0) {
                                availableLocationSet.add(row.location_id);
                            }
                        }
                    });

                    locationsWithPositionCount = positionLocationSet.size;
                    locationsWithAvailableStockCount = availableLocationSet.size;
                }
            } catch (e) {
                console.warn('Erro ao consultar inventory_location_balances:', e);
            }

            const parsedProduct: Product = {
                ...p,
                price_rules: typeof p.price_rules === 'string' ? JSON.parse(p.price_rules) : p.price_rules,
                images: Array.isArray(parsedImages) ? parsedImages : [],
                codes: Array.isArray(p.product_codes)
                    ? p.product_codes.filter((code: any) => code.active !== false)
                    : [],
                category: categoryParsed,
                display_on_hand: mgmtData?.display_on_hand ?? 0,
                display_reserved: mgmtData?.display_reserved ?? 0,
                display_available: mgmtData?.display_available ?? 0,
                display_stock_status: mgmtData?.display_stock_status ?? 'ok',
                global_on_hand: mgmtData?.global_on_hand ?? 0,
                global_reserved: mgmtData?.global_reserved ?? 0,
                global_available: mgmtData?.global_available ?? 0,
                global_min_stock: mgmtData?.global_min_stock ?? p.min_stock ?? 0,
                global_max_stock: mgmtData?.global_max_stock ?? p.max_stock ?? 0,
                global_status: (mgmtData?.global_status as any) ?? 'global_ok',
                recommended_action: (mgmtData?.recommended_action as any) ?? 'ok',
                total_locations: mgmtData?.total_locations ?? activeLocationsRegistered,
                active_locations: Math.max(mgmtData?.active_locations ?? 0, locationsWithPositionCount),
                active_locations_registered: activeLocationsRegistered,
                locations_with_position: locationsWithPositionCount,
                sales_locations: mgmtData?.sales_locations ?? 0,
                location_stockout_count: mgmtData?.location_stockout_count ?? 0,
                location_critical_count: mgmtData?.location_critical_count ?? 0,
                location_excess_count: mgmtData?.location_excess_count ?? 0,
                locations_with_available_stock: Math.max(mgmtData?.locations_with_available_stock ?? 0, locationsWithAvailableStockCount),
                possible_source_locations: mgmtData?.possible_source_locations ?? 0,
                alert_locations: mgmtData?.alert_locations ?? [],
            };

            setProduct(parsedProduct);
            setStockManagement(mgmtData);
        } catch (err: any) {
            console.error('Erro ao carregar detalhes do produto:', err);
            setError(err.message || 'Erro ao carregar detalhes do produto');
            setErrorType('fetch_error');
            setProduct(null);
            setStockManagement(null);
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => {
        fetchProductDetail();
    }, [fetchProductDetail]);

    return {
        product,
        stockManagement,
        loading,
        error,
        errorType,
        refetch: fetchProductDetail,
    };
}
