-- Tratativas auditáveis para diferenças em recebimentos de compras.
-- Separa pendência física (reposição/entrega futura) de pendência comercial/documental.

begin;

create table if not exists public.purchase_receipt_issues (
  id uuid primary key default gen_random_uuid(),
  issue_code text not null,
  store_id uuid not null references public.stores(id),
  purchase_document_id uuid not null references public.purchase_documents(id),
  receipt_id uuid references public.purchase_receipts(id),
  purchase_receipt_item_id uuid references public.purchase_receipt_items(id),
  purchase_document_item_id uuid not null references public.purchase_document_items(id),
  product_id uuid not null references public.products(id),
  supplier_id uuid not null references public.suppliers(id),
  issue_type text not null check (issue_type in ('shortage','damage','wrong_item','excess','other')),
  issue_scope text not null check (issue_scope in ('missing','rejected','excess','existing_pending')),
  quantity numeric not null check (quantity > 0),
  disposition text not null check (disposition in ('awaiting_replacement','discount','supplier_credit','partial_return','accepted_closed','other')),
  status text not null check (status in ('waiting_supplier','waiting_financial','waiting_document','resolved','cancelled')),
  replacement_pending_quantity numeric not null default 0 check (replacement_pending_quantity >= 0),
  physical_closed_quantity numeric not null default 0 check (physical_closed_quantity >= 0),
  estimated_amount numeric not null default 0 check (estimated_amount >= 0),
  notes text,
  opened_by uuid not null references auth.users(id),
  opened_at timestamptz not null default now(),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolution_notes text,
  resolution_reference text,
  cancelled_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_receipt_issues_qty_partition_check check (
    replacement_pending_quantity <= quantity and physical_closed_quantity <= quantity
  ),
  constraint purchase_receipt_issues_code_unique unique(store_id, issue_code)
);

create index if not exists idx_purchase_receipt_issues_store_status
  on public.purchase_receipt_issues(store_id, status, opened_at desc);
create index if not exists idx_purchase_receipt_issues_document
  on public.purchase_receipt_issues(purchase_document_id, opened_at desc);
create index if not exists idx_purchase_receipt_issues_document_item
  on public.purchase_receipt_issues(purchase_document_item_id, status);
create index if not exists idx_purchase_receipt_issues_receipt
  on public.purchase_receipt_issues(receipt_id) where receipt_id is not null;
create index if not exists idx_purchase_receipt_issues_receipt_item
  on public.purchase_receipt_issues(purchase_receipt_item_id) where purchase_receipt_item_id is not null;
create index if not exists idx_purchase_receipt_issues_supplier
  on public.purchase_receipt_issues(supplier_id, status, opened_at desc);
create index if not exists idx_purchase_receipt_issues_product
  on public.purchase_receipt_issues(product_id, status, opened_at desc);
create index if not exists idx_purchase_receipt_issues_opened_by
  on public.purchase_receipt_issues(opened_by);
create index if not exists idx_purchase_receipt_issues_resolved_by
  on public.purchase_receipt_issues(resolved_by) where resolved_by is not null;
create index if not exists idx_purchase_receipt_issues_cancelled_by
  on public.purchase_receipt_issues(cancelled_by) where cancelled_by is not null;

alter table public.purchase_receipt_issues enable row level security;
drop policy if exists purchase_receipt_issues_select_by_permission on public.purchase_receipt_issues;
create policy purchase_receipt_issues_select_by_permission on public.purchase_receipt_issues
for select to authenticated using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'purchases.view')
  or public.user_has_store_permission(store_id, 'purchases.confirm')
  or public.user_has_store_permission(store_id, 'purchases.cancel')
  or public.user_has_store_permission(store_id, 'stock.view')
);

revoke all on table public.purchase_receipt_issues from public, anon, authenticated;
grant select on table public.purchase_receipt_issues to authenticated;
grant all on table public.purchase_receipt_issues to service_role;

create or replace function public._recalculate_purchase_document_receipt_status(p_document_id uuid)
returns text language plpgsql security definer set search_path = '' as $function$
declare
  v_document public.purchase_documents%rowtype;
  v_has_activity boolean := false;
  v_has_pending boolean := false;
  v_new_status text;
