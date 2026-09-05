-- Recebimento parcial de compras com parcelas auditáveis, divergências e reversão segura.
-- O fluxo aplica somente quantidades aceitas ao estoque e substitui o recebimento total por mudança de status.

begin;

alter table public.purchase_documents drop constraint if exists purchase_documents_status_check;
alter table public.purchase_documents add constraint purchase_documents_status_check
  check (status = any (array['draft'::text, 'partially_received'::text, 'confirmed'::text, 'cancelled'::text]));

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_code text not null,
  purchase_document_id uuid not null references public.purchase_documents(id),
  purchase_document_code text,
  invoice_number text,
  store_id uuid not null references public.stores(id),
  supplier_id uuid not null references public.suppliers(id),
  location_id uuid not null references public.stock_locations(id),
  location_name text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'reversed')),
  reported_quantity_total numeric not null default 0 check (reported_quantity_total >= 0),
  accepted_quantity_total numeric not null default 0 check (accepted_quantity_total >= 0),
  divergence_count integer not null default 0 check (divergence_count >= 0),
  notes text,
  received_by uuid not null references auth.users(id),
  received_at timestamptz not null default now(),
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id),
  reversal_reason text,
  source text not null default 'purchase_receipt_rpc',
  created_at timestamptz not null default now(),
  constraint purchase_receipts_reversal_fields_check check (
    (status = 'confirmed' and reversed_at is null and reversed_by is null and reversal_reason is null)
    or (status = 'reversed' and reversed_at is not null and reversal_reason is not null)
  )
);

create unique index if not exists ux_purchase_receipts_store_code on public.purchase_receipts(store_id, receipt_code);
create index if not exists idx_purchase_receipts_document_received on public.purchase_receipts(purchase_document_id, received_at desc);
create index if not exists idx_purchase_receipts_store_status on public.purchase_receipts(store_id, status, received_at desc);
create index if not exists idx_purchase_receipts_location on public.purchase_receipts(location_id, received_at desc);

create table if not exists public.purchase_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_receipts(id),
  purchase_document_id uuid not null references public.purchase_documents(id),
  purchase_document_item_id uuid not null references public.purchase_document_items(id),
  store_id uuid not null references public.stores(id),
  product_id uuid not null references public.products(id),
  ordered_quantity numeric not null check (ordered_quantity > 0),
  previously_received_quantity numeric not null default 0 check (previously_received_quantity >= 0),
  reported_quantity numeric not null default 0 check (reported_quantity >= 0),
  accepted_quantity numeric not null default 0 check (accepted_quantity >= 0),
  pending_after_quantity numeric not null check (pending_after_quantity >= 0),
  shortage_quantity numeric not null default 0 check (shortage_quantity >= 0),
  damaged_quantity numeric not null default 0 check (damaged_quantity >= 0),
  wrong_item_quantity numeric not null default 0 check (wrong_item_quantity >= 0),
  excess_quantity numeric not null default 0 check (excess_quantity >= 0),
  divergence_note text,
  unit_cost numeric not null default 0 check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  constraint purchase_receipt_items_accepted_le_reported check (accepted_quantity <= reported_quantity),
  constraint purchase_receipt_items_unique_per_receipt unique (receipt_id, purchase_document_item_id)
);

create index if not exists idx_purchase_receipt_items_receipt on public.purchase_receipt_items(receipt_id);
create index if not exists idx_purchase_receipt_items_document_item on public.purchase_receipt_items(purchase_document_item_id);
create index if not exists idx_purchase_receipt_items_store_product on public.purchase_receipt_items(store_id, product_id);

alter table public.purchase_receipts enable row level security;
alter table public.purchase_receipt_items enable row level security;

drop policy if exists purchase_receipts_select_by_permission on public.purchase_receipts;
create policy purchase_receipts_select_by_permission on public.purchase_receipts
for select to authenticated using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'purchases.view')
  or public.user_has_store_permission(store_id, 'purchases.confirm')
  or public.user_has_store_permission(store_id, 'purchases.cancel')
  or public.user_has_store_permission(store_id, 'stock.view')
);

drop policy if exists purchase_receipt_items_select_by_permission on public.purchase_receipt_items;
create policy purchase_receipt_items_select_by_permission on public.purchase_receipt_items
for select to authenticated using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'purchases.view')
  or public.user_has_store_permission(store_id, 'purchases.confirm')
  or public.user_has_store_permission(store_id, 'purchases.cancel')
  or public.user_has_store_permission(store_id, 'stock.view')
);

revoke all on table public.purchase_receipts from public, anon, authenticated;
revoke all on table public.purchase_receipt_items from public, anon, authenticated;
grant select on table public.purchase_receipts to authenticated;
grant select on table public.purchase_receipt_items to authenticated;
grant all on table public.purchase_receipts to service_role;
grant all on table public.purchase_receipt_items to service_role;

-- O trigger antigo aplicava todos os itens ao local ao mudar o documento para confirmed.
-- O novo fluxo aplica somente accepted_quantity dentro da mesma transação da parcela.
drop trigger if exists trg_purchase_documents_apply_location_stock on public.purchase_documents;

