export type Supplier360Summary = {
  supplier_id: string;
  store_id: string;

  name: string;
  legal_name: string | null;
  trade_name: string | null;
  document: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;

  homologation_status: string;
  preferred_supplier: boolean;
  blocked: boolean;
  blocked_reason: string | null;
  last_contact_at: string | null;

  total_purchase_documents: number;
  confirmed_purchase_documents: number;
  draft_purchase_documents: number;
  cancelled_purchase_documents: number;

  total_purchased_amount: number;
  confirmed_purchased_amount: number;
  average_ticket: number;

  first_purchase_date: string | null;
  last_purchase_date: string | null;
  days_since_last_purchase: number | null;

  distinct_products: number;
  total_items_quantity: number;

  contacts_count: number;
  relationship_events_count: number;
  open_relationship_events_count: number;
  critical_relationship_events_count: number;
};

export type SupplierPurchaseHistoryRow = {
  purchase_document_id: string;
  store_id: string;
  supplier_id: string;
  document_code: string | null;
  invoice_number: string | null;
  issue_date: string | null;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  cancelled_at: string | null;
  cancel_reason: string | null;
  items_count: number;
  total_quantity: number;
};

export type SupplierSuppliedProductRow = {
  supplier_id: string;
  store_id: string;
  product_id: string;
  product_name: string;
  category_id: string | null;
  product_active: boolean;

  purchase_count: number;
  total_quantity: number;
  total_cost: number;

  average_unit_cost: number;
  min_unit_cost: number;
  max_unit_cost: number;
  last_unit_cost: number | null;
  last_purchase_date: string | null;

  last_purchase_document_id: string | null;
};

export type SupplierPriceEvolutionRow = {
  id: string;
  store_id: string;
  supplier_id: string;
  product_id: string;
  product_name: string;
  purchase_document_id: string | null;
  purchase_document_item_id: string | null;
  unit_cost: number;
  quantity: number;
  total_cost: number;
  issue_date: string | null;
  effective_at: string;
  source: string | null;

  // Campos enriquecidos para leitura gerencial
  document_code: string | null;
  invoice_number: string | null;
  is_active: boolean;
  cancelled_at: string | null;
  cancelled_reason: string | null;
};

export type SupplierQuotationHistoryRow = {
  quotation_id: string;
  store_id: string;
  supplier_id: string;
  quotation_code: string;
  status: string;
  requested_at: string;
  responded_at: string | null;
  expires_at: string | null;
  sent_channel: string | null;
  responsible_name: string | null;
  notes: string | null;
  converted_purchase_document_id: string | null;
  converted_document_code: string | null;
  converted_invoice_number: string | null;
  items_count: number;
  products_count: number;
  requested_qty: number;
  approved_qty: number;
  reference_total: number;
  quoted_total: number;
  approved_total: number;
};

export type SupplierRelationshipTimelineRow = {
  id: string;
  store_id: string;
  supplier_id: string;
  event_type: string;
  title: string;
  description: string | null;
  event_at: string;
  severity: string;
  status: string;
  related_purchase_document_id: string | null;
  related_product_id: string | null;
  related_product_name: string | null;
  created_by: string | null;
  created_by_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SupplierContactRow = {
  id: string;
  store_id: string;
  supplier_id: string;
  name: string;
  role: string | null;
  department: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  notes: string | null;
  is_primary: boolean;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SupplierLifecycleData = {
  summary: Supplier360Summary | null;
  purchases: SupplierPurchaseHistoryRow[];
  products: SupplierSuppliedProductRow[];
  prices: SupplierPriceEvolutionRow[];
  quotations: SupplierQuotationHistoryRow[];
  timeline: SupplierRelationshipTimelineRow[];
  contacts: SupplierContactRow[];
};
