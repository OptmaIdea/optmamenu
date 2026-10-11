-- Blocks 2/3: harden the financial bridge quotation -> purchase -> accounts payable
-- and preserve consistent cancellation/audit semantics.

create or replace function public.trg_sync_purchase_document_states()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
begin
  new.commercial_status := case
    when new.status in ('cancelled','canceled') then 'cancelled'
    when new.status in ('partially_received','confirmed') then 'committed'
    else coalesce(new.commercial_status,'draft')
  end;

  new.physical_status := case
    when new.status in ('cancelled','canceled') then 'cancelled'
    when new.status='partially_received' then 'partial'
    when new.status='confirmed' then 'received'
    else 'not_received'
  end;

  if new.status in ('cancelled','canceled') then
    new.financial_status := 'cancelled';
  else
    new.financial_status := coalesce(new.financial_status,'not_defined');
  end if;

  return new;
end;
$$;
revoke all on function public.trg_sync_purchase_document_states() from public,anon,authenticated;

create or replace function public.trg_inherit_quotation_terms_to_purchase()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_term_id uuid;
  v_snapshot jsonb;
  v_method text;
  v_source text;
  v_doc public.purchase_documents%rowtype;
begin
  if new.converted_purchase_document_id is null
     or new.converted_purchase_document_id is not distinct from old.converted_purchase_document_id then
    return new;
  end if;

  v_term_id := coalesce(new.accepted_payment_term_id,new.supplier_payment_term_id,new.sent_payment_term_id,new.suggested_payment_term_id);
  v_snapshot := coalesce(new.accepted_payment_term_snapshot,new.supplier_payment_term_snapshot,new.sent_payment_term_snapshot,new.suggested_payment_term_snapshot);
  v_method := coalesce(new.accepted_payment_method_code,new.supplier_payment_method_code,new.sent_payment_method_code);
  v_source := case
    when new.accepted_payment_term_id is not null then 'quotation'
    when new.supplier_payment_term_id is not null then 'supplier_response'
    when new.sent_payment_term_id is not null then 'quotation'
    else coalesce(new.payment_term_suggestion_source,'quotation')
  end;

  select * into v_doc
  from public.purchase_documents
  where id=new.converted_purchase_document_id and store_id=new.store_id
  for update;

  if v_doc.id is null then
    raise exception 'Compra convertida não encontrada para a cotação %.', new.id;
  end if;

  if v_doc.source_quotation_id is not null
     and v_doc.source_quotation_id is distinct from new.id
     and v_doc.payment_term_id is not null
     and v_term_id is not null
     and v_doc.payment_term_id is distinct from v_term_id then
    raise exception 'As cotações selecionadas para esta compra possuem condições de pagamento diferentes. Alinhe as condições antes de gerar o rascunho.';
  end if;

  if v_doc.source_quotation_id is not null
     and v_doc.source_quotation_id is distinct from new.id
     and v_doc.payment_method_code is not null
     and v_method is not null
     and v_doc.payment_method_code is distinct from v_method then
    raise exception 'As cotações selecionadas para esta compra possuem formas de pagamento diferentes. Alinhe as formas antes de gerar o rascunho.';
  end if;

  update public.purchase_documents pd
  set source_quotation_id = coalesce(pd.source_quotation_id,new.id),
      payment_term_id = coalesce(pd.payment_term_id,v_term_id),
      payment_term_snapshot = case when pd.payment_term_id is null then coalesce(v_snapshot,pd.payment_term_snapshot) else pd.payment_term_snapshot end,
      payment_term_source = case when pd.payment_term_id is null and v_term_id is not null then v_source else pd.payment_term_source end,
      payment_mode = coalesce(pd.payment_mode,v_snapshot->>'payment_mode'),
      payment_method_code = coalesce(pd.payment_method_code,v_method,v_snapshot->>'payment_method_code')
  where pd.id=new.converted_purchase_document_id and pd.store_id=new.store_id;

  if v_term_id is not null then
    perform public.create_operational_timeline_event(
      p_store_id := new.store_id,
      p_entity_type := 'purchase_document',
      p_entity_id := new.converted_purchase_document_id,
      p_event_type := 'purchase_financial_terms_inherited',
      p_title := 'Condição financeira herdada da cotação',
      p_description := 'Condição '||coalesce(v_snapshot->>'name','definida')||' vinculada à compra a partir da cotação '||coalesce(new.quotation_code,new.id::text)||'.',
      p_severity := 'info',
      p_status := 'done',
      p_channel := 'system',
      p_source := 'trg_inherit_quotation_terms_to_purchase',
      p_source_id := new.id,
      p_new_data := jsonb_build_object('payment_term_id',v_term_id,'payment_term_name',v_snapshot->>'name','payment_method_code',v_method,'payment_term_source',v_source),
      p_metadata := jsonb_build_object('origin','purchase_quotation'),
      p_related_supplier_id := new.supplier_id,
      p_related_purchase_quotation_id := new.id,
      p_related_purchase_document_id := new.converted_purchase_document_id
    );
  end if;

  return new;