begin
  select * into v_document from public.purchase_documents where id = p_document_id for update;
  if v_document.id is null then raise exception 'Documento de compra não encontrado.'; end if;
  if v_document.status = 'cancelled' then return 'cancelled'; end if;

  select (
    exists (
      select 1 from public.purchase_receipts pr
      where pr.purchase_document_id = v_document.id and pr.status = 'confirmed'
    )
    or exists (
      select 1 from public.purchase_receipt_issues pri
      where pri.purchase_document_id = v_document.id and pri.status <> 'cancelled'
    )
  ) into v_has_activity;

  select exists (
    select 1
    from public.purchase_document_items pdi
    where pdi.purchase_document_id = v_document.id
      and pdi.store_id = v_document.store_id
      and (
        coalesce((
          select sum(ri.accepted_quantity)
          from public.purchase_receipt_items ri
          join public.purchase_receipts r on r.id = ri.receipt_id
          where ri.purchase_document_item_id = pdi.id and r.status = 'confirmed'
        ), 0)
        + coalesce((
          select sum(i.physical_closed_quantity)
          from public.purchase_receipt_issues i
          where i.purchase_document_item_id = pdi.id
            and i.status <> 'cancelled'
            and i.issue_type <> 'excess'
        ), 0)
      ) < pdi.quantity
  ) into v_has_pending;

  if not v_has_activity then
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
  v_issues jsonb;
  v_issue jsonb;
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
  v_physically_closed numeric;
  v_pending numeric;
  v_pending_after numeric;
  v_new_physical_closed numeric;
  v_missing numeric;
  v_rejected numeric;
  v_excess_presented numeric;
  v_issue_qty numeric;
  v_issue_type text;
  v_issue_scope text;
  v_disposition text;
  v_issue_note text;
  v_issue_status text;
  v_issue_physical_closed numeric;
  v_issue_replacement numeric;
  v_issue_id uuid;
  v_issue_code text;
  v_scope_missing numeric;
  v_scope_rejected numeric;
  v_scope_excess numeric;
  v_scope_existing numeric;
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
  v_replace_left numeric;
  v_replace_take numeric;
  v_old_issue record;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if p_document_id is null then raise exception 'Documento de compra não informado.'; end if;
  if p_location_id is null then raise exception 'Selecione o local que receberá a parcela.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Informe ao menos um item para o recebimento ou para a tratativa.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) elem
    where nullif(trim(coalesce(elem->>'purchase_document_item_id', '')), '') is null
  ) then raise exception 'Há item sem identificador do item da compra.'; end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct elem->>'purchase_document_item_id') from jsonb_array_elements(p_items) elem) then
    raise exception 'O mesmo item da compra não pode aparecer duas vezes na mesma operação.';
  end if;

  select * into v_document from public.purchase_documents where id = p_document_id for update;
  if v_document.id is null then raise exception 'Documento de compra não encontrado.'; end if;
  if v_document.status not in ('draft', 'partially_received') then
    if v_document.status = 'confirmed' then raise exception 'Compra já está fisicamente concluída.';
    elsif v_document.status = 'cancelled' then raise exception 'Compra cancelada não aceita novas operações.';
    else raise exception 'Status da compra não permite recebimento: %.', v_document.status; end if;
  end if;
  if not public.user_can_purchase_action(v_document.store_id, 'confirm') then
    raise exception 'Sem permissão para receber compras nesta loja.';
  end if;

  select * into v_location from public.stock_locations
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
    begin v_item_id := (v_input->>'purchase_document_item_id')::uuid;
    exception when others then raise exception 'Identificador inválido em item do recebimento.'; end;

    select * into v_item from public.purchase_document_items
    where id = v_item_id and purchase_document_id = v_document.id and store_id = v_document.store_id
    for update;
    if v_item.id is null then raise exception 'Item % não pertence ao documento de compra.', v_item_id; end if;

    begin
      v_reported := coalesce(nullif(v_input->>'received_quantity', '')::numeric, 0);
      v_accepted := coalesce(nullif(v_input->>'accepted_quantity', '')::numeric, 0);
    exception when others then raise exception 'Há quantidade inválida no recebimento do item %.', v_item_id; end;
    v_item_note := nullif(trim(coalesce(v_input->>'note', '')), '');
    v_issues := coalesce(v_input->'issues', '[]'::jsonb);
    if jsonb_typeof(v_issues) <> 'array' then raise exception 'Formato inválido de ressalvas no item %.', v_item.id; end if;
    if least(v_reported, v_accepted) < 0 then raise exception 'Quantidades não podem ser negativas.'; end if;
    if trunc(v_reported) <> v_reported or trunc(v_accepted) <> v_accepted then
      raise exception 'O estoque físico atual exige quantidades inteiras no recebimento.';
    end if;

    select coalesce(sum(ri.accepted_quantity), 0) into v_already_received
    from public.purchase_receipt_items ri
    join public.purchase_receipts r on r.id = ri.receipt_id
    where ri.purchase_document_item_id = v_item.id and r.status = 'confirmed';

    select coalesce(sum(i.physical_closed_quantity), 0) into v_physically_closed
    from public.purchase_receipt_issues i
    where i.purchase_document_item_id = v_item.id and i.status <> 'cancelled' and i.issue_type <> 'excess';

    v_pending := greatest(v_item.quantity - v_already_received - v_physically_closed, 0);
    if v_pending <= 0 and (v_reported > 0 or v_accepted > 0 or jsonb_array_length(v_issues) > 0 or v_item_note is not null) then
      raise exception 'Item % já está fisicamente concluído e não aceita nova quantidade ou ressalva.', v_item.id;
    end if;
    if v_accepted > v_pending then
      raise exception 'Quantidade aceita superior ao saldo físico em aberto do item %. Em aberto: %, aceita agora: %.', v_item.id, v_pending, v_accepted;
    end if;
    if v_accepted > v_reported then raise exception 'Quantidade aceita não pode ser maior que a quantidade apresentada pelo fornecedor.'; end if;

    v_missing := greatest(v_pending - least(v_reported, v_pending), 0);
    v_rejected := greatest(least(v_reported, v_pending) - v_accepted, 0);
    v_excess_presented := greatest(v_reported - v_pending, 0);
    v_scope_missing := 0; v_scope_rejected := 0; v_scope_excess := 0; v_scope_existing := 0;
    v_shortage := 0; v_damaged := 0; v_wrong := 0; v_excess := 0; v_new_physical_closed := 0;

    for v_issue in select value from jsonb_array_elements(v_issues) loop
      begin v_issue_qty := coalesce(nullif(v_issue->>'quantity','')::numeric, 0);
      exception when others then raise exception 'Quantidade inválida em uma ressalva do item %.', v_item.id; end;
      v_issue_type := lower(trim(coalesce(v_issue->>'issue_type','')));
      v_issue_scope := lower(trim(coalesce(v_issue->>'scope','')));
      v_disposition := lower(trim(coalesce(v_issue->>'disposition','')));
      v_issue_note := nullif(trim(coalesce(v_issue->>'note','')), '');

      if v_issue_qty <= 0 or trunc(v_issue_qty) <> v_issue_qty then raise exception 'A quantidade da ressalva deve ser inteira e maior que zero.'; end if;
      if v_issue_type not in ('shortage','damage','wrong_item','excess','other') then raise exception 'Tipo de ressalva inválido: %.', v_issue_type; end if;
      if v_issue_scope not in ('missing','rejected','excess','existing_pending') then raise exception 'Origem da diferença inválida: %.', v_issue_scope; end if;
      if v_disposition not in ('awaiting_replacement','discount','supplier_credit','partial_return','accepted_closed','other') then raise exception 'Tratativa inválida: %.', v_disposition; end if;
      if (v_issue_type = 'other' or v_disposition = 'other') and coalesce(length(v_issue_note),0) < 3 then
        raise exception 'Descreva a ocorrência quando usar a opção Outro.';
      end if;
      if v_issue_scope = 'excess' and v_issue_type not in ('excess','other') then raise exception 'Quantidade excedente deve ser classificada como Excesso ou Outro.'; end if;

      if v_issue_scope = 'missing' then v_scope_missing := v_scope_missing + v_issue_qty;
      elsif v_issue_scope = 'rejected' then v_scope_rejected := v_scope_rejected + v_issue_qty;
      elsif v_issue_scope = 'excess' then v_scope_excess := v_scope_excess + v_issue_qty;
      else v_scope_existing := v_scope_existing + v_issue_qty; end if;

      if v_issue_type = 'shortage' then v_shortage := v_shortage + v_issue_qty;
      elsif v_issue_type = 'damage' then v_damaged := v_damaged + v_issue_qty;
      elsif v_issue_type = 'wrong_item' then v_wrong := v_wrong + v_issue_qty;
      elsif v_issue_type = 'excess' then v_excess := v_excess + v_issue_qty; end if;

      if v_issue_type <> 'excess' and v_disposition <> 'awaiting_replacement' then
        v_new_physical_closed := v_new_physical_closed + v_issue_qty;
      end if;
    end loop;

    if v_scope_missing > v_missing then raise exception 'Ressalvas de falta (% un.) excedem o que não veio nesta entrega (% un.).', v_scope_missing, v_missing; end if;
    if v_scope_rejected <> v_rejected then
      if v_rejected > 0 then raise exception '% un. chegaram, mas não entrarão no estoque. Classifique integralmente essa diferença.', v_rejected;
      elsif v_scope_rejected > 0 then raise exception 'Não há quantidade rejeitada para esta ressalva.'; end if;
    end if;
    if v_scope_excess <> v_excess_presented then
      if v_excess_presented > 0 then raise exception '% un. vieram além do saldo do pedido. Registre a tratativa do excesso.', v_excess_presented;
      elsif v_scope_excess > 0 then raise exception 'Não há excesso apresentado para esta ressalva.'; end if;
    end if;
    if v_scope_existing > 0 and (v_reported > 0 or v_accepted > 0) then
      raise exception 'Tratativa de saldo anterior deve ser registrada separadamente de uma nova entrega.';
    end if;
    if v_scope_existing > v_pending then raise exception 'A tratativa excede o saldo em aberto do item.'; end if;
    if v_new_physical_closed > (v_pending - v_accepted) then raise exception 'A tratativa encerraria quantidade física maior que o saldo restante.'; end if;

    v_has_content := v_reported > 0 or v_accepted > 0 or jsonb_array_length(v_issues) > 0 or v_item_note is not null;
    if not v_has_content then continue; end if;

    -- Antes de criar novas ressalvas, uma nova quantidade aceita quita reposições antigas do mesmo item.
    v_replace_left := v_accepted;
    if v_replace_left > 0 then
      for v_old_issue in
        select i.id, i.replacement_pending_quantity, i.issue_code
        from public.purchase_receipt_issues i
        where i.purchase_document_item_id = v_item.id
          and i.status = 'waiting_supplier'
          and i.disposition = 'awaiting_replacement'
          and i.replacement_pending_quantity > 0
        order by i.opened_at, i.id
        for update
      loop
        exit when v_replace_left <= 0;
        v_replace_take := least(v_replace_left, v_old_issue.replacement_pending_quantity);
        update public.purchase_receipt_issues
        set replacement_pending_quantity = replacement_pending_quantity - v_replace_take,
            status = case when replacement_pending_quantity - v_replace_take <= 0 then 'resolved' else status end,
            resolved_by = case when replacement_pending_quantity - v_replace_take <= 0 then auth.uid() else resolved_by end,
            resolved_at = case when replacement_pending_quantity - v_replace_take <= 0 then v_received_at else resolved_at end,
            resolution_notes = case when replacement_pending_quantity - v_replace_take <= 0
              then coalesce(resolution_notes || ' · ', '') || 'Reposição concluída no recebimento ' || v_receipt_code
              else resolution_notes end,
            resolution_reference = case when replacement_pending_quantity - v_replace_take <= 0 then v_receipt_code else resolution_reference end,
            updated_at = v_received_at
        where id = v_old_issue.id;
        v_replace_left := v_replace_left - v_replace_take;
      end loop;
    end if;

    v_pending_after := greatest(v_pending - v_accepted - v_new_physical_closed, 0);
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

    for v_issue in select value from jsonb_array_elements(v_issues) loop
      v_issue_qty := (v_issue->>'quantity')::numeric;
      v_issue_type := lower(trim(v_issue->>'issue_type'));
      v_issue_scope := lower(trim(v_issue->>'scope'));
      v_disposition := lower(trim(v_issue->>'disposition'));
      v_issue_note := nullif(trim(coalesce(v_issue->>'note','')), '');
      v_issue_id := gen_random_uuid();
      v_issue_code := 'RSV-' || to_char(v_received_at, 'YYYYMMDD') || '-' || upper(substr(replace(v_issue_id::text, '-', ''), 1, 8));
      v_issue_status := case
        when v_disposition = 'awaiting_replacement' then 'waiting_supplier'
        when v_disposition in ('discount','supplier_credit') then 'waiting_financial'
        when v_disposition in ('partial_return','other') then 'waiting_document'
        else 'resolved'
      end;
      v_issue_replacement := case when v_disposition = 'awaiting_replacement' and v_issue_type <> 'excess' then v_issue_qty else 0 end;
      v_issue_physical_closed := case when v_disposition <> 'awaiting_replacement' and v_issue_type <> 'excess' then v_issue_qty else 0 end;

      insert into public.purchase_receipt_issues(
        id, issue_code, store_id, purchase_document_id, receipt_id, purchase_receipt_item_id,
        purchase_document_item_id, product_id, supplier_id, issue_type, issue_scope, quantity,
        disposition, status, replacement_pending_quantity, physical_closed_quantity,
        estimated_amount, notes, opened_by, opened_at,
        resolved_by, resolved_at, resolution_notes
      ) values (
        v_issue_id, v_issue_code, v_document.store_id, v_document.id, v_receipt_id, v_receipt_item_id,
        v_item.id, v_item.product_id, v_document.supplier_id, v_issue_type, v_issue_scope, v_issue_qty,
        v_disposition, v_issue_status, v_issue_replacement, v_issue_physical_closed,
        v_issue_qty * coalesce(v_item.unit_cost, 0), v_issue_note, auth.uid(), v_received_at,
        case when v_issue_status = 'resolved' then auth.uid() else null end,
        case when v_issue_status = 'resolved' then v_received_at else null end,
        case when v_issue_status = 'resolved' then 'Diferença aceita e encerrada no próprio recebimento.' else null end
      );
      v_divergence_count := v_divergence_count + 1;
    end loop;

    if v_accepted > 0 then
      select coalesce(p.stock_quantity, 0) into v_global_before
      from public.products p where p.id = v_item.product_id and p.store_id = v_document.store_id for update;
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
      where ilb.store_id = v_document.store_id and ilb.location_id = v_location.id
        and ilb.product_id = v_item.product_id and ilb.variant_id is null for update;
      if found then
        v_location_after := v_location_before + v_accepted;
        update public.inventory_location_balances ilb set on_hand = v_location_after, updated_at = v_received_at
        where ilb.store_id = v_document.store_id and ilb.location_id = v_location.id
          and ilb.product_id = v_item.product_id and ilb.variant_id is null;
      else
        v_location_before := 0; v_location_reserved := 0; v_location_after := v_accepted;
        insert into public.inventory_location_balances(store_id, location_id, product_id, variant_id, on_hand, reserved, updated_at)
        values(v_document.store_id, v_location.id, v_item.product_id, null, v_accepted, 0, v_received_at);
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
          'origin','purchase_receipt','purchase_receipt_id',v_receipt_id,
          'purchase_receipt_item_id',v_receipt_item_id,'receipt_code',v_receipt_code,
          'purchase_document_id',v_document.id,'purchase_document_item_id',v_item.id,
          'document_code',v_document.document_code,'invoice_number',v_document.invoice_number,
          'unit_cost',v_item.unit_cost,'ordered_quantity',v_item.quantity,
          'previously_received_quantity',v_already_received,'reported_quantity',v_reported,
          'accepted_quantity',v_accepted,'pending_after_quantity',v_pending_after,
          'location_id',v_location.id,'location_name',v_location.name,
          'on_hand_before_location',v_location_before,'on_hand_after_location',v_location_after
        )
      ) returning id into v_movement_id;
    end if;
  end loop;

  if v_rows = 0 then raise exception 'Informe uma quantidade recebida ou uma tratativa de diferença.'; end if;
  update public.purchase_receipts
  set reported_quantity_total = v_reported_total,
      accepted_quantity_total = v_accepted_total,
      divergence_count = v_divergence_count,
      source = case when v_reported_total = 0 and v_accepted_total = 0 and v_divergence_count > 0 then 'purchase_issue_treatment' else source end
  where id = v_receipt_id;

  v_document_status := public._recalculate_purchase_document_receipt_status(v_document.id);
  perform public.create_operational_timeline_event(
    p_store_id := v_document.store_id,
    p_entity_type := 'purchase_document', p_entity_id := v_document.id,
    p_event_type := case when v_divergence_count > 0 then 'purchase_receipt_with_issue' else 'purchase_receipt_registered' end,
    p_title := case
      when v_reported_total = 0 and v_divergence_count > 0 then 'Tratativa de ressalva registrada'
      when v_divergence_count > 0 then 'Recebimento com ressalva registrado'
      when v_document_status = 'confirmed' then 'Recebimento final registrado'
      else 'Recebimento parcial registrado' end,
    p_description := v_receipt_code || ' em ' || v_location.name || '. Aceito no estoque: ' || v_accepted_total ||
      case when v_divergence_count > 0 then '. Ressalvas: ' || v_divergence_count || '.' else '.' end,
    p_severity := case when v_divergence_count > 0 then 'warning' else 'success' end,
    p_status := 'done', p_actor_user_id := auth.uid(), p_channel := 'manual',
    p_source := 'receive_purchase_document_items', p_source_id := v_receipt_id,
    p_old_data := jsonb_build_object('status', v_document.status),
    p_new_data := jsonb_build_object('status',v_document_status,'receipt_id',v_receipt_id,'receipt_code',v_receipt_code,
      'location_id',v_location.id,'location_name',v_location.name,'reported_quantity',v_reported_total,
      'accepted_quantity',v_accepted_total,'divergence_count',v_divergence_count),
    p_metadata := jsonb_build_object('origin','purchase_receipt','receipt_code',v_receipt_code),
    p_related_supplier_id := v_document.supplier_id,
    p_related_purchase_document_id := v_document.id
  );
  return query select v_receipt_id, v_receipt_code, v_document_status, v_accepted_total, v_reported_total, v_divergence_count, v_received_at;