create or replace function public._recalculate_purchase_document_receipt_status(p_document_id uuid)
returns text language plpgsql security definer set search_path = '' as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_has_active_receipt boolean := false;
  v_has_pending boolean := false;
  v_new_status text;
begin
  select * into v_document from public.purchase_documents where id = p_document_id for update;
  if v_document.id is null then raise exception 'Documento de compra não encontrado.'; end if;
  if v_document.status = 'cancelled' then return 'cancelled'; end if;

  select exists (
    select 1 from public.purchase_receipts pr
    where pr.purchase_document_id = v_document.id and pr.status = 'confirmed'
  ) into v_has_active_receipt;

  select exists (
    select 1
    from public.purchase_document_items pdi
    where pdi.purchase_document_id = v_document.id
      and pdi.store_id = v_document.store_id
      and coalesce((
        select sum(pri.accepted_quantity)
        from public.purchase_receipt_items pri
        join public.purchase_receipts pr on pr.id = pri.receipt_id
        where pri.purchase_document_item_id = pdi.id and pr.status = 'confirmed'
      ), 0) < pdi.quantity
  ) into v_has_pending;

  if not v_has_active_receipt then
    v_new_status := 'draft';
  elsif v_has_pending then
    v_new_status := 'partially_received';
  else
    v_new_status := 'confirmed';
  end if;

  if v_document.status is distinct from v_new_status then
    update public.purchase_documents set status = v_new_status where id = v_document.id;
  end if;
  return v_new_status;
end;
$function$;

revoke all on function public._recalculate_purchase_document_receipt_status(uuid) from public, anon, authenticated;

