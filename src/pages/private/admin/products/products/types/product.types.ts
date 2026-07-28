// ─── Tipos de status gerencial de estoque (Fase 6) ───────────────────────────

export type InventoryGlobalStatus =
    | 'product_inactive'
    | 'global_stockout'
    | 'global_critical'
    | 'global_attention'
    | 'global_excess'
    | 'global_ok';

export type InventoryRecommendedAction =
    | 'buy'
    | 'transfer'
    | 'transfer_or_redistribute'
    | 'monitor'
    | 'review_excess'
    | 'ok';

export type DisplayStockStatus =
    | 'out'
    | 'low'
    | 'attention'
    | 'ok'
    | 'over'
    | 'inactive';

export interface InventoryAlertLocation {
    location_id: string;
    location_code: string;
    location_name: string;
    location_status: string;
    available: number;
    on_hand: number;
    reserved: number;
    allow_sales: boolean;
    is_default: boolean;
}

export interface ProductCode {
    id: string;
    code_type: string;
    code_value: string;
    normalized_code: string;
    is_primary: boolean;
    active: boolean;
}

// ─── Interface principal de Produto ──────────────────────────────────────────

export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    active: boolean;
    images?: string[];
    codes?: ProductCode[];
    use_category_pricing?: boolean;
    price_logic_type?: 'standard' | 'category_volume';
    price_rules?: any[];
    category?: {
        id: string;
        name: string;
        price_logic_type?: 'standard' | 'category_volume';
        price_rules?: any[];
    };
    store_id: string;

    /**
     * LEGACY:
     * Campo antigo de saldo consolidado.
     * Não usar para regras novas de estoque.
     * A fonte oficial agora é inventory_location_balances / views gerenciais.
     */
    stock_quantity?: number;

    min_stock: number;
    max_stock: number;

    is_discontinued?: boolean;
    last_sale_at?: string;
    last_stock_entry_at?: string;
    created_at?: string;

    // Multiestoque consolidado para exibição
    display_on_hand?: number;
    display_reserved?: number;
    display_available?: number;
    display_stock_status?: DisplayStockStatus;

    // Camada gerencial da Fase 6
    global_on_hand?: number;
    global_reserved?: number;
    global_available?: number;
    global_min_stock?: number;
    global_max_stock?: number;
    global_status?: InventoryGlobalStatus;

    total_locations?: number;
    active_locations?: number;
    active_locations_registered?: number;
    locations_with_position?: number;
    sales_locations?: number;
    location_stockout_count?: number;
    location_critical_count?: number;
    location_excess_count?: number;
    locations_with_available_stock?: number;
    possible_source_locations?: number;
    alert_locations?: InventoryAlertLocation[];

    recommended_action?: InventoryRecommendedAction;
}

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────

export interface PriceRule {
    min: number;
    price: number;
}

export type StockStatus = 'inactive' | 'zero' | 'low' | 'attention' | 'normal' | 'high';

export interface Category {
    id: string;
    name: string;
    store_id?: string;
    active?: boolean;
    sort_order?: number;
    price_logic_type?: 'standard' | 'category_volume';
    price_rules?: any[];
    created_at?: string;
}

// ─── Estatísticas de produtos ─────────────────────────────────────────────────

export interface ProductStats {
    total: number;
    totalActive: number;
    totalInactive: number;
    totalDiscontinued: number;
    totalValue: number;

    zeroStock: number;
    lowStock: number;
    attentionStock: number;
    highStock: number;

    recommendedBuy: number;
    recommendedTransfer: number;
    recommendedMonitor: number;
    recommendedReviewExcess: number;
    recommendedOk: number;

    zeroStockProducts: Product[];
    lowStockProducts: Product[];
    attentionStockProducts: Product[];
    highStockProducts: Product[];
    recommendedBuyProducts: Product[];
    recommendedTransferProducts: Product[];
    discontinuedProducts: Product[];
    allProducts: Product[];
}

// ─── Configuração de ordenação ────────────────────────────────────────────────

export type SortConfig = {
    key:
        | keyof Product
        | 'category'
        | 'active'
        | 'display_available'
        | 'recommended_action'
        | 'global_status';
    direction: 'asc' | 'desc';
};

// ─── Filtros ──────────────────────────────────────────────────────────────────

export type FilterStock = 'all' | 'zero' | 'low' | 'attention' | 'normal' | 'high';
export type FilterStatus = 'all' | 'active' | 'inactive' | 'discontinued';
export type FilterAction = 'all' | 'buy' | 'transfer' | 'monitor' | 'review_excess' | 'ok';

// ─── Tipos de modal ───────────────────────────────────────────────────────────

export type ModalFilterType =
    | 'zero'
    | 'low'
    | 'high'
    | 'buy'
    | 'transfer'
    | 'attention'
    | 'discontinued'
    | 'all';

export interface ModalState {
    type: 'stats' | 'actions' | null;
    filterType?: ModalFilterType;
    productId?: string | null;
}