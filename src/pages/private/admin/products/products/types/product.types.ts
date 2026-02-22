export interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    active: boolean;
    images?: string[];
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
    stock_quantity: number;
    min_stock: number;
    max_stock: number;
    is_discontinued?: boolean; // Produto descontinuado (não pode ser reativado)
    last_sale_at?: string;
    last_stock_entry_at?: string;
    created_at?: string;
}

export interface PriceRule {
    min: number;
    price: number;
}

export type StockStatus = 'inactive' | 'zero' | 'low' | 'normal' | 'high';

export interface Category {
    id: string;
    name: string;
    store_id: string;
    price_logic_type?: 'standard' | 'category_volume';
    price_rules?: any[];
    created_at?: string;
}

export interface ProductStats {
    total: number;
    totalActive: number;
    totalInactive: number;
    totalValue: number;
    zeroStock: number;
    lowStock: number;
    highStock: number;
    zeroStockProducts: Product[];
    lowStockProducts: Product[];
    highStockProducts: Product[];
    allProducts: Product[];
}

export type SortConfig = {
    key: keyof Product | 'category' | 'active';
    direction: 'asc' | 'desc';
};

export type FilterStock = 'all' | 'zero' | 'low' | 'normal' | 'high';
export type FilterStatus = 'all' | 'active' | 'inactive';

// Modal types
export type ModalFilterType = 'zero' | 'low' | 'high' | 'all';

export interface ModalState {
    type: 'stats' | 'actions' | null;
    filterType?: ModalFilterType;
    productId?: string | null;
}