create or replace function public.receive_purchase_document_items(
  p_document_id uuid,
  p_location_id uuid,
  p_items jsonb,
  p_notes text default null
)
returns table(
  receipt_id uuid,
  receipt_code text,
  document_status text,
  accepted_quantity numeric,
  reported_quantity numeric,
  divergence_count integer,
  received_at timestamptz
)
language plpgsql security definer set search_path = '' as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_location public.stock_locations%rowtype;
  v_receipt_id uuid := gen_random_uuid();
  v_receipt_code text;
  v_received_at timestamptz := now();
  v_input jsonb;
  v_item public.purchase_document_items%rowtype;
  v_receipt_item_id uuid;
  v_item_id uuid;
  v_reported numeric;
  v_accepted numeric;
  v_shortage numeric;
  v_damaged numeric;
  v_wrong numeric;
  v_excess numeric;
  v_item_note text;
  v_already_received numeric;
  v_pending numeric;
  v_pending_after numeric;
  v_reported_total numeric := 0;
  v_accepted_total numeric := 0;
  v_divergence_count integer := 0;
  v_rows integer := 0;
  v_has_content boolean := false;
  v_global_before integer;
  v_global_after integer;
  v_location_before numeric := 0;
  v_location_after numeric := 0;
  v_location_reserved numeric := 0;
  v_document_status text;
  v_movement_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if p_document_id is null then raise exception 'Documento de compra não informado.'; end if;
  if p_location_id is null then raise exception 'Selecione o local que receberá a parcela.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item para o recebimento.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) elem
    where nullif(trim(coalesce(elem->>'purchase_document_item_id', '')), '') is null
  ) then
    raise exception 'Há item de recebimento sem identificador do item da compra.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct elem->>'purchase_document_item_id') from jsonb_array_elements(p_items) elem) then
    raise exception 'O mesmo item da compra não pode aparecer duas vezes na mesma parcela.';
  end if;

  select * into v_document from public.purchase_documents where id = p_document_id for update;
  if v_document.id is null then raise exception 'Documento de compra não encontrado.'; end if;
  if v_document.status not in ('draft', 'partially_received') then
    if v_document.status = 'confirmed' then raise exception 'Compra já está totalmente recebida.';
    elsif v_document.status = 'cancelled' then raise exception 'Compra cancelada não pode receber novas parcelas.';
    else raise exception 'Status da compra não permite recebimento: %.', v_document.status;
    end if;
  end if;
  if not public.user_can_purchase_action(v_document.store_id, 'confirm') then
    raise exception 'Sem permissão para receber compras nesta loja.';
  end if;

  select * into v_location
  from public.stock_locations
  where id = p_location_id and store_id = v_document.store_id and active is true;
  if v_location.id is null then raise exception 'Selecione um local de estoque ativo desta loja.'; end if;

  if v_document.document_code is null then
    update public.purchase_documents
    set document_code = public.generate_purchase_document_code(v_document.store_id)
    where id = v_document.id returning * into v_document;
  end if;

  v_receipt_code := 'REC-' || to_char(v_received_at, 'YYYYMMDD') || '-' || upper(substr(replace(v_receipt_id::text, '-', ''), 1, 8));

  insert into public.purchase_receipts(
    id, receipt_code, purchase_document_id, purchase_document_code, invoice_number,
    store_id, supplier_id, location_id, location_name, status, notes,
    received_by, received_at, source
  ) values (
    v_receipt_id, v_receipt_code, v_document.id, v_document.document_code, v_document.invoice_number,
    v_document.store_id, v_document.supplier_id, v_location.id, v_location.name, 'confirmed',
    nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), v_received_at, 'purchase_receipt_rpc'
  );

  for v_input in select value from jsonb_array_elements(p_items) loop
    begin
      v_item_id := (v_input->>'purchase_document_item_id')::uuid;
    exception when others then
      raise exception 'Identificador inválido em item do recebimento.';
    end;

    select * into v_item
    from public.purchase_document_items
    where id = v_item_id and purchase_document_id = v_document.id and store_id = v_document.store_id
    for update;
    if v_item.id is null then raise exception 'Item % não pertence ao documento de compra.', v_item_id; end if;

    begin
      v_reported := coalesce(nullif(v_input->>'received_quantity', '')::numeric, 0);
      v_accepted := coalesce(nullif(v_input->>'accepted_quantity', '')::numeric, 0);
      v_shortage := coalesce(nullif(v_input->>'shortage_quantity', '')::numeric, 0);
      v_damaged := coalesce(nullif(v_input->>'damaged_quantity', '')::numeric, 0);
      v_wrong := coalesce(nullif(v_input->>'wrong_item_quantity', '')::numeric, 0);
      v_excess := coalesce(nullif(v_input->>'excess_quantity', '')::numeric, 0);
    exception when others then
      raise exception 'Há quantidade inválida no recebimento do item %.', v_item_id;
    end;

    v_item_note := nullif(trim(coalesce(v_input->>'note', '')), '');
    if least(v_reported, v_accepted, v_shortage, v_damaged, v_wrong, v_excess) < 0 then
      raise exception 'Quantidades de recebimento e divergência não podem ser negativas.';
    end if;
    if trunc(v_reported) <> v_reported
      or trunc(v_accepted) <> v_accepted
      or trunc(v_shortage) <> v_shortage
      or trunc(v_damaged) <> v_damaged
      or trunc(v_wrong) <> v_wrong
      or trunc(v_excess) <> v_excess then
      raise exception 'O estoque físico atual exige quantidades inteiras no recebimento.';
    end if;

    select coalesce(sum(pri.accepted_quantity), 0)
    into v_already_received
    from public.purchase_receipt_items pri
    join public.purchase_receipts pr on pr.id = pri.receipt_id
    where pri.purchase_document_item_id = v_item.id and pr.status = 'confirmed';

    v_pending := greatest(v_item.quantity - v_already_received, 0);
    if v_pending <= 0 and (
      v_reported > 0 or v_accepted > 0 or v_shortage > 0 or v_damaged > 0
      or v_wrong > 0 or v_excess > 0 or v_item_note is not null
    ) then
      raise exception 'Item % já foi totalmente recebido e não aceita nova parcela.', v_item.id;
    end if;
    if v_accepted > v_pending then
      raise exception 'Quantidade aceita superior ao saldo pendente do item %. Pendente: %, aceita agora: %.',
        v_item.id, v_pending, v_accepted;
    end if;
    if v_accepted > v_reported then
      raise exception 'Quantidade aceita não pode ser maior que a quantidade recebida agora no item %.', v_item.id;
    end if;

    v_pending_after := v_pending - v_accepted;
    v_has_content := (
      v_reported > 0 or v_accepted > 0 or v_shortage > 0 or v_damaged > 0
      or v_wrong > 0 or v_excess > 0 or v_item_note is not null
    );
    if not v_has_content then continue; end if;

    insert into public.purchase_receipt_items(
      receipt_id, purchase_document_id, purchase_document_item_id, store_id, product_id,
      ordered_quantity, previously_received_quantity, reported_quantity, accepted_quantity,
      pending_after_quantity, shortage_quantity, damaged_quantity, wrong_item_quantity,
      excess_quantity, divergence_note, unit_cost
    ) values (
      v_receipt_id, v_document.id, v_item.id, v_document.store_id, v_item.product_id,
      v_item.quantity, v_already_received, v_reported, v_accepted, v_pending_after,
      v_shortage, v_damaged, v_wrong, v_excess, v_item_note, coalesce(v_item.unit_cost, 0)
    ) returning id into v_receipt_item_id;

    v_rows := v_rows + 1;
    v_reported_total := v_reported_total + v_reported;
    v_accepted_total := v_accepted_total + v_accepted;
    if v_shortage > 0 or v_damaged > 0 or v_wrong > 0 or v_excess > 0 or v_item_note is not null then
      v_divergence_count := v_divergence_count + 1;
    end if;

    if v_accepted > 0 then
      select coalesce(p.stock_quantity, 0) into v_global_before
      from public.products p
      where p.id = v_item.product_id and p.store_id = v_document.store_id
      for update;
      if not found then raise exception 'Produto do item % não encontrado para atualização de estoque.', v_item.id; end if;

      v_global_after := v_global_before + v_accepted::integer;
      perform set_config('app.allow_stock_update', 'true', true);
      update public.products p
      set stock_quantity = v_global_after,
          last_entry_unit_cost = coalesce(v_item.unit_cost, p.last_entry_unit_cost),
          last_stock_entry_at = v_received_at
      where p.id = v_item.product_id and p.store_id = v_document.store_id;

      select coalesce(ilb.on_hand, 0), coalesce(ilb.reserved, 0)
      into v_location_before, v_location_reserved
      from public.inventory_location_balances ilb
      where ilb.store_id = v_document.store_id
        and ilb.location_id = v_location.id
        and ilb.product_id = v_item.product_id
        and ilb.variant_id is null
      for update;

      if found then
        v_location_after := v_location_before + v_accepted;
        update public.inventory_location_balances ilb
        set on_hand = v_location_after, updated_at = v_received_at
        where ilb.store_id = v_document.store_id
          and ilb.location_id = v_location.id
          and ilb.product_id = v_item.product_id
          and ilb.variant_id is null;
      else
        v_location_before := 0;
        v_location_reserved := 0;
        v_location_after := v_accepted;
        insert into public.inventory_location_balances(
          store_id, location_id, product_id, variant_id, on_hand, reserved, updated_at
        ) values (
          v_document.store_id, v_location.id, v_item.product_id, null, v_accepted, 0, v_received_at
        );
      end if;

      insert into public.stock_movements(
        store_id, product_id, location_id, from_location_id, to_location_id,
        type, quantity, previous_stock, new_stock, reason, source, source_id,
        reason_code, affects_physical, created_by, supplier_id, metadata
      ) values (
        v_document.store_id, v_item.product_id, v_location.id, null, v_location.id,
        'entry'::public.stock_movement_type, v_accepted::integer, v_global_before, v_global_after,
        'Recebimento de compra: ' || v_receipt_code, 'purchase_receipt', v_receipt_id,
        'purchase_receipt_accepted', true, auth.uid(), v_document.supplier_id,
        jsonb_build_object(
          'origin', 'purchase_receipt',
          'purchase_receipt_id', v_receipt_id,
          'purchase_receipt_item_id', v_receipt_item_id,
          'receipt_code', v_receipt_code,
          'purchase_document_id', v_document.id,
          'purchase_document_item_id', v_item.id,
          'document_code', v_document.document_code,
          'invoice_number', v_document.invoice_number,
          'unit_cost', v_item.unit_cost,
          'ordered_quantity', v_item.quantity,
          'previously_received_quantity', v_already_received,
          'reported_quantity', v_reported,
          'accepted_quantity', v_accepted,
          'pending_after_quantity', v_pending_after,
          'location_id', v_location.id,
          'location_name', v_location.name,
          'on_hand_before_location', v_location_before,
          'on_hand_after_location', v_location_after
        )
      ) returning id into v_movement_id;
    end if;
  end loop;

  if v_rows = 0 then
    raise exception 'Informe uma quantidade recebida, uma divergência ou uma observação para registrar a parcela.';
  end if;

  update public.purchase_receipts
  set reported_quantity_total = v_reported_total,
      accepted_quantity_total = v_accepted_total,
      divergence_count = v_divergence_count
  where id = v_receipt_id;

  v_document_status := public._recalculate_purchase_document_receipt_status(v_document.id);

  perform public.create_operational_timeline_event(
    p_store_id := v_document.store_id,
    p_entity_type := 'purchase_document',
    p_entity_id := v_document.id,
    p_event_type := 'purchase_receipt_registered',
    p_title := case when v_document_status = 'confirmed' then 'Recebimento final registrado' else 'Recebimento parcial registrado' end,
    p_description := v_receipt_code || ' em ' || v_location.name || '. Aceito no estoque: ' || v_accepted_total || '.',
    p_severity := case when v_divergence_count > 0 then 'warning' else 'success' end,
    p_status := 'done',
    p_actor_user_id := auth.uid(),
    p_channel := 'manual',
    p_source := 'receive_purchase_document_items',
    p_source_id := v_receipt_id,
    p_old_data := jsonb_build_object('status', v_document.status),
    p_new_data := jsonb_build_object(
      'status', v_document_status,
      'receipt_id', v_receipt_id,
      'receipt_code', v_receipt_code,
      'location_id', v_location.id,
      'location_name', v_location.name,
      'reported_quantity', v_reported_total,
      'accepted_quantity', v_accepted_total,
      'divergence_count', v_divergence_count
    ),
    p_metadata := jsonb_build_object('origin', 'purchase_receipt', 'receipt_code', v_receipt_code),
    p_related_supplier_id := v_document.supplier_id,
    p_related_purchase_document_id := v_document.id
  );

  return query select
    v_receipt_id, v_receipt_code, v_document_status, v_accepted_total,
    v_reported_total, v_divergence_count, v_received_at;
