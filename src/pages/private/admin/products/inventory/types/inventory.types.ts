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
    | 'entry'           // Entrada manual (onEntry)
    | 'exit'            // Saída/perda manual (onExit)
    | 'reservation'     // Reserva por pedido
    | 'confirmation'    // Baixa por confirmação de pedido
    | 'cancellation'    // Cancelamento de pedido (devolve estoque)
    | 'clearance';      // Zeramento por descontinuação

export interface AdjustmentPayload {
    productId: string;
    quantity: number;
    reason: string;
    type: AdjustmentType;
}

export interface StockMovement {
    id: string;
    product_id: string;
    product_name?: string; // Opcional, vindo de join
    order_id: string | null;
    quantity: number;
    type: StockMovementType;
    reason: string | null;
    user_id: string | null;
    user_email?: string; // Opcional, vindo de join
    previous_stock: number;
    new_stock: number;
    created_at: string;
}

export interface StockMovementFilters {
    productId?: string;
    productIds?: string[];
    type?: StockMovementType;
    startDate?: string;
    endDate?: string;
}