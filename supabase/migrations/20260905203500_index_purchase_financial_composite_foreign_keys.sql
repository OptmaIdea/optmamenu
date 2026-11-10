create index if not exists accounts_payable_store_preferred_account_fkey_idx on public.accounts_payable (store_id, preferred_financial_account_id) where preferred_financial_account_id is not null;
create index if not exists accounts_payable_store_term_fkey_idx on public.accounts_payable (store_id, payment_term_id) where payment_term_id is not null;

create index if not exists accounts_payable_adjustments_store_installment_fkey_idx on public.accounts_payable_adjustments (store_id, installment_id) where installment_id is not null;
create index if not exists accounts_payable_adjustments_store_issue_fkey_idx on public.accounts_payable_adjustments (store_id, purchase_receipt_issue_id) where purchase_receipt_issue_id is not null;
create index if not exists accounts_payable_adjustments_store_payable_fkey_idx on public.accounts_payable_adjustments (store_id, accounts_payable_id);

create index if not exists accounts_payable_events_store_payable_fkey_idx on public.accounts_payable_events (store_id, accounts_payable_id);

create index if not exists accounts_payable_installments_store_account_fkey_idx on public.accounts_payable_installments (store_id, preferred_financial_account_id) where preferred_financial_account_id is not null;
create index if not exists accounts_payable_installments_store_payable_fkey_idx on public.accounts_payable_installments (store_id, accounts_payable_id);

create index if not exists accounts_payable_payments_store_installment_fkey_idx on public.accounts_payable_payments (store_id, installment_id);
create index if not exists accounts_payable_payments_store_payable_fkey_idx on public.accounts_payable_payments (store_id, accounts_payable_id);

create index if not exists purchase_documents_store_payment_term_fkey_idx on public.purchase_documents (store_id, payment_term_id) where payment_term_id is not null;
create index if not exists purchase_documents_store_preferred_account_fkey_idx on public.purchase_documents (store_id, preferred_financial_account_id) where preferred_financial_account_id is not null;
create index if not exists purchase_documents_store_source_quotation_fkey_idx on public.purchase_documents (store_id, source_quotation_id) where source_quotation_id is not null;

create index if not exists purchase_quotations_store_accepted_term_fkey_idx on public.purchase_quotations (store_id, accepted_payment_term_id) where accepted_payment_term_id is not null;
create index if not exists purchase_quotations_store_sent_term_fkey_idx on public.purchase_quotations (store_id, sent_payment_term_id) where sent_payment_term_id is not null;
create index if not exists purchase_quotations_store_suggested_term_fkey_idx on public.purchase_quotations (store_id, suggested_payment_term_id) where suggested_payment_term_id is not null;
create index if not exists purchase_quotations_store_supplier_term_fkey_idx on public.purchase_quotations (store_id, supplier_payment_term_id) where supplier_payment_term_id is not null;

create index if not exists suppliers_store_preferred_purchase_term_fkey_idx on public.suppliers (store_id, preferred_purchase_payment_term_id) where preferred_purchase_payment_term_id is not null;