end;
$function$;

revoke all on function public.receive_purchase_document_items(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.receive_purchase_document_items(uuid, uuid, jsonb, text) to authenticated, service_role;

create or replace function public.reverse_purchase_receipt(p_receipt_id uuid, p_reason text)
returns table(receipt_id uuid, receipt_code text, document_status text, reversed_at timestamptz)
language plpgsql security definer set search_path = '' as $function$
declare
  v_receipt public.purchase_receipts%rowtype;
  v_document public.purchase_documents%rowtype;
  v_item record;
  v_reversed_at timestamptz := now();
  v_global_before integer;
  v_global_after integer;
  v_location_before numeric;
  v_location_after numeric;
  v_location_reserved numeric;
  v_document_status text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'Informe um motivo com pelo menos 3 caracteres para reverter a parcela.';
  end if;

  select * into v_receipt from public.purchase_receipts where id = p_receipt_id for update;
  if v_receipt.id is null then raise exception 'Parcela de recebimento não encontrada.'; end if;
  if v_receipt.status = 'reversed' then raise exception 'Parcela já foi revertida.'; end if;

  select * into v_document
  from public.purchase_documents
  where id = v_receipt.purchase_document_id
  for update;
  if v_document.id is null then raise exception 'Documento de compra da parcela não encontrado.'; end if;
  if v_document.status = 'cancelled' then raise exception 'Compra cancelada não permite nova reversão de parcela.'; end if;
  if not public.user_can_purchase_action(v_document.store_id, 'cancel') then
    raise exception 'Sem permissão para reverter recebimentos nesta loja.';
  end if;

  for v_item in
    select pri.*
    from public.purchase_receipt_items pri
    where pri.receipt_id = v_receipt.id and pri.accepted_quantity > 0
    order by pri.id
  loop
    select coalesce(ilb.on_hand, 0), coalesce(ilb.reserved, 0)
    into v_location_before, v_location_reserved
    from public.inventory_location_balances ilb
    where ilb.store_id = v_receipt.store_id
      and ilb.location_id = v_receipt.location_id
      and ilb.product_id = v_item.product_id
      and ilb.variant_id is null
    for update;
    if not found then
      raise exception 'Saldo local não encontrado para reverter o item % da parcela %.', v_item.id, v_receipt.receipt_code;
    end if;
    if v_location_before < v_item.accepted_quantity then
      raise exception 'Saldo insuficiente no local % para reverter a parcela %. Produto: %, disponível: %, necessário: %.',
        v_receipt.location_name, v_receipt.receipt_code, v_item.product_id,
        v_location_before, v_item.accepted_quantity;
    end if;

    select coalesce(p.stock_quantity, 0) into v_global_before
    from public.products p
    where p.id = v_item.product_id and p.store_id = v_receipt.store_id
    for update;
    if not found then raise exception 'Produto % não encontrado para reversão.', v_item.product_id; end if;
    if v_global_before < v_item.accepted_quantity then
      raise exception 'A reversão deixaria o estoque global negativo. Produto: %, saldo: %, reversão: %.',
        v_item.product_id, v_global_before, v_item.accepted_quantity;
    end if;

    v_location_after := v_location_before - v_item.accepted_quantity;
    v_global_after := v_global_before - v_item.accepted_quantity::integer;

    update public.inventory_location_balances
    set on_hand = v_location_after, updated_at = v_reversed_at
    where store_id = v_receipt.store_id
      and location_id = v_receipt.location_id
      and product_id = v_item.product_id
      and variant_id is null;

    perform set_config('app.allow_stock_update', 'true', true);
    update public.products
    set stock_quantity = v_global_after
    where id = v_item.product_id and store_id = v_receipt.store_id;

    insert into public.stock_movements(
      store_id, product_id, location_id, from_location_id, to_location_id,
      type, quantity, previous_stock, new_stock, reason, source, source_id,
      reason_code, affects_physical, created_by, supplier_id, metadata
    ) values (
      v_receipt.store_id, v_item.product_id, v_receipt.location_id,
      v_receipt.location_id, null, 'exit'::public.stock_movement_type,
      -(v_item.accepted_quantity::integer), v_global_before, v_global_after,
      'Reversão de recebimento: ' || v_receipt.receipt_code,
      'purchase_receipt_reversal', v_receipt.id, 'purchase_receipt_reversed',
      true, auth.uid(), v_receipt.supplier_id,
      jsonb_build_object(
        'origin', 'purchase_receipt_reversal',
        'purchase_receipt_id', v_receipt.id,
        'purchase_receipt_item_id', v_item.id,
        'receipt_code', v_receipt.receipt_code,
        'purchase_document_id', v_receipt.purchase_document_id,
        'purchase_document_item_id', v_item.purchase_document_item_id,
        'document_code', v_receipt.purchase_document_code,
        'invoice_number', v_receipt.invoice_number,
        'accepted_quantity_reversed', v_item.accepted_quantity,
        'reversal_reason', trim(p_reason),
        'location_id', v_receipt.location_id,
        'location_name', v_receipt.location_name,
        'on_hand_before_location', v_location_before,
        'on_hand_after_location', v_location_after
      )
    );
  end loop;

  update public.purchase_receipts
  set status = 'reversed',
      reversed_at = v_reversed_at,
      reversed_by = auth.uid(),
      reversal_reason = trim(p_reason)
  where id = v_receipt.id;

  v_document_status := public._recalculate_purchase_document_receipt_status(v_receipt.purchase_document_id);

  perform public.create_operational_timeline_event(
    p_store_id := v_receipt.store_id,
    p_entity_type := 'purchase_document',
    p_entity_id := v_receipt.purchase_document_id,
    p_event_type := 'purchase_receipt_reversed',
    p_title := 'Parcela de recebimento revertida',
    p_description := v_receipt.receipt_code || ' revertida. Motivo: ' || trim(p_reason),
    p_severity := 'warning',
    p_status := 'done',
    p_actor_user_id := auth.uid(),
    p_channel := 'manual',
    p_source := 'reverse_purchase_receipt',
    p_source_id := v_receipt.id,
    p_old_data := jsonb_build_object('receipt_status', v_receipt.status, 'document_status', v_document.status),
    p_new_data := jsonb_build_object('receipt_status', 'reversed', 'document_status', v_document_status, 'reversal_reason', trim(p_reason)),
    p_metadata := jsonb_build_object('origin', 'purchase_receipt_reversal', 'receipt_code', v_receipt.receipt_code),
    p_related_supplier_id := v_receipt.supplier_id,
    p_related_purchase_document_id := v_receipt.purchase_document_id
  );

  return query select v_receipt.id, v_receipt.receipt_code, v_document_status, v_reversed_at;
end;
$function$;

revoke all on function public.reverse_purchase_receipt(uuid, text) from public, anon;
grant execute on function public.reverse_purchase_receipt(uuid, text) to authenticated, service_role;

-- Compatibilidade: o antigo recebimento total passa a receber todo o saldo pendente por meio da RPC nova.
create or replace function public.confirm_purchase_document_at_location(p_document_id uuid, p_location_id uuid)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_items jsonb;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_document from public.purchase_documents where id = p_document_id for update;
  if v_document.id is null then raise exception 'Documento de compra não encontrado.'; end if;
  if v_document.status not in ('draft', 'partially_received') then
    if v_document.status = 'confirmed' then raise exception 'Compra já está totalmente recebida.'; end if;
    raise exception 'Compra não permite recebimento no status atual: %.', v_document.status;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'purchase_document_item_id', pdi.id,
    'received_quantity', greatest(pdi.quantity - coalesce(received.accepted, 0), 0),
    'accepted_quantity', greatest(pdi.quantity - coalesce(received.accepted, 0), 0),
    'shortage_quantity', 0,
    'damaged_quantity', 0,
    'wrong_item_quantity', 0,
    'excess_quantity', 0,
    'note', null
  )), '[]'::jsonb)
  into v_items
  from public.purchase_document_items pdi
  left join lateral (
    select coalesce(sum(pri.accepted_quantity), 0) accepted
    from public.purchase_receipt_items pri
    join public.purchase_receipts pr on pr.id = pri.receipt_id
    where pri.purchase_document_item_id = pdi.id and pr.status = 'confirmed'
  ) received on true
  where pdi.purchase_document_id = v_document.id
    and pdi.store_id = v_document.store_id
    and greatest(pdi.quantity - coalesce(received.accepted, 0), 0) > 0;

  if jsonb_array_length(v_items) = 0 then raise exception 'Compra não possui saldo pendente para receber.'; end if;
  perform public.receive_purchase_document_items(
    p_document_id, p_location_id, v_items, 'Recebimento total pelo atalho de compatibilidade.'
  );