end;
$function$;

revoke all on function public.receive_purchase_document_items(uuid, uuid, jsonb, text) from public, anon;
grant execute on function public.receive_purchase_document_items(uuid, uuid, jsonb, text) to authenticated, service_role;

create or replace function public.update_purchase_receipt_issue_treatment(
  p_issue_id uuid,
  p_disposition text,
  p_notes text default null,
  p_resolution_reference text default null
)
returns table(issue_id uuid, issue_code text, issue_status text, document_status text)
language plpgsql security definer set search_path = '' as $function$
declare
  v_issue public.purchase_receipt_issues%rowtype;
  v_disposition text := lower(trim(coalesce(p_disposition,'')));
  v_status text;
  v_doc_status text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  select * into v_issue from public.purchase_receipt_issues where id = p_issue_id for update;
  if v_issue.id is null then raise exception 'Ressalva não encontrada.'; end if;
  if v_issue.status in ('cancelled','resolved') then raise exception 'Ressalva já encerrada e não permite troca de tratativa.'; end if;
  if not public.user_can_purchase_action(v_issue.store_id, 'confirm') then raise exception 'Sem permissão para tratar ressalvas de compras.'; end if;
  if v_disposition not in ('awaiting_replacement','discount','supplier_credit','partial_return','accepted_closed','other') then raise exception 'Tratativa inválida.'; end if;
  if v_disposition = 'other' and coalesce(length(trim(p_notes)),0) < 3 then raise exception 'Descreva a nova tratativa.'; end if;

  v_status := case
    when v_disposition = 'awaiting_replacement' then 'waiting_supplier'
    when v_disposition in ('discount','supplier_credit') then 'waiting_financial'
    when v_disposition in ('partial_return','other') then 'waiting_document'
    else 'resolved' end;

  update public.purchase_receipt_issues
  set disposition = v_disposition,
      status = v_status,
      replacement_pending_quantity = case when v_disposition = 'awaiting_replacement' and issue_type <> 'excess' then quantity else 0 end,
      physical_closed_quantity = case when v_disposition <> 'awaiting_replacement' and issue_type <> 'excess' then quantity else 0 end,
      notes = coalesce(nullif(trim(p_notes),''), notes),
      resolved_by = case when v_status = 'resolved' then auth.uid() else null end,
      resolved_at = case when v_status = 'resolved' then now() else null end,
      resolution_notes = case when v_status = 'resolved' then coalesce(nullif(trim(p_notes),''),'Diferença aceita e encerrada.') else null end,
      resolution_reference = case when v_status = 'resolved' then nullif(trim(p_resolution_reference),'') else resolution_reference end,
      updated_at = now()
  where id = v_issue.id
  returning * into v_issue;

  v_doc_status := public._recalculate_purchase_document_receipt_status(v_issue.purchase_document_id);
  perform public.create_operational_timeline_event(
    p_store_id := v_issue.store_id, p_entity_type := 'purchase_document', p_entity_id := v_issue.purchase_document_id,
    p_event_type := 'purchase_receipt_issue_treatment_changed', p_title := 'Tratativa de ressalva alterada',
    p_description := v_issue.issue_code || ' passou para ' || v_disposition || '.',
    p_severity := 'warning', p_status := 'done', p_actor_user_id := auth.uid(), p_channel := 'manual',
    p_source := 'update_purchase_receipt_issue_treatment', p_source_id := v_issue.id,
    p_old_data := null, p_new_data := jsonb_build_object('disposition',v_disposition,'status',v_status,'document_status',v_doc_status),
    p_metadata := jsonb_build_object('issue_code',v_issue.issue_code), p_related_supplier_id := v_issue.supplier_id,
    p_related_purchase_document_id := v_issue.purchase_document_id
  );
  return query select v_issue.id, v_issue.issue_code, v_issue.status, v_doc_status;
