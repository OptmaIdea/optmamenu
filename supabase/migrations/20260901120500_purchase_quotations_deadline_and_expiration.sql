do $$
begin
  alter table public.purchase_quotations
    drop constraint if exists purchase_quotations_status_check;

  alter table public.purchase_quotations
    add constraint purchase_quotations_status_check
    check (status = any (array[
      'draft'::text,
      'sent'::text,
      'answered'::text,
      'approved'::text,
      'rejected'::text,
      'converted'::text,
      'cancelled'::text,
      'expired'::text
    ]));
end $$;

drop function if exists public.create_purchase_quotation(uuid, jsonb, text, text, text, text, text);

create or replace function public.create_purchase_quotation(
  p_supplier_id uuid,
  p_items jsonb,
  p_message_subject text default null::text,
  p_message_body text default null::text,
  p_sent_channel text default null::text,
  p_responsible_name text default null::text,
  p_notes text default null::text,
  p_expires_at timestamptz default null::timestamptz
)
returns table(quotation_id uuid, quotation_code text, status text, items_count integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_supplier record;
  v_store_id uuid;
  v_quotation_id uuid;
  v_quotation_code text;
  v_item jsonb;
  v_items_count integer := 0;
begin
  if p_supplier_id is null then
    raise exception 'Informe o fornecedor da cotação.';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
  then
    raise exception 'Informe ao menos um item para a cotação.';
  end if;

  select
    s.id,
    s.store_id,
    s.name,
    coalesce(s.active, false) as active,
    coalesce(s.blocked, false) as blocked,
    coalesce(s.homologation_status, 'not_evaluated') as homologation_status
  into v_supplier
  from public.suppliers s
  where s.id = p_supplier_id;

  if v_supplier.id is null then
    raise exception 'Fornecedor não encontrado.';
  end if;

  v_store_id := v_supplier.store_id;

  if not public.user_can_purchase_action(v_store_id, 'create') then
    raise exception 'Sem permissão para criar cotações nesta loja.';
  end if;

  if v_supplier.active is not true then
    raise exception 'Fornecedor inativo não pode receber cotação.';
  end if;

  if v_supplier.blocked is true then
    raise exception 'Fornecedor bloqueado não pode receber cotação.';
  end if;

  if v_supplier.homologation_status <> 'approved' then
    raise exception 'Fornecedor precisa estar aprovado para receber cotação.';
  end if;

  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'O prazo de resposta da cotação precisa ser futuro.';
  end if;

  v_quotation_code :=
    'COT-' ||
    to_char(timezone('America/Sao_Paulo', now()), 'YYYYMMDD-HH24MISS') ||
    '-' ||
    lpad((floor(random() * 1000))::int::text, 3, '0');

  insert into public.purchase_quotations (
    store_id,
    supplier_id,
    quotation_code,
    status,
    requested_at,
    expires_at,
    sent_channel,
    responsible_name,
    message_subject,
    message_body,
    notes,
    metadata,
    created_by
  )
  values (
    v_store_id,
    p_supplier_id,
    v_quotation_code,
    'draft',
    now(),
    p_expires_at,
    p_sent_channel,
    p_responsible_name,
    p_message_subject,
    p_message_body,
    p_notes,
    jsonb_build_object(
      'created_from', 'purchase_suggestions',
      'supplier_name', v_supplier.name,
      'response_deadline_at', p_expires_at
    ),
    auth.uid()
  )
  returning id into v_quotation_id;

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    if (v_item->>'product_id') is null then
      raise exception 'Item da cotação sem produto.';
    end if;

    if coalesce((v_item->>'quantity')::numeric, 0) <= 0 then
      raise exception 'Quantidade inválida em item da cotação.';
    end if;

    if not exists (
      select 1
      from public.products p
      where p.id = (v_item->>'product_id')::uuid
        and p.store_id = v_store_id
    ) then
      raise exception 'Produto da cotação não pertence à loja.';
    end if;

    insert into public.purchase_quotation_items (
      quotation_id,
      store_id,
      product_id,
      requested_qty,
      reference_unit_cost,
      quoted_unit_cost,
      approved_qty,
      notes
    )
    values (
      v_quotation_id,
      v_store_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      nullif(v_item->>'unit_cost', '')::numeric,
      null,
      (v_item->>'quantity')::numeric,
      nullif(v_item->>'notes', '')
    );

    v_items_count := v_items_count + 1;
  end loop;

  perform public.create_operational_timeline_event(
    p_store_id := v_store_id,
    p_entity_type := 'purchase_quotation',
    p_entity_id := v_quotation_id,
    p_event_type := 'quotation_created',
    p_title := 'Cotação criada',
    p_description := 'Cotação ' || v_quotation_code || ' criada para o fornecedor ' || v_supplier.name ||
      case when p_expires_at is not null then ' com prazo de resposta até ' || public.format_datetime_sao_paulo(p_expires_at) || '.' else '.' end,
    p_severity := 'info',
    p_status := 'done',
    p_responsible_name := nullif(p_responsible_name, ''),
    p_channel := coalesce(nullif(p_sent_channel, ''), 'system'),
    p_source := 'create_purchase_quotation',
    p_source_id := v_quotation_id,
    p_new_data := jsonb_build_object(
      'quotation_id', v_quotation_id,
      'quotation_code', v_quotation_code,
      'status', 'draft',
      'supplier_id', p_supplier_id,
      'supplier_name', v_supplier.name,
      'items_count', v_items_count,
      'sent_channel', p_sent_channel,
      'responsible_name', p_responsible_name,
      'expires_at', p_expires_at
    ),
    p_metadata := jsonb_build_object(
      'phase', 'cotacao_lote_deadline',
      'items_count', v_items_count,
      'response_deadline_at', p_expires_at
    ),
    p_related_supplier_id := p_supplier_id,
    p_related_purchase_quotation_id := v_quotation_id
  );

  if nullif(p_sent_channel, '') is not null
     and p_sent_channel not in ('manual', 'system') then
    perform public.create_operational_timeline_event(
      p_store_id := v_store_id,
      p_entity_type := 'purchase_quotation',
      p_entity_id := v_quotation_id,
      p_event_type := 'quotation_channel_defined',
      p_title := 'Canal da cotação definido',
      p_description := 'Canal definido para a cotação ' || v_quotation_code || ': ' || p_sent_channel || '.',
      p_severity := 'info',
      p_status := 'done',
      p_responsible_name := nullif(p_responsible_name, ''),
      p_channel := p_sent_channel,
      p_source := 'create_purchase_quotation',
      p_source_id := v_quotation_id,
      p_new_data := jsonb_build_object(
        'sent_channel', p_sent_channel,
        'quotation_code', v_quotation_code
      ),
      p_metadata := jsonb_build_object(
        'phase', 'cotacao_lote_deadline',
        'reason', 'channel_defined_on_creation'
      ),
      p_related_supplier_id := p_supplier_id,
      p_related_purchase_quotation_id := v_quotation_id
    );
  end if;

  return query
  select
    v_quotation_id,
    v_quotation_code,
    'draft'::text,
    v_items_count;
end;
$function$;

create or replace function public.mark_purchase_quotations_expired_safe(
  p_store_id uuid default null::uuid
)
returns table(expired_count integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_count integer := 0;
begin
  update public.purchase_quotations q
     set status = 'expired',
         updated_at = now(),
         metadata = coalesce(q.metadata, '{}'::jsonb) || jsonb_build_object(
           'expired_at', now(),
           'expired_by', 'mark_purchase_quotations_expired_safe'
         )
   where q.status in ('draft', 'sent')
     and q.expires_at is not null
     and q.expires_at < now()
     and (p_store_id is null or q.store_id = p_store_id)
     and public.is_store_member(q.store_id);

  get diagnostics v_count = row_count;
  return query select v_count;
end;
$function$;

create or replace function public.get_purchase_quotations_by_store(
  p_store_id uuid,
  p_status text default null::text,
  p_limit integer default 100
)
returns table(
  id uuid,
  quotation_code text,
  supplier_id uuid,
  supplier_name text,
  status text,
  sent_channel text,
  requested_at timestamptz,
  requested_at_display text,
  responded_at timestamptz,
  responded_at_display text,
  expires_at timestamptz,
  expires_at_display text,
  items_count integer,
  total_reference numeric,
  total_quoted numeric,
  converted_purchase_document_id uuid,
  responsible_name text,
  notes text
)
language sql
security definer
set search_path to 'public'
as $function$
  with base as (
    select
      q.*,
      case
        when q.status in ('draft', 'sent')
          and q.expires_at is not null
          and q.expires_at < now()
        then 'expired'
        else q.status
      end as effective_status
    from public.purchase_quotations q
    where q.store_id = p_store_id
      and public.is_store_member(q.store_id)
  )
  select
    q.id,
    q.quotation_code,
    q.supplier_id,
    s.name as supplier_name,
    q.effective_status as status,
    q.sent_channel,
    q.requested_at,
    public.format_datetime_sao_paulo(q.requested_at) as requested_at_display,
    q.responded_at,
    public.format_datetime_sao_paulo(q.responded_at) as responded_at_display,
    q.expires_at,
    public.format_datetime_sao_paulo(q.expires_at) as expires_at_display,
    count(qi.id)::integer as items_count,
    coalesce(sum(qi.requested_qty * coalesce(qi.reference_unit_cost, 0)), 0)::numeric as total_reference,
    coalesce(sum(qi.approved_qty * coalesce(qi.quoted_unit_cost, 0)), 0)::numeric as total_quoted,
    q.converted_purchase_document_id,
    q.responsible_name,
    q.notes
  from base q
  join public.suppliers s
    on s.id = q.supplier_id
  left join public.purchase_quotation_items qi
    on qi.quotation_id = q.id
  where (p_status is null or q.effective_status = p_status)
  group by
    q.id,
    q.quotation_code,
    q.supplier_id,
    s.name,
    q.effective_status,
    q.sent_channel,
    q.requested_at,
    q.responded_at,
    q.expires_at,
    q.converted_purchase_document_id,
    q.responsible_name,
    q.notes,
    q.created_at
  order by q.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$function$;

create or replace function public.get_purchase_quotation_detail(p_quotation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_result jsonb;
  v_store_id uuid;
begin
  select q.store_id
  into v_store_id
  from public.purchase_quotations q
  where q.id = p_quotation_id;

  if v_store_id is null then
    raise exception 'Cotação não encontrada.';
  end if;

  if not public.is_store_member(v_store_id) then
    raise exception 'Acesso negado à cotação.';
  end if;

  select jsonb_build_object(
    'id', q.id,
    'store_id', q.store_id,
    'supplier_id', q.supplier_id,
    'supplier_name', s.name,
    'quotation_code', q.quotation_code,
    'status', case
      when q.status in ('draft', 'sent')
        and q.expires_at is not null
        and q.expires_at < now()
      then 'expired'
      else q.status
    end,
    'sent_channel', q.sent_channel,
    'requested_at', q.requested_at,
    'requested_at_display', public.format_datetime_sao_paulo(q.requested_at),
    'responded_at', q.responded_at,
    'responded_at_display', public.format_datetime_sao_paulo(q.responded_at),
    'expires_at', q.expires_at,
    'expires_at_display', public.format_datetime_sao_paulo(q.expires_at),
    'responsible_name', q.responsible_name,
    'message_subject', q.message_subject,
    'message_body', q.message_body,
    'notes', q.notes,
    'converted_purchase_document_id', q.converted_purchase_document_id,
    'items', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', qi.id,
          'product_id', qi.product_id,
          'product_name', p.name,
          'requested_qty', qi.requested_qty,
          'reference_unit_cost', qi.reference_unit_cost,
          'quoted_unit_cost', qi.quoted_unit_cost,
          'approved_qty', qi.approved_qty,
          'notes', qi.notes,
          'supplier_notes', qi.supplier_notes
        )
        order by p.name
      ) filter (where qi.id is not null),
      '[]'::jsonb
    )
  )
  into v_result
  from public.purchase_quotations q
  join public.suppliers s
    on s.id = q.supplier_id
  left join public.purchase_quotation_items qi
    on qi.quotation_id = q.id
  left join public.products p
    on p.id = qi.product_id
  where q.id = p_quotation_id
  group by q.id, s.name;

  return v_result;
end;
$function$;

grant execute on function public.mark_purchase_quotations_expired_safe(uuid) to authenticated;
grant execute on function public.create_purchase_quotation(uuid, jsonb, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.get_purchase_quotations_by_store(uuid, text, integer) to authenticated;
grant execute on function public.get_purchase_quotation_detail(uuid) to authenticated;