end;
$$;
revoke all on function public.trg_inherit_quotation_terms_to_purchase() from public,anon,authenticated;

create or replace function public.trg_log_purchase_quotation_financial_terms()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
begin
  if new.sent_payment_term_id is distinct from old.sent_payment_term_id
     or new.sent_payment_method_code is distinct from old.sent_payment_method_code then
    perform public.create_operational_timeline_event(
      p_store_id := new.store_id,
      p_entity_type := 'purchase_quotation',
      p_entity_id := new.id,
      p_event_type := 'quotation_payment_terms_requested',
      p_title := 'Condição de pagamento proposta',
      p_description := 'Proposta financeira enviada: '||coalesce(new.sent_payment_term_snapshot->>'name','não definida')||'.',
      p_severity := 'info',
      p_status := 'done',
      p_channel := coalesce(new.sent_channel,'system'),
      p_source := 'purchase_quotation_financial_terms',
      p_source_id := new.id,
      p_old_data := jsonb_build_object('payment_term_id',old.sent_payment_term_id,'payment_method_code',old.sent_payment_method_code),
      p_new_data := jsonb_build_object('payment_term_id',new.sent_payment_term_id,'payment_term_name',new.sent_payment_term_snapshot->>'name','payment_method_code',new.sent_payment_method_code),
      p_related_supplier_id := new.supplier_id,
      p_related_purchase_quotation_id := new.id
    );
  end if;

  if new.supplier_payment_term_id is distinct from old.supplier_payment_term_id
     or new.supplier_payment_method_code is distinct from old.supplier_payment_method_code
     or new.supplier_payment_notes is distinct from old.supplier_payment_notes then
    perform public.create_operational_timeline_event(
      p_store_id := new.store_id,
      p_entity_type := 'purchase_quotation',
      p_entity_id := new.id,
      p_event_type := 'quotation_supplier_payment_response',
      p_title := 'Condição financeira informada pelo fornecedor',
      p_description := 'Fornecedor informou '||coalesce(new.supplier_payment_term_snapshot->>'name','condição não definida')||'.',
      p_severity := 'info',
      p_status := 'done',
      p_channel := coalesce(new.sent_channel,'manual'),
      p_source := 'purchase_quotation_financial_terms',
      p_source_id := new.id,
      p_old_data := jsonb_build_object('payment_term_id',old.supplier_payment_term_id,'payment_method_code',old.supplier_payment_method_code,'notes',old.supplier_payment_notes),
      p_new_data := jsonb_build_object('payment_term_id',new.supplier_payment_term_id,'payment_term_name',new.supplier_payment_term_snapshot->>'name','payment_method_code',new.supplier_payment_method_code,'notes',new.supplier_payment_notes),
      p_related_supplier_id := new.supplier_id,
      p_related_purchase_quotation_id := new.id
    );
  end if;

  if new.accepted_payment_term_id is distinct from old.accepted_payment_term_id
     or new.accepted_payment_method_code is distinct from old.accepted_payment_method_code then
    perform public.create_operational_timeline_event(
      p_store_id := new.store_id,
      p_entity_type := 'purchase_quotation',
      p_entity_id := new.id,
      p_event_type := 'quotation_payment_terms_accepted',
      p_title := 'Condição financeira aceita',
      p_description := 'Condição aceita: '||coalesce(new.accepted_payment_term_snapshot->>'name','não definida')||'.',
      p_severity := 'success',
      p_status := 'done',
      p_channel := coalesce(new.sent_channel,'system'),
      p_source := 'purchase_quotation_financial_terms',
      p_source_id := new.id,
      p_old_data := jsonb_build_object('payment_term_id',old.accepted_payment_term_id,'payment_method_code',old.accepted_payment_method_code),
      p_new_data := jsonb_build_object('payment_term_id',new.accepted_payment_term_id,'payment_term_name',new.accepted_payment_term_snapshot->>'name','payment_method_code',new.accepted_payment_method_code),
      p_related_supplier_id := new.supplier_id,
      p_related_purchase_quotation_id := new.id
    );
  end if;

  return new;