end;
$function$;

revoke all on function public.update_purchase_receipt_issue_treatment(uuid, text, text, text) from public, anon;
grant execute on function public.update_purchase_receipt_issue_treatment(uuid, text, text, text) to authenticated, service_role;

create or replace function public.resolve_purchase_receipt_issue(
  p_issue_id uuid,
  p_resolution_notes text,
  p_resolution_reference text default null
)
returns table(issue_id uuid, issue_code text, issue_status text, document_status text)
language plpgsql security definer set search_path = '' as $function$
declare
  v_issue public.purchase_receipt_issues%rowtype;
  v_doc_status text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if p_resolution_notes is null or length(trim(p_resolution_notes)) < 3 then raise exception 'Descreva como a ressalva foi resolvida.'; end if;
  select * into v_issue from public.purchase_receipt_issues where id = p_issue_id for update;
  if v_issue.id is null then raise exception 'Ressalva não encontrada.'; end if;
  if v_issue.status in ('resolved','cancelled') then raise exception 'Ressalva já encerrada.'; end if;
  if v_issue.status = 'waiting_supplier' and v_issue.replacement_pending_quantity > 0 then
    raise exception 'Reposição ainda pendente. Registre a nova entrega ou altere a tratativa antes de encerrar.';
  end if;
  if not public.user_can_purchase_action(v_issue.store_id, 'confirm') then raise exception 'Sem permissão para resolver ressalvas de compras.'; end if;

  update public.purchase_receipt_issues
  set status='resolved', resolved_by=auth.uid(), resolved_at=now(),
      resolution_notes=trim(p_resolution_notes), resolution_reference=nullif(trim(p_resolution_reference),''), updated_at=now()
  where id=v_issue.id returning * into v_issue;
  v_doc_status := public._recalculate_purchase_document_receipt_status(v_issue.purchase_document_id);
  perform public.create_operational_timeline_event(
    p_store_id := v_issue.store_id, p_entity_type := 'purchase_document', p_entity_id := v_issue.purchase_document_id,
    p_event_type := 'purchase_receipt_issue_resolved', p_title := 'Ressalva resolvida',
    p_description := v_issue.issue_code || ' resolvida: ' || trim(p_resolution_notes),
    p_severity := 'success', p_status := 'done', p_actor_user_id := auth.uid(), p_channel := 'manual',
    p_source := 'resolve_purchase_receipt_issue', p_source_id := v_issue.id,
    p_old_data := null, p_new_data := jsonb_build_object('status','resolved','reference',v_issue.resolution_reference),
    p_metadata := jsonb_build_object('issue_code',v_issue.issue_code), p_related_supplier_id := v_issue.supplier_id,
    p_related_purchase_document_id := v_issue.purchase_document_id
  );
  return query select v_issue.id, v_issue.issue_code, v_issue.status, v_doc_status;
