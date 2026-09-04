-- Corrige a geração de itens: total_cost é coluna gerada pelo PostgreSQL.
create or replace function public.generate_purchase_drafts_from_quotation_round(
  p_round_id uuid,
  p_allocations jsonb,
  p_notes text default null
)
returns table (
  purchase_document_id uuid,
  supplier_id uuid,
  supplier_name text,
  items_count integer,
  total_amount numeric
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_round public.purchase_quotation_rounds%rowtype;
  v_supplier record;
  v_allocation record;
  v_document_id uuid;
  v_items_count integer;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select * into v_round
  from public.purchase_quotation_rounds
  where id = p_round_id
  for update;

  if v_round.id is null then
    raise exception 'Rodada de cotação não encontrada.';
  end if;

  if not public.user_can_purchase_action(v_round.store_id, 'create') then
    raise exception 'Sem permissão para gerar compras desta rodada.';
  end if;

  if v_round.generated_at is not null then
    raise exception 'Os rascunhos desta rodada já foram gerados.';
  end if;

  if p_allocations is null or jsonb_typeof(p_allocations) <> 'array' or jsonb_array_length(p_allocations) < 1 then
    raise exception 'Nenhum item foi selecionado para compra.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_allocations) as a(quotation_id uuid, supplier_id uuid, product_id uuid, quantity numeric, unit_cost numeric)
    left join public.purchase_quotations q
      on q.id = a.quotation_id
     and q.quotation_round_id = v_round.id
     and q.supplier_id = a.supplier_id
     and q.store_id = v_round.store_id
    left join public.purchase_quotation_items qi
      on qi.quotation_id = q.id
     and qi.product_id = a.product_id
     and qi.store_id = v_round.store_id
    where q.id is null
       or qi.id is null
       or coalesce(a.quantity, 0) <= 0
       or coalesce(a.unit_cost, 0) <= 0
  ) then
    raise exception 'Há fornecedor, produto, quantidade ou preço inválido na seleção.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_allocations) as a(product_id uuid, quantity numeric)
    group by a.product_id
    having count(*) > 1
  ) then
    raise exception 'Cada produto deve ser destinado a apenas um fornecedor nesta geração.';
  end if;

  for v_supplier in
    select distinct a.supplier_id, s.name
    from jsonb_to_recordset(p_allocations) as a(supplier_id uuid)
    join public.suppliers s on s.id = a.supplier_id and s.store_id = v_round.store_id
  loop
    insert into public.purchase_documents (
      store_id, supplier_id, invoice_number, issue_date, total_amount, notes, status
    ) values (
      v_round.store_id,
      v_supplier.supplier_id,
      null,
      current_date,
      0,
      concat_ws(E'\n', nullif(p_notes, ''), 'Gerado pela rodada ' || v_round.round_code || '.'),
      'draft'
    ) returning id into v_document_id;

    v_items_count := 0;
    v_total := 0;

    for v_allocation in
      select a.quotation_id, a.product_id, a.quantity, a.unit_cost
      from jsonb_to_recordset(p_allocations) as a(quotation_id uuid, supplier_id uuid, product_id uuid, quantity numeric, unit_cost numeric)
      where a.supplier_id = v_supplier.supplier_id
    loop
      insert into public.purchase_document_items (
        purchase_document_id, product_id, quantity, unit_cost, store_id
      ) values (
        v_document_id,
        v_allocation.product_id,
        v_allocation.quantity,
        v_allocation.unit_cost,
        v_round.store_id
      );

      v_items_count := v_items_count + 1;
      v_total := v_total + (v_allocation.quantity * v_allocation.unit_cost);
    end loop;

    update public.purchase_documents
       set total_amount = v_total
     where id = v_document_id;

    update public.purchase_quotations q
       set status = 'converted',
           converted_purchase_document_id = v_document_id,
           updated_at = now(),
           metadata = coalesce(q.metadata, '{}'::jsonb) || jsonb_build_object('round_purchase_generated_at', now())
     where q.quotation_round_id = v_round.id
       and q.supplier_id = v_supplier.supplier_id
       and q.id in (
         select a.quotation_id
         from jsonb_to_recordset(p_allocations) as a(quotation_id uuid, supplier_id uuid)
         where a.supplier_id = v_supplier.supplier_id
       );

    perform public.create_operational_timeline_event(
      p_store_id := v_round.store_id,
      p_entity_type := 'purchase_document',
      p_entity_id := v_document_id,
      p_event_type := 'purchase_document_created_from_quotation_round',
      p_title := 'Rascunho criado pela rodada de cotação',
      p_description := 'Rascunho criado a partir da rodada ' || v_round.round_code || ' para ' || v_supplier.name || '.',
      p_severity := 'success',
      p_status := 'done',
      p_channel := 'system',
      p_source := 'generate_purchase_drafts_from_quotation_round',
      p_source_id := v_round.id,
      p_new_data := jsonb_build_object('round_id', v_round.id, 'round_code', v_round.round_code, 'items_count', v_items_count, 'total_amount', v_total),
      p_metadata := jsonb_build_object('origin', 'quotation_round', 'supplier_name', v_supplier.name),
      p_related_supplier_id := v_supplier.supplier_id,
      p_related_purchase_document_id := v_document_id
    );

    purchase_document_id := v_document_id;
    supplier_id := v_supplier.supplier_id;
    supplier_name := v_supplier.name;
    items_count := v_items_count;
    total_amount := v_total;
    return next;
  end loop;

  update public.purchase_quotation_rounds
     set status = 'converted', generated_at = now(), generated_by = auth.uid(), updated_at = now()
   where id = v_round.id;
end;
$function$;

revoke all on function public.generate_purchase_drafts_from_quotation_round(uuid, jsonb, text) from public, anon;
grant execute on function public.generate_purchase_drafts_from_quotation_round(uuid, jsonb, text) to authenticated, service_role;

notify pgrst, 'reload schema';