end;
$$;
revoke all on function public.trg_log_purchase_quotation_financial_terms() from public,anon,authenticated;

drop trigger if exists purchase_quotation_financial_terms_after_write on public.purchase_quotations;
create trigger purchase_quotation_financial_terms_after_write
after update of sent_payment_term_id,sent_payment_method_code,supplier_payment_term_id,supplier_payment_method_code,supplier_payment_notes,accepted_payment_term_id,accepted_payment_method_code
on public.purchase_quotations
for each row execute function public.trg_log_purchase_quotation_financial_terms();

create or replace function public.trg_sync_purchase_payable_after_document()
returns trigger
language plpgsql
security definer
set search_path='public'
as $$
declare
  v_p public.accounts_payable%rowtype;
  v_cancel_actor uuid;
begin
  if new.status in ('cancelled','canceled') then
    select * into v_p from public.accounts_payable where store_id=new.store_id and purchase_document_id=new.id for update;

    if v_p.id is not null then
      if exists(select 1 from public.accounts_payable_payments where accounts_payable_id=v_p.id and status='confirmed') then
        raise exception 'A compra possui pagamentos financeiros confirmados. Estorne-os antes de cancelar a compra.';
      end if;

      v_cancel_actor := coalesce(new.cancelled_by,auth.uid());
      update public.accounts_payable
      set status='cancelled',
          cancelled_at=coalesce(new.cancelled_at,now()),
          cancelled_by=v_cancel_actor,
          cancellation_reason=coalesce(nullif(btrim(new.cancel_reason),''),'Compra cancelada'),
          updated_at=now()
      where id=v_p.id;

      update public.accounts_payable_installments set status='cancelled',updated_at=now() where accounts_payable_id=v_p.id;

      perform public._accounts_payable_add_event(
        v_p.store_id,v_p.id,'payable_cancelled_by_purchase','Conta a pagar cancelada pela compra',
        coalesce(nullif(btrim(new.cancel_reason),''),'Compra cancelada'),
        jsonb_build_object('status',v_p.status),
        jsonb_build_object('status','cancelled','purchase_document_id',new.id),
        jsonb_build_object('origin','purchase_cancellation','cancelled_by',v_cancel_actor)
      );
    end if;

    return null;
  end if;

  if new.payment_term_id is not null and coalesce(new.total_amount,0)>0 then
    perform public._upsert_purchase_payable_from_document(new.id);
  end if;

  if new.status in ('partially_received','confirmed') then
    update public.accounts_payable
    set status=case when paid_amount>=net_amount then 'paid' when paid_amount>0 then 'partially_paid' else 'open' end,
        updated_at=now()
    where store_id=new.store_id and purchase_document_id=new.id and status='draft';

    select * into v_p from public.accounts_payable where store_id=new.store_id and purchase_document_id=new.id;
    if v_p.id is not null then perform public._recalculate_accounts_payable(v_p.id); end if;
  end if;

  return null;
end;
$$;
revoke all on function public.trg_sync_purchase_payable_after_document() from public,anon,authenticated;

create index if not exists purchase_document_items_product_fkey_idx on public.purchase_document_items(product_id);
create index if not exists purchase_document_location_applications_document_fkey_idx on public.purchase_document_location_applications(purchase_document_id);
create index if not exists purchase_document_location_applications_location_fkey_idx on public.purchase_document_location_applications(location_id);
create index if not exists purchase_document_location_applications_product_fkey_idx on public.purchase_document_location_applications(product_id);
create index if not exists purchase_document_location_applications_supplier_fkey_idx on public.purchase_document_location_applications(supplier_id);
create index if not exists purchase_documents_cancelled_by_fkey_idx on public.purchase_documents(cancelled_by) where cancelled_by is not null;
create index if not exists purchase_documents_supplier_fkey_idx on public.purchase_documents(supplier_id);
create index if not exists purchase_quotation_items_product_fkey_idx on public.purchase_quotation_items(product_id);
create index if not exists purchase_quotations_converted_document_fkey_idx on public.purchase_quotations(converted_purchase_document_id) where converted_purchase_document_id is not null;
create index if not exists purchase_quotations_supplier_fkey_idx on public.purchase_quotations(supplier_id);