end;
$function$;

revoke all on function public.resolve_purchase_receipt_issue(uuid, text, text) from public, anon;
grant execute on function public.resolve_purchase_receipt_issue(uuid, text, text) to authenticated, service_role;

create or replace function public.cancel_purchase_receipt_issue(p_issue_id uuid, p_reason text)
returns table(issue_id uuid, issue_code text, issue_status text, document_status text)
language plpgsql security definer set search_path = '' as $function$
declare
  v_issue public.purchase_receipt_issues%rowtype;
  v_doc_status text;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Informe o motivo do cancelamento da ressalva.'; end if;
  select * into v_issue from public.purchase_receipt_issues where id=p_issue_id for update;
  if v_issue.id is null then raise exception 'Ressalva não encontrada.'; end if;
  if v_issue.status='cancelled' then raise exception 'Ressalva já cancelada.'; end if;
  if not public.user_can_purchase_action(v_issue.store_id, 'cancel') then raise exception 'Sem permissão para cancelar ressalvas.'; end if;
  update public.purchase_receipt_issues
  set status='cancelled', cancelled_by=auth.uid(), cancelled_at=now(), cancellation_reason=trim(p_reason), updated_at=now()
  where id=v_issue.id returning * into v_issue;
  v_doc_status := public._recalculate_purchase_document_receipt_status(v_issue.purchase_document_id);
  perform public.create_operational_timeline_event(
    p_store_id := v_issue.store_id, p_entity_type := 'purchase_document', p_entity_id := v_issue.purchase_document_id,
    p_event_type := 'purchase_receipt_issue_cancelled', p_title := 'Ressalva cancelada',
    p_description := v_issue.issue_code || ' cancelada. Motivo: ' || trim(p_reason),
    p_severity := 'warning', p_status := 'cancelled', p_actor_user_id := auth.uid(), p_channel := 'manual',
    p_source := 'cancel_purchase_receipt_issue', p_source_id := v_issue.id,
    p_old_data := null, p_new_data := jsonb_build_object('status','cancelled','reason',trim(p_reason)),
    p_metadata := jsonb_build_object('issue_code',v_issue.issue_code), p_related_supplier_id := v_issue.supplier_id,
    p_related_purchase_document_id := v_issue.purchase_document_id
  );
  return query select v_issue.id, v_issue.issue_code, v_issue.status, v_doc_status;