end;
$function$;

revoke all on function public.confirm_purchase_document_at_location(uuid, uuid) from public, anon;
grant execute on function public.confirm_purchase_document_at_location(uuid, uuid) to authenticated, service_role;

create or replace function public.confirm_purchase_document(p_document_id uuid)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_location_id uuid;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_document from public.purchase_documents where id = p_document_id for update;
  if v_document.id is null then raise exception 'Documento de compra não encontrado.'; end if;

  select sl.id into v_location_id
  from public.stock_locations sl
  where sl.store_id = v_document.store_id and sl.active is true
  order by sl.is_default desc, (upper(coalesce(sl.code, '')) = 'MAIN') desc, sl.sort_order asc, sl.created_at asc
  limit 1;
  if v_location_id is null then raise exception 'Nenhum local de estoque ativo encontrado para a loja.'; end if;
  perform public.confirm_purchase_document_at_location(p_document_id, v_location_id);
end;
$function$;

revoke all on function public.confirm_purchase_document(uuid) from public, anon;
grant execute on function public.confirm_purchase_document(uuid) to authenticated, service_role;

create or replace function public._cancel_purchase_document_from_receipts(
  p_document_id uuid,
  p_reason text,
  p_master_password text default null,
  p_require_master_password boolean default false
)
returns void language plpgsql security definer set search_path = '' as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_receipt record;
  v_stock_password_hash text;
  v_active_receipts integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Informe um motivo válido para o cancelamento.'; end if;

  select * into v_document from public.purchase_documents where id = p_document_id for update;
  if v_document.id is null then raise exception 'Documento não encontrado.'; end if;
  if not public.user_can_purchase_action(v_document.store_id, 'cancel') then
    raise exception 'Sem permissão para cancelar compras nesta loja.';
  end if;
  if v_document.status = 'cancelled' then raise exception 'Documento já está cancelado.'; end if;
  if v_document.status not in ('partially_received', 'confirmed') then
    raise exception 'Somente compras com recebimento podem ser canceladas por este fluxo.';
  end if;

  if p_require_master_password then
    if p_master_password is null or length(trim(p_master_password)) = 0 then raise exception 'Informe a senha master.'; end if;
    select st.stock_password_hash into v_stock_password_hash from public.stores st where st.id = v_document.store_id;
    if v_stock_password_hash is null then raise exception 'Senha master da loja não configurada.'; end if;
    if extensions.crypt(p_master_password, v_stock_password_hash) <> v_stock_password_hash then raise exception 'Senha master inválida.'; end if;
  end if;

  for v_receipt in
    select pr.id
    from public.purchase_receipts pr
    where pr.purchase_document_id = v_document.id and pr.status = 'confirmed'
    order by pr.received_at desc, pr.created_at desc
  loop
    v_active_receipts := v_active_receipts + 1;
    perform public.reverse_purchase_receipt(
      v_receipt.id,
      'Cancelamento integral da compra: ' || trim(p_reason)
    );
  end loop;

  if v_active_receipts = 0 then raise exception 'Nenhuma parcela ativa encontrada para cancelar a compra.'; end if;

  update public.purchase_documents
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = auth.uid(),
      cancel_reason = trim(p_reason)
  where id = v_document.id;

  perform public.create_operational_timeline_event(
    p_store_id := v_document.store_id,
    p_entity_type := 'purchase_document',
    p_entity_id := v_document.id,
    p_event_type := 'purchase_document_cancelled',
    p_title := 'Compra cancelada',
    p_description := 'Compra cancelada após reversão auditável de ' || v_active_receipts || ' parcela(s).',
    p_severity := 'warning',
    p_status := 'cancelled',
    p_actor_user_id := auth.uid(),
    p_channel := 'manual',
    p_source := 'cancel_purchase_document',
    p_source_id := v_document.id,
    p_old_data := jsonb_build_object('status', v_document.status),
    p_new_data := jsonb_build_object('status', 'cancelled', 'cancel_reason', trim(p_reason), 'reversed_receipts', v_active_receipts),
    p_metadata := jsonb_build_object('origin', 'purchase_receipt_cancel_flow'),
    p_related_supplier_id := v_document.supplier_id,
    p_related_purchase_document_id := v_document.id
  );
