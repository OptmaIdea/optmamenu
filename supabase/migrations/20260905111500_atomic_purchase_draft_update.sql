create or replace function public.save_purchase_document_draft_atomic(
  p_document_id uuid,
  p_supplier_id uuid,
  p_issue_date date,
  p_invoice_number text,
  p_notes text,
  p_items jsonb
)
returns table (
  purchase_document_id uuid,
  document_code text,
  items_count integer,
  total_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_supplier public.suppliers%rowtype;
  v_item record;
  v_items_count integer;
  v_distinct_products integer;
  v_total numeric := 0;
  v_old_items jsonb;
  v_is_new boolean := p_document_id is null;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  if v_is_new then
    select * into v_supplier
    from public.suppliers
    where id = p_supplier_id
    and active is true
    and coalesce(blocked, false) is false
    and homologation_status = 'approved';

    if v_supplier.id is null then
      raise exception 'Fornecedor inválido, bloqueado ou não homologado.';
    end if;

    if not public.user_can_purchase_action(v_supplier.store_id, 'create') then
      raise exception 'Sem permissão para criar compras nesta loja.';
    end if;

    insert into public.purchase_documents (
      store_id, supplier_id, document_code, issue_date, invoice_number, notes, total_amount, status
    ) values (
      v_supplier.store_id,
      v_supplier.id,
      public.generate_purchase_document_code(v_supplier.store_id),
      coalesce(p_issue_date, current_date),
      nullif(trim(coalesce(p_invoice_number, '')), ''),
      nullif(trim(coalesce(p_notes, '')), ''),
      0,
      'draft'
    ) returning * into v_document;
  else
    select * into v_document
    from public.purchase_documents
    where id = p_document_id
    for update;

    if v_document.id is null then
      raise exception 'Rascunho de compra não encontrado.';
    end if;

    if v_document.status <> 'draft' then
      raise exception 'Somente compras em rascunho podem ser editadas.';
    end if;

    if not public.user_can_purchase_action(v_document.store_id, 'create') then
      raise exception 'Sem permissão para editar compras nesta loja.';
    end if;

    select * into v_supplier
    from public.suppliers
    where id = p_supplier_id
      and store_id = v_document.store_id
      and active is true
      and coalesce(blocked, false) is false
      and homologation_status = 'approved';
  end if;

  if v_supplier.id is null then
    raise exception 'Fornecedor inválido, bloqueado ou não homologado.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item para salvar o rascunho.';
  end if;

  select count(*), count(distinct x.product_id)
    into v_items_count, v_distinct_products
  from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric, unit_cost numeric);

  if v_items_count <> v_distinct_products then
    raise exception 'O mesmo produto não pode aparecer mais de uma vez no pedido.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric, unit_cost numeric)
    left join public.products p
      on p.id = x.product_id
     and p.store_id = v_document.store_id
     and coalesce(p.active, true) is true
    where p.id is null
       or coalesce(x.quantity, 0) <= 0
       or x.unit_cost is null
       or x.unit_cost < 0
  ) then
    raise exception 'Há produto, quantidade ou custo inválido no rascunho.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', i.product_id,
    'quantity', i.quantity,
    'unit_cost', i.unit_cost
  ) order by i.product_id), '[]'::jsonb)
  into v_old_items
  from public.purchase_document_items i
  where i.purchase_document_id = v_document.id
    and i.store_id = v_document.store_id;

  delete from public.purchase_document_items i
  where i.purchase_document_id = v_document.id
    and i.store_id = v_document.store_id;

  for v_item in
    select *
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity numeric, unit_cost numeric)
  loop
    insert into public.purchase_document_items (
      purchase_document_id, product_id, quantity, unit_cost, store_id
    ) values (
      v_document.id, v_item.product_id, v_item.quantity, v_item.unit_cost, v_document.store_id
    );
    v_total := v_total + (v_item.quantity * v_item.unit_cost);
  end loop;

  update public.purchase_documents
     set supplier_id = v_supplier.id,
         issue_date = coalesce(p_issue_date, current_date),
         invoice_number = nullif(trim(coalesce(p_invoice_number, '')), ''),
         notes = nullif(trim(coalesce(p_notes, '')), ''),
         total_amount = v_total
   where id = v_document.id;

  perform public.create_operational_timeline_event(
    p_store_id := v_document.store_id,
    p_entity_type := 'purchase_document',
    p_entity_id := v_document.id,
    p_event_type := case when v_is_new then 'purchase_document_created' else 'purchase_document_draft_updated' end,
    p_title := case when v_is_new then 'Rascunho de compra criado' else 'Rascunho de compra atualizado' end,
    p_description := case when v_is_new then 'Compra manual criada de forma atômica.' else 'Cabeçalho e itens atualizados de forma atômica.' end,
    p_severity := 'info',
    p_status := 'done',
    p_channel := 'manual',
    p_source := 'save_purchase_document_draft_atomic',
    p_source_id := v_document.id,
    p_old_data := jsonb_build_object(
      'supplier_id', v_document.supplier_id,
      'issue_date', v_document.issue_date,
      'invoice_number', v_document.invoice_number,
      'notes', v_document.notes,
      'items', v_old_items,
      'total_amount', v_document.total_amount
    ),
    p_new_data := jsonb_build_object(
      'supplier_id', v_supplier.id,
      'issue_date', coalesce(p_issue_date, current_date),
      'invoice_number', nullif(trim(coalesce(p_invoice_number, '')), ''),
      'notes', nullif(trim(coalesce(p_notes, '')), ''),
      'items', p_items,
      'total_amount', v_total
    ),
    p_metadata := jsonb_build_object('origin', 'atomic_purchase_draft_update'),
    p_related_supplier_id := v_supplier.id,
    p_related_purchase_document_id := v_document.id
  );

  return query
  select d.id, d.document_code, v_items_count, d.total_amount
  from public.purchase_documents d
  where d.id = v_document.id;
end;
$function$;

revoke all on function public.save_purchase_document_draft_atomic(uuid, uuid, date, text, text, jsonb)
  from public, anon;
grant execute on function public.save_purchase_document_draft_atomic(uuid, uuid, date, text, text, jsonb)
  to authenticated, service_role;

notify pgrst, 'reload schema';