end;
$function$;

revoke all on function public.cancel_purchase_receipt_issue(uuid, text) from public, anon;
grant execute on function public.cancel_purchase_receipt_issue(uuid, text) to authenticated, service_role;

-- Reversão de parcela invalida as ressalvas do documento, mas mantém os registros para auditoria.
create or replace function public._cancel_purchase_issues_for_receipt_reversal(p_document_id uuid, p_reason text)
returns integer language plpgsql security definer set search_path='' as $function$
declare v_count integer;
begin
  update public.purchase_receipt_issues
  set status='cancelled', cancelled_by=auth.uid(), cancelled_at=now(),
      cancellation_reason='Invalidada por reversão de recebimento: ' || trim(p_reason), updated_at=now()
  where purchase_document_id=p_document_id and status <> 'cancelled';
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;
revoke all on function public._cancel_purchase_issues_for_receipt_reversal(uuid,text) from public, anon, authenticated;

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
  v_cancelled_issues integer := 0;
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if p_reason is null or length(trim(p_reason)) < 3 then raise exception 'Informe um motivo com pelo menos 3 caracteres para reverter a parcela.'; end if;
  select * into v_receipt from public.purchase_receipts where id=p_receipt_id for update;
  if v_receipt.id is null then raise exception 'Parcela de recebimento não encontrada.'; end if;
  if v_receipt.status='reversed' then raise exception 'Parcela já foi revertida.'; end if;
  select * into v_document from public.purchase_documents where id=v_receipt.purchase_document_id for update;
  if v_document.id is null then raise exception 'Documento de compra da parcela não encontrado.'; end if;
  if v_document.status='cancelled' then raise exception 'Compra cancelada não permite nova reversão de parcela.'; end if;
  if not public.user_can_purchase_action(v_document.store_id,'cancel') then raise exception 'Sem permissão para reverter recebimentos nesta loja.'; end if;

  v_cancelled_issues := public._cancel_purchase_issues_for_receipt_reversal(v_document.id,p_reason);

  for v_item in select ri.* from public.purchase_receipt_items ri where ri.receipt_id=v_receipt.id and ri.accepted_quantity>0 order by ri.id loop
    select coalesce(ilb.on_hand,0),coalesce(ilb.reserved,0) into v_location_before,v_location_reserved
    from public.inventory_location_balances ilb where ilb.store_id=v_receipt.store_id and ilb.location_id=v_receipt.location_id
      and ilb.product_id=v_item.product_id and ilb.variant_id is null for update;
    if not found then raise exception 'Saldo local não encontrado para reverter o item % da parcela %.',v_item.id,v_receipt.receipt_code; end if;
    if v_location_before < v_item.accepted_quantity then raise exception 'Saldo insuficiente no local % para reverter a parcela %.',v_receipt.location_name,v_receipt.receipt_code; end if;
    select coalesce(p.stock_quantity,0) into v_global_before from public.products p
    where p.id=v_item.product_id and p.store_id=v_receipt.store_id for update;
    if not found or v_global_before < v_item.accepted_quantity then raise exception 'A reversão deixaria o estoque global inválido para o produto %.',v_item.product_id; end if;
    v_location_after:=v_location_before-v_item.accepted_quantity; v_global_after:=v_global_before-v_item.accepted_quantity::integer;
    update public.inventory_location_balances set on_hand=v_location_after,updated_at=v_reversed_at
    where store_id=v_receipt.store_id and location_id=v_receipt.location_id and product_id=v_item.product_id and variant_id is null;
    perform set_config('app.allow_stock_update','true',true);
    update public.products set stock_quantity=v_global_after where id=v_item.product_id and store_id=v_receipt.store_id;
    insert into public.stock_movements(store_id,product_id,location_id,from_location_id,to_location_id,type,quantity,previous_stock,new_stock,reason,source,source_id,reason_code,affects_physical,created_by,supplier_id,metadata)
    values(v_receipt.store_id,v_item.product_id,v_receipt.location_id,v_receipt.location_id,null,'exit'::public.stock_movement_type,
      -(v_item.accepted_quantity::integer),v_global_before,v_global_after,'Reversão de recebimento: '||v_receipt.receipt_code,
      'purchase_receipt_reversal',v_receipt.id,'purchase_receipt_reversed',true,auth.uid(),v_receipt.supplier_id,
      jsonb_build_object('origin','purchase_receipt_reversal','purchase_receipt_id',v_receipt.id,'purchase_receipt_item_id',v_item.id,
        'receipt_code',v_receipt.receipt_code,'purchase_document_id',v_receipt.purchase_document_id,'purchase_document_item_id',v_item.purchase_document_item_id,
        'document_code',v_receipt.purchase_document_code,'invoice_number',v_receipt.invoice_number,'accepted_quantity_reversed',v_item.accepted_quantity,
        'reversal_reason',trim(p_reason),'location_id',v_receipt.location_id,'location_name',v_receipt.location_name,
        'on_hand_before_location',v_location_before,'on_hand_after_location',v_location_after));
  end loop;

  update public.purchase_receipts set status='reversed',reversed_at=v_reversed_at,reversed_by=auth.uid(),reversal_reason=trim(p_reason) where id=v_receipt.id;
  v_document_status:=public._recalculate_purchase_document_receipt_status(v_receipt.purchase_document_id);
  perform public.create_operational_timeline_event(
    p_store_id:=v_receipt.store_id,p_entity_type:='purchase_document',p_entity_id:=v_receipt.purchase_document_id,
    p_event_type:='purchase_receipt_reversed',p_title:='Parcela de recebimento revertida',
    p_description:=v_receipt.receipt_code||' revertida. Ressalvas invalidadas: '||v_cancelled_issues||'. Motivo: '||trim(p_reason),
    p_severity:='warning',p_status:='done',p_actor_user_id:=auth.uid(),p_channel:='manual',p_source:='reverse_purchase_receipt',p_source_id:=v_receipt.id,
    p_old_data:=jsonb_build_object('receipt_status',v_receipt.status,'document_status',v_document.status),
    p_new_data:=jsonb_build_object('receipt_status','reversed','document_status',v_document_status,'reversal_reason',trim(p_reason),'cancelled_issues',v_cancelled_issues),
    p_metadata:=jsonb_build_object('origin','purchase_receipt_reversal','receipt_code',v_receipt.receipt_code),
    p_related_supplier_id:=v_receipt.supplier_id,p_related_purchase_document_id:=v_receipt.purchase_document_id);
  return query select v_receipt.id,v_receipt.receipt_code,v_document_status,v_reversed_at;
