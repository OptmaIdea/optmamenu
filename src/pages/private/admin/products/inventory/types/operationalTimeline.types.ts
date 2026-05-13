export type OperationalTimelineSeverity =
    | 'info'
    | 'success'
    | 'warning'
    | 'danger'
    | 'critical'
    | string;

export type OperationalTimelineStatus =
    | 'open'
    | 'done'
    | 'cancelled'
    | 'archived'
    | string;

export type OperationalTimelineEvent = {
    id: string;
    store_id: string;

    entity_type: string;
    entity_type_label: string | null;
    entity_id: string;

    event_type: string;
    event_type_label: string | null;

    title: string;
    description: string | null;

    severity: OperationalTimelineSeverity;
    severity_label: string | null;

    status: OperationalTimelineStatus;
    status_label: string | null;

    actor_user_id: string | null;
    actor_email: string | null;
    responsible_name: string | null;

    channel: string | null;
    channel_label: string | null;

    occurred_at: string;
    created_at: string;
    updated_at: string;

    source: string | null;
    source_id: string | null;

    old_data: Record<string, unknown>;
    new_data: Record<string, unknown>;
    metadata: Record<string, unknown>;

    related_supplier_id: string | null;
    supplier_name: string | null;
    supplier_document: string | null;

    related_product_id: string | null;
    product_name: string | null;

    related_purchase_quotation_id: string | null;
    quotation_code: string | null;
    quotation_status: string | null;

    related_purchase_document_id: string | null;
    purchase_invoice_number: string | null;
    purchase_document_status: string | null;
    purchase_issue_date: string | null;

    related_stock_transfer_id: string | null;
    transfer_code: string | null;
    stock_transfer_status: string | null;

    related_stock_movement_id: string | null;
    stock_movement_type: string | null;
    stock_movement_quantity: number | null;
    stock_movement_reason: string | null;

    reference_label: string | null;
};