end;
$function$;

revoke all on function public._cancel_purchase_document_from_receipts(uuid, text, text, boolean) from public, anon, authenticated;

create or replace function public.cancel_purchase_document(p_document_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $function$
begin
  if exists(
    select 1 from public.purchase_receipts
    where purchase_document_id = p_document_id and status = 'confirmed'
  ) then
    perform public._cancel_purchase_document_from_receipts(p_document_id, p_reason, null, false);
  else
    perform public._cancel_purchase_document_core(
      p_document_id := p_document_id,
      p_reason := p_reason,
      p_master_password := null,
      p_require_master_password := false
    );
  end if;
end;
$function$;

create or replace function public.cancel_purchase_document(p_document_id uuid, p_reason text, p_master_password text)
returns void language plpgsql security definer set search_path = '' as $function$
begin
  if exists(
    select 1 from public.purchase_receipts
    where purchase_document_id = p_document_id and status = 'confirmed'
  ) then
    perform public._cancel_purchase_document_from_receipts(p_document_id, p_reason, p_master_password, true);
  else
    perform public._cancel_purchase_document_core(
      p_document_id := p_document_id,
      p_reason := p_reason,
      p_master_password := p_master_password,
      p_require_master_password := true
    );
  end if;
end;
$function$;

revoke all on function public.cancel_purchase_document(uuid, text) from public, anon;
revoke all on function public.cancel_purchase_document(uuid, text, text) from public, anon;
grant execute on function public.cancel_purchase_document(uuid, text) to authenticated, service_role;
grant execute on function public.cancel_purchase_document(uuid, text, text) to authenticated, service_role;

create or replace function public.trg_log_purchase_document_changes()
returns trigger language plpgsql security definer set search_path = 'public', 'auth' as $function$
declare
  v_user_email text;
  v_action text;
begin
  select email::text into v_user_email from auth.users where id = auth.uid();

  if tg_op = 'INSERT' then
    v_action := 'Criar Documento de Compra';
    insert into public.store_security_logs(store_id, user_id, user_email, action, details, outcome, created_at)
    values(
      new.store_id, auth.uid(), v_user_email, v_action,
      jsonb_build_object(
        'purchase_document_id', new.id,
        'document_code', new.document_code,
        'invoice_number', new.invoice_number,
        'supplier_id', new.supplier_id,
        'status', new.status,
        'total_amount', new.total_amount
      ),
      'success', now()
    );
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_action := case
      when old.status is distinct from new.status and new.status = 'partially_received' then 'Recebimento Parcial de Compra'
      when old.status is distinct from new.status and new.status = 'confirmed' then 'Confirmar Documento de Compra'
      when old.status is distinct from new.status and new.status = 'cancelled' then 'Cancelar Documento de Compra'
      else 'Editar Documento de Compra'
    end;

    insert into public.store_security_logs(store_id, user_id, user_email, action, details, outcome, created_at)
    values(
      new.store_id, auth.uid(), v_user_email, v_action,
      jsonb_build_object(
        'purchase_document_id', new.id,
        'document_code', new.document_code,
        'invoice_number', new.invoice_number,
        'supplier_id', new.supplier_id,
        'old', jsonb_build_object(
          'status', old.status,
          'total_amount', old.total_amount,
          'notes', old.notes,
          'cancelled_at', old.cancelled_at,
          'cancel_reason', old.cancel_reason
        ),
        'new', jsonb_build_object(
          'status', new.status,
          'total_amount', new.total_amount,
          'notes', new.notes,
          'cancelled_at', new.cancelled_at,
          'cancel_reason', new.cancel_reason
        )
      ),
      'success', now()
    );
    return new;
  end if;

  return new;
end;
$function$;

-- Converte recebimentos totais legados em histórico de parcelas sem tocar novamente no estoque.
insert into public.purchase_receipts(
  id, receipt_code, purchase_document_id, purchase_document_code, invoice_number,
  store_id, supplier_id, location_id, location_name, status,
  reported_quantity_total, accepted_quantity_total, divergence_count, notes,
  received_by, received_at, reversed_at, reversed_by, reversal_reason, source, created_at
)
select
  gen_random_uuid(),
  'REC-LEG-' || upper(substr(replace(min(pdla.id::text), '-', ''), 1, 12)),
  pd.id, pd.document_code, pd.invoice_number, pd.store_id, pd.supplier_id,
  pdla.location_id, coalesce(sl.name, pdla.location_id::text),
  case when pd.status = 'cancelled' then 'reversed' else 'confirmed' end,
  sum(pdla.quantity), sum(pdla.quantity), 0,
  'Recebimento total legado convertido para histórico de parcelas.',
  coalesce((
    select ote.actor_user_id
    from public.operational_timeline_events ote
    where ote.related_purchase_document_id = pd.id
      and ote.actor_user_id is not null
      and ote.event_type in ('purchase_document_received', 'purchase_document_confirmed', 'purchase_document_applied_to_inventory')
    order by ote.occurred_at asc
    limit 1
  ), st.user_id),
  min(pdla.applied_at),
  case when pd.status = 'cancelled' then coalesce(pd.cancelled_at, now()) else null end,
  case when pd.status = 'cancelled' then coalesce(pd.cancelled_by, st.user_id) else null end,
  case when pd.status = 'cancelled' then coalesce(pd.cancel_reason, 'Cancelamento legado') else null end,
  'legacy_total_receipt',
  min(pdla.applied_at)
from public.purchase_documents pd
join public.purchase_document_location_applications pdla on pdla.purchase_document_id = pd.id
join public.stores st on st.id = pd.store_id
left join public.stock_locations sl on sl.id = pdla.location_id
where pd.status in ('confirmed', 'cancelled')
  and not exists(
    select 1 from public.purchase_receipts pr where pr.purchase_document_id = pd.id
  )
group by
  pd.id, pd.document_code, pd.invoice_number, pd.store_id, pd.supplier_id,
  pdla.location_id, sl.name, pd.status, pd.cancelled_at, pd.cancelled_by,
  pd.cancel_reason, st.user_id;

insert into public.purchase_receipt_items(
  receipt_id, purchase_document_id, purchase_document_item_id, store_id, product_id,
  ordered_quantity, previously_received_quantity, reported_quantity, accepted_quantity,
  pending_after_quantity, shortage_quantity, damaged_quantity, wrong_item_quantity,
  excess_quantity, divergence_note, unit_cost, created_at
)
select
  pr.id, pdi.purchase_document_id, pdi.id, pdi.store_id, pdi.product_id,
  pdi.quantity, 0, pdla.quantity, pdla.quantity,
  greatest(pdi.quantity - pdla.quantity, 0), 0, 0, 0, 0, null,
  coalesce(pdi.unit_cost, 0), pdla.applied_at
from public.purchase_document_items pdi
join public.purchase_document_location_applications pdla on pdla.purchase_document_item_id = pdi.id
join public.purchase_receipts pr
  on pr.purchase_document_id = pdi.purchase_document_id
  and pr.location_id = pdla.location_id
  and pr.source = 'legacy_total_receipt'
where not exists(
  select 1
  from public.purchase_receipt_items pri
  where pri.receipt_id = pr.id and pri.purchase_document_item_id = pdi.id
);

notify pgrst, 'reload schema';
commit;