end;
$function$;

revoke all on function public.reverse_purchase_receipt(uuid,text) from public, anon;
grant execute on function public.reverse_purchase_receipt(uuid,text) to authenticated, service_role;

create or replace function public.list_purchase_receipt_issues_safe(
  p_store_id uuid,
  p_status text default null,
  p_start_date date default null,
  p_end_date date default null,
  p_limit integer default 500
)
returns table(
  issue_id uuid, issue_code text, purchase_document_id uuid, document_code text, invoice_number text,
  supplier_id uuid, supplier_name text, product_id uuid, product_name text,
  issue_type text, issue_scope text, quantity numeric, disposition text, issue_status text,
  replacement_pending_quantity numeric, physical_closed_quantity numeric, estimated_amount numeric,
  notes text, opened_by uuid, opened_at timestamptz, resolved_at timestamptz,
  resolution_notes text, resolution_reference text, cancelled_at timestamptz, cancellation_reason text
)
language plpgsql security definer set search_path='' as $function$
begin
  if auth.uid() is null then raise exception 'Sessão inválida.'; end if;
  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id,'purchases.view')
    or public.user_has_store_permission(p_store_id,'purchases.confirm')
    or public.user_has_store_permission(p_store_id,'stock.view')
  ) then raise exception 'Sem permissão para visualizar ressalvas de compras.'; end if;
  return query
  select i.id,i.issue_code,i.purchase_document_id,d.document_code,d.invoice_number,
    i.supplier_id,s.name,i.product_id,p.name,i.issue_type,i.issue_scope,i.quantity,i.disposition,i.status,
    i.replacement_pending_quantity,i.physical_closed_quantity,i.estimated_amount,i.notes,i.opened_by,i.opened_at,
    i.resolved_at,i.resolution_notes,i.resolution_reference,i.cancelled_at,i.cancellation_reason
  from public.purchase_receipt_issues i
  join public.purchase_documents d on d.id=i.purchase_document_id
  join public.suppliers s on s.id=i.supplier_id
  join public.products p on p.id=i.product_id
  where i.store_id=p_store_id
    and (p_status is null or p_status='' or p_status='all' or i.status=p_status)
    and (p_start_date is null or i.opened_at >= p_start_date::timestamptz)
    and (p_end_date is null or i.opened_at < (p_end_date+1)::timestamptz)
  order by case when i.status in ('waiting_supplier','waiting_financial','waiting_document') then 0 else 1 end,
    i.opened_at desc
  limit greatest(1,least(coalesce(p_limit,500),1000));
end;
$function$;

revoke all on function public.list_purchase_receipt_issues_safe(uuid,text,date,date,integer) from public, anon;
grant execute on function public.list_purchase_receipt_issues_safe(uuid,text,date,date,integer) to authenticated, service_role;

commit;
