create or replace function public.trg_apply_purchase_document_to_default_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_location_setting text;
begin
  v_location_setting := nullif(current_setting('app.purchase_receipt_location_id', true), '');
  perform * from public.apply_purchase_document_to_default_location(
    new.id,
    case when v_location_setting is null then null else v_location_setting::uuid end
  );
  return new;
end;
$function$;

create or replace function public.confirm_purchase_document_at_location(
  p_document_id uuid,
  p_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_location public.stock_locations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  select * into v_document
  from public.purchase_documents
  where id = p_document_id
  for update;

  if v_document.id is null or v_document.status <> 'draft' then
    raise exception 'Apenas compras em rascunho podem ser recebidas.';
  end if;

  if not public.user_can_purchase_action(v_document.store_id, 'confirm') then
    raise exception 'Sem permissão para receber compras nesta loja.';
  end if;

  select * into v_location
  from public.stock_locations
  where id = p_location_id
    and store_id = v_document.store_id
    and active is true;

  if v_location.id is null then
    raise exception 'Selecione um local de estoque ativo desta loja.';
  end if;

  perform set_config('app.purchase_receipt_location_id', v_location.id::text, true);
  perform public.confirm_purchase_document(v_document.id);
  perform set_config('app.purchase_receipt_location_id', '', true);

  perform public.create_operational_timeline_event(
    p_store_id := v_document.store_id,
    p_entity_type := 'purchase_document',
    p_entity_id := v_document.id,
    p_event_type := 'purchase_document_received',
    p_title := 'Recebimento total confirmado',
    p_description := 'Todos os itens foram recebidos no local ' || v_location.name || '.',
    p_severity := 'success',
    p_status := 'done',
    p_channel := 'manual',
    p_source := 'confirm_purchase_document_at_location',
    p_source_id := v_document.id,
    p_new_data := jsonb_build_object('location_id', v_location.id, 'location_name', v_location.name, 'receipt_type', 'total'),
    p_metadata := jsonb_build_object('origin', 'purchase_receipt', 'receipt_type', 'total'),
    p_related_supplier_id := v_document.supplier_id,
    p_related_purchase_document_id := v_document.id
  );
end;
$function$;

revoke all on function public.confirm_purchase_document_at_location(uuid, uuid) from public, anon;
grant execute on function public.confirm_purchase_document_at_location(uuid, uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
