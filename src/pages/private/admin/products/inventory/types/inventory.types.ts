export interface ProductStock {
    id: string;
    store_id: string;
    category_id: string | null;
    name: string;
    description: string | null;
    price: number;
    images: string[] | null;
    physical_stock: number;
    active: boolean;
    discontinued: boolean; // Produto descontinuado (não pode ser reativado) - nome da coluna na view
    is_discontinued?: boolean; // Alias para compatibilidade com o tipo Product
    reserved_stock: number;
    available_stock: number;
    // Campos adicionais da view (se houver)
    created_at?: string;
    updated_at?: string;
    last_entry_unit_cost?: number | null;
}

export type AdjustmentType = 'entry' | 'exit';

export type StockMovementType =
    | 'entry'
    | 'exit'
    | 'reservation'
    | 'confirmation'
    | 'cancellation'
    | 'clearance';

export type StockMovementOperationFilter =
    | ''
    | StockMovementType
    | 'transfer_all'
    | 'transfer_out'
    | 'transfer_in';

export interface AdjustmentPayload {
    productId: string;
    quantity: number;
    reason: string;
    type: AdjustmentType;
}

export interface StockMovement {
    id: string;
    product_id: string;
    product_name?: string;
    order_id: string | null;
    quantity: number;
    type: StockMovementType;
    reason: string | null;
    user_id: string | null;
    user_email?: string;
    previous_stock: number;
    new_stock: number;
    created_at: string;
    created_at_display?: string | null;
    transfer_id?: string | null;

    location_id?: string | null;
    location_name?: string | null;
    location_code?: string | null;
    from_location_id?: string | null;
    from_location_name?: string | null;
    from_location_code?: string | null;
    to_location_id?: string | null;
    to_location_name?: string | null;
    to_location_code?: string | null;
    supplier_id?: string | null;
    supplier_name?: string | null;
    purchase_document_number?: string | null;
    source?: string | null;
    source_id?: string | null;
    source_label?: string | null;
    transfer_code?: string | null;
    divergence_qty?: number | null;
    divergence_resolution?: string | null;
    divergence_reason?: string | null;
}

export interface StockMovementFilters {
    productId?: string;
    productIds?: string[];
    type?: StockMovementType;
    source?: string;
    reasonCode?: string;
    startDate?: string;
    endDate?: string;
    locationId?: string;
    search?: string;
}
