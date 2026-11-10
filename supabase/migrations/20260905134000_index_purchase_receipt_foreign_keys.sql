-- Índices de suporte às FKs do recebimento parcial, apontados pelo advisor de performance.
-- Mantém os índices compostos existentes e adiciona cobertura quando a FK não é a coluna líder.

create index if not exists idx_purchase_receipt_items_product_id
  on public.purchase_receipt_items (product_id);

create index if not exists idx_purchase_receipt_items_purchase_document_id
  on public.purchase_receipt_items (purchase_document_id);

create index if not exists idx_purchase_receipts_supplier_id
  on public.purchase_receipts (supplier_id);

create index if not exists idx_purchase_receipts_received_by
  on public.purchase_receipts (received_by);

create index if not exists idx_purchase_receipts_reversed_by
  on public.purchase_receipts (reversed_by)
  where reversed_by is not null;
