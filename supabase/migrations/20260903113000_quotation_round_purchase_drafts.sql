create table if not exists public.purchase_quotation_rounds (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  round_code text not null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'under_review', 'converted', 'cancelled')),
  expires_at timestamptz,
  generated_at timestamptz,
  generated_by uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, round_code)
);

alter table public.purchase_quotation_rounds enable row level security;

drop policy if exists purchase_quotation_rounds_select_member on public.purchase_quotation_rounds;
create policy purchase_quotation_rounds_select_member
on public.purchase_quotation_rounds
for select
to authenticated
using (public.is_store_member(store_id));

revoke all on table public.purchase_quotation_rounds from public, anon;
grant select on table public.purchase_quotation_rounds to authenticated;
grant all on table public.purchase_quotation_rounds to service_role;

alter table public.purchase_quotations
  add column if not exists quotation_round_id uuid
  references public.purchase_quotation_rounds(id) on delete set null;

create index if not exists purchase_quotation_rounds_store_created_idx
  on public.purchase_quotation_rounds (store_id, created_at desc);

create index if not exists purchase_quotations_round_idx
  on public.purchase_quotations (quotation_round_id, supplier_id)
  where quotation_round_id is not null;

create or replace function public.create_purchase_quotation_round(
  p_supplier_ids jsonb,
  p_items jsonb,
  p_title text default null,
  p_message_subject text default null,
  p_message_bodies jsonb default '{}'::jsonb,
  p_supplier_channels jsonb default '{}'::jsonb,
  p_notes text default null,
  p_expires_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_round_id uuid;
  v_round_code text;
  v_store_id uuid;
  v_supplier_id uuid;
  v_supplier_store_id uuid;
  v_result record;
  v_quotations jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão inválida.';
  end if;

  if p_supplier_ids is null or jsonb_typeof(p_supplier_ids) <> 'array' or jsonb_array_length(p_supplier_ids) < 1 then
    raise exception 'Selecione ao menos um fornecedor para a rodada.';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 then
    raise exception 'Informe ao menos um produto para a rodada.';
  end if;

  select s.store_id
    into v_store_id
  from public.suppliers s
  where s.id = (p_supplier_ids->>0)::uuid;

  if v_store_id is null or not public.user_can_purchase_action(v_store_id, 'create') then
    raise exception 'Sem permissão para criar rodada de cotação nesta loja.';
  end if;

  for v_supplier_id in
    select distinct value::text::uuid
    from jsonb_array_elements_text(p_supplier_ids)
  loop
    select s.store_id into v_supplier_store_id
    from public.suppliers s
    where s.id = v_supplier_id
      and s.active is true
      and coalesce(s.blocked, false) is false
      and s.homologation_status = 'approved';

    if v_supplier_store_id is distinct from v_store_id then
      raise exception 'Todos os fornecedores devem estar aprovados e pertencer à mesma loja.';
    end if;
  end loop;

  v_round_code := 'RDC-' || to_char(timezone('America/Sao_Paulo', now()), 'YYYYMMDD-HH24MISS') || '-' || lpad((floor(random() * 1000))::int::text, 3, '0');

  insert into public.purchase_quotation_rounds (
    store_id, round_code, title, expires_at, metadata, created_by
  ) values (
    v_store_id,
    v_round_code,
    coalesce(nullif(trim(p_title), ''), 'Rodada de cotação ' || v_round_code),
    p_expires_at,
    jsonb_build_object('suppliers_count', jsonb_array_length(p_supplier_ids), 'items_count', jsonb_array_length(p_items)),
    auth.uid()
  ) returning id into v_round_id;

  for v_supplier_id in
    select distinct value::text::uuid
    from jsonb_array_elements_text(p_supplier_ids)
  loop
    select * into v_result
    from public.create_purchase_quotation(
      p_supplier_id := v_supplier_id,
      p_items := p_items,
      p_message_subject := p_message_subject,
      p_message_body := nullif(p_message_bodies->>v_supplier_id::text, ''),
      p_sent_channel := nullif(p_supplier_channels->>v_supplier_id::text, ''),
      p_responsible_name := null,
      p_notes := concat_ws(E'\n', nullif(p_notes, ''), 'Rodada: ' || v_round_code),
      p_expires_at := p_expires_at
    );

    update public.purchase_quotations
       set quotation_round_id = v_round_id,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('quotation_round_id', v_round_id, 'quotation_round_code', v_round_code)
     where id = v_result.quotation_id;

    v_quotations := v_quotations || jsonb_build_array(jsonb_build_object(
      'quotation_id', v_result.quotation_id,
      'quotation_code', v_result.quotation_code,
      'supplier_id', v_supplier_id,
      'items_count', v_result.items_count
    ));
  end loop;

  return jsonb_build_object(
    'round_id', v_round_id,
    'round_code', v_round_code,
    'quotations', v_quotations
  );
end;
$function$;

create or replace function public.get_purchase_quotation_rounds_by_store(
  p_store_id uuid,
  p_limit integer default 100
)
returns table (
  id uuid,
  round_code text,
  title text,
  status text,
  expires_at timestamptz,
  generated_at timestamptz,
  created_at timestamptz,
  suppliers_count integer,
  quotations_count integer,
  answered_count integer,
  expired_count integer,
  items_count integer,
  total_quoted numeric,
  quotation_ids uuid[]
)
language sql
security definer
set search_path = ''
as $function$
  select
    r.id,
    r.round_code,
    r.title,
    case
      when r.status = 'open' and count(q.id) filter (where q.status in ('answered', 'approved', 'converted')) > 0 then 'under_review'
      else r.status
    end,
    r.expires_at,
    r.generated_at,
    r.created_at,
    count(distinct q.supplier_id)::integer,
    count(distinct q.id)::integer,
    count(distinct q.id) filter (where q.status in ('answered', 'approved', 'converted'))::integer,
    count(distinct q.id) filter (where q.status = 'expired' or (q.status in ('draft', 'sent') and q.expires_at < now()))::integer,
    count(distinct qi.product_id)::integer,
    coalesce(sum(coalesce(qi.approved_qty, 0) * coalesce(qi.quoted_unit_cost, 0)), 0)::numeric,
    coalesce(array_agg(distinct q.id) filter (where q.id is not null), '{}'::uuid[])
  from public.purchase_quotation_rounds r
  left join public.purchase_quotations q on q.quotation_round_id = r.id
  left join public.purchase_quotation_items qi on qi.quotation_id = q.id
  where r.store_id = p_store_id
    and public.is_store_member(r.store_id)
  group by r.id
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 300);
$function$;

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

revoke all on function public.create_purchase_quotation_round(jsonb, jsonb, text, text, jsonb, jsonb, text, timestamptz) from public, anon;
revoke all on function public.get_purchase_quotation_rounds_by_store(uuid, integer) from public, anon;
revoke all on function public.generate_purchase_drafts_from_quotation_round(uuid, jsonb, text) from public, anon;
grant execute on function public.create_purchase_quotation_round(jsonb, jsonb, text, text, jsonb, jsonb, text, timestamptz) to authenticated, service_role;
grant execute on function public.get_purchase_quotation_rounds_by_store(uuid, integer) to authenticated, service_role;
grant execute on function public.generate_purchase_drafts_from_quotation_round(uuid, jsonb, text) to authenticated, service_role;

notify pgrst, 'reload schema';
