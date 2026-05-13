export type ProductSupplierSummaryRow = {
    store_id: string;
    product_id: string;
    product_name: string;

    supplier_id: string;
    supplier_name: string;
    supplier_legal_name: string | null;
    supplier_trade_name: string | null;
    supplier_document: string | null;
    supplier_active: boolean;
    preferred_supplier: boolean;
    homologation_status: string | null;
    blocked: boolean;

    purchase_count: number;
    total_quantity: number;
    total_cost: number;

    average_unit_cost: number;
    min_unit_cost: number;
    max_unit_cost: number;
    last_unit_cost: number | null;
    last_purchase_date: string | null;
    last_effective_at: string | null;
    last_purchase_document_id: string | null;
    last_document_code: string | null;
    last_invoice_number: string | null;

    days_since_last_purchase: number | null;
};

export type ProductPurchaseCostHistoryRow = {
    id: string;
    store_id: string;
    product_id: string;
    product_name: string;

    supplier_id: string;
    supplier_name: string;
    supplier_trade_name: string | null;

    purchase_document_id: string | null;
    purchase_document_item_id: string | null;
    document_code: string | null;
    invoice_number: string | null;

    unit_cost: number;
    quantity: number;
    total_cost: number;

    issue_date: string | null;
    effective_at: string;
    source: string | null;

    previous_unit_cost: number | null;
    unit_cost_delta: number | null;
    unit_cost_delta_percent: number | null;
};