-- Corrige baixa duplicada de saldo consolidado ao confirmar estoque de pedidos.
-- A movimentação V2 já aplica o delta no saldo por local; depois disso o consolidado deve ser sincronizado a partir dos locais,
-- não receber o mesmo delta novamente.

create or replace function public.apply_inventory_balance_delta(
  p_store_id uuid,
  p_product_id uuid,
  p_variant_id uuid,
  p_delta_on_hand numeric,
  p_delta_reserved numeric
)
returns public.inventory_balances
language plpgsql
set search_path to 'public'
as $function$
declare
  v_current public.inventory_balances;
  v_new_on_hand numeric;
  v_new_reserved numeric;
  v_row public.inventory_balances;
begin
  v_current := public.get_inventory_balance_for_update(p_store_id, p_product_id, p_variant_id);

  v_new_on_hand := coalesce(v_current.on_hand, 0) + coalesce(p_delta_on_hand, 0);
  v_new_reserved := coalesce(v_current.reserved, 0) + coalesce(p_delta_reserved, 0);

  if v_new_on_hand < 0 then
    raise exception 'Saldo físico consolidado insuficiente. Atual: %, delta: %, resultado: %',
      v_current.on_hand, p_delta_on_hand, v_new_on_hand
      using errcode = '23514';
  end if;

  if v_new_reserved < 0 then
    raise exception 'Saldo reservado consolidado insuficiente. Atual: %, delta: %, resultado: %',
      v_current.reserved, p_delta_reserved, v_new_reserved
      using errcode = '23514';
  end if;

  if v_new_reserved > v_new_on_hand then
    raise exception 'Saldo reservado consolidado não pode exceder saldo físico'
      using errcode = '23514';
  end if;

  update public.inventory_balances
     set on_hand = v_new_on_hand,
         reserved = v_new_reserved,
         updated_at = now()
   where id = v_current.id
  returning * into v_row;

  return v_row;
end;
$function$;

create or replace function public.apply_stock_movement_delta_v2(
  p_store_id uuid,
  p_product_id uuid,
  p_movement_type public.stock_movement_type,
  p_quantity numeric,
  p_affects_physical boolean default true,
  p_reason text default null,
  p_order_id uuid default null,
  p_source text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null,
  p_location_id uuid default null,
  p_from_location_id uuid default null,
  p_to_location_id uuid default null,
  p_transfer_id uuid default null,
  p_supplier_id uuid default null,
  p_reason_code text default null,
  p_variant_id uuid default null,
  p_sync_legacy_balance boolean default true
)
returns table(
  movement_id uuid,
  store_id uuid,
  product_id uuid,
  variant_id uuid,
  movement_type public.stock_movement_type,
  quantity numeric,
  location_id uuid,
  from_location_id uuid,
  to_location_id uuid,
  transfer_id uuid,
  on_hand_after_location numeric,
  reserved_after_location numeric,
  on_hand_after_store numeric,
  reserved_after_store numeric,
  created_at timestamp with time zone
)
language plpgsql
set search_path to 'public'
as $function$
declare
  v_effective_location_id uuid;
  v_effective_from_location_id uuid;
  v_effective_to_location_id uuid;
  v_delta_on_hand numeric := 0;
  v_delta_reserved numeric := 0;
  v_location_after public.inventory_location_balances;
  v_store_after public.inventory_balances;
  v_previous_stock integer := 0;
  v_new_stock integer := 0;
  v_movement_id uuid;
  v_created_at timestamptz := now();
  v_legacy_quantity integer := 0;
  v_legacy_affects_physical boolean := p_affects_physical;
  v_write_stock_movements boolean := true;
  v_write_audit_log boolean := false;
begin
  if p_store_id is null then
    raise exception 'p_store_id é obrigatório' using errcode = '23514';
  end if;

  if p_product_id is null then
    raise exception 'p_product_id é obrigatório' using errcode = '23514';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'p_quantity deve ser maior que zero' using errcode = '23514';
  end if;

  if trunc(p_quantity) <> p_quantity then
    raise exception 'Nesta fase, p_quantity deve ser inteira para compatibilidade com stock_movements.quantity'
      using errcode = '23514';
  end if;

  if not public.product_belongs_to_store(p_product_id, p_store_id) then
    raise exception 'Produto % não pertence à loja %', p_product_id, p_store_id
      using errcode = '23514';
  end if;

  v_effective_location_id := p_location_id;
  v_effective_from_location_id := p_from_location_id;
  v_effective_to_location_id := p_to_location_id;

  if v_effective_location_id is null
     and v_effective_from_location_id is null
     and v_effective_to_location_id is null then
    v_effective_location_id := public.get_default_stock_location_id(p_store_id);
  end if;

  case p_movement_type
    when 'entry' then
      v_effective_location_id := coalesce(v_effective_location_id, public.get_default_stock_location_id(p_store_id));
      v_delta_on_hand := p_quantity;
      v_delta_reserved := 0;
      v_legacy_quantity := p_quantity::integer;
      v_legacy_affects_physical := true;
      v_write_stock_movements := true;
      v_write_audit_log := false;
    when 'exit' then
      v_effective_location_id := coalesce(v_effective_location_id, public.get_default_stock_location_id(p_store_id));
      v_delta_on_hand := -p_quantity;
      v_delta_reserved := 0;
      v_legacy_quantity := (p_quantity::integer) * -1;
      v_legacy_affects_physical := true;
      v_write_stock_movements := true;
      v_write_audit_log := false;
    when 'reservation' then
      v_effective_location_id := coalesce(v_effective_location_id, public.get_default_stock_location_id(p_store_id));
      v_delta_on_hand := 0;
      v_delta_reserved := p_quantity;
      v_write_stock_movements := false;
      v_write_audit_log := true;
    when 'confirmation' then
      v_effective_location_id := coalesce(v_effective_location_id, public.get_default_stock_location_id(p_store_id));
      v_delta_on_hand := -p_quantity;
      v_delta_reserved := -p_quantity;
      v_legacy_quantity := (p_quantity::integer) * -1;
      v_legacy_affects_physical := true;
      v_write_stock_movements := true;
      v_write_audit_log := false;
    when 'cancellation' then
      v_effective_location_id := coalesce(v_effective_location_id, public.get_default_stock_location_id(p_store_id));
      v_delta_on_hand := 0;
      v_delta_reserved := -p_quantity;
      v_write_stock_movements := false;
      v_write_audit_log := true;
    when 'clearance' then
      v_effective_location_id := coalesce(v_effective_location_id, public.get_default_stock_location_id(p_store_id));
      v_delta_on_hand := -p_quantity;
      v_delta_reserved := 0;
      v_legacy_quantity := (p_quantity::integer) * -1;
      v_legacy_affects_physical := true;
      v_write_stock_movements := true;
      v_write_audit_log := false;
    else
      raise exception 'Tipo de movimento não suportado na V2: %', p_movement_type
        using errcode = '23514';
  end case;

  if v_effective_location_id is not null
     and not public.stock_location_belongs_to_store(v_effective_location_id, p_store_id) then
    raise exception 'location_id % não pertence à store_id %', v_effective_location_id, p_store_id
      using errcode = '23514';
  end if;

  if v_effective_from_location_id is not null
     and not public.stock_location_belongs_to_store(v_effective_from_location_id, p_store_id) then
    raise exception 'from_location_id % não pertence à store_id %', v_effective_from_location_id, p_store_id
      using errcode = '23514';
  end if;

  if v_effective_to_location_id is not null
     and not public.stock_location_belongs_to_store(v_effective_to_location_id, p_store_id) then
    raise exception 'to_location_id % não pertence à store_id %', v_effective_to_location_id, p_store_id
      using errcode = '23514';
  end if;

  v_location_after := public.apply_inventory_location_delta(
    p_store_id,
    v_effective_location_id,
    p_product_id,
    p_variant_id,
    v_delta_on_hand,
    v_delta_reserved
  );

  if p_sync_legacy_balance then
    -- O saldo por local já recebeu o delta acima; agora o consolidado deve refletir a soma dos locais.
    -- Aplicar o delta novamente aqui causava baixa dupla e erro falso de estoque em "saiu para entrega".
    v_store_after := public.sync_inventory_balance_from_locations(p_store_id, p_product_id, p_variant_id);
  else
    select * into v_store_after
    from public.get_inventory_balance_for_update(p_store_id, p_product_id, p_variant_id);
  end if;

  v_previous_stock := (coalesce(v_store_after.on_hand, 0) - v_delta_on_hand)::integer;
  v_new_stock := coalesce(v_store_after.on_hand, 0)::integer;

  if v_write_stock_movements then
    insert into public.stock_movements (
      product_id, order_id, quantity, type, reason, user_id, previous_stock, new_stock,
      created_at, store_id, affects_physical, source, source_id, reason_code, metadata,
      created_by, supplier_id, location_id, from_location_id, to_location_id, transfer_id
    ) values (
      p_product_id, p_order_id, v_legacy_quantity, p_movement_type, p_reason, p_created_by,
      v_previous_stock, v_new_stock, v_created_at, p_store_id, v_legacy_affects_physical,
      p_source, p_transfer_id, p_reason_code, coalesce(p_metadata, '{}'::jsonb),
      p_created_by, p_supplier_id, v_effective_location_id, v_effective_from_location_id,
      v_effective_to_location_id, p_transfer_id
    ) returning id into v_movement_id;
  elsif v_write_audit_log then
    insert into public.audit_logs (
      store_id, user_id, action, entity, entity_id, old_data, new_data, created_at
    ) values (
      p_store_id,
      p_created_by,
      p_movement_type::text,
      'inventory_location_balances',
      v_location_after.id,
      jsonb_build_object(
        'product_id', p_product_id,
        'variant_id', p_variant_id,
        'location_id', v_effective_location_id,
        'from_location_id', v_effective_from_location_id,
        'to_location_id', v_effective_to_location_id,
        'transfer_id', p_transfer_id
      ),
      jsonb_strip_nulls(
        coalesce(p_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'movement_type', p_movement_type,
          'quantity', p_quantity,
          'reason', p_reason,
          'order_id', p_order_id,
          'source', p_source,
          'reason_code', p_reason_code,
          'affects_physical', false,
          'product_id', p_product_id,
          'variant_id', p_variant_id,
          'location_id', v_effective_location_id,
          'from_location_id', v_effective_from_location_id,
          'to_location_id', v_effective_to_location_id,
          'transfer_id', p_transfer_id,
          'on_hand_after_location', v_location_after.on_hand,
          'reserved_after_location', v_location_after.reserved,
          'on_hand_after_store', v_store_after.on_hand,
          'reserved_after_store', v_store_after.reserved
        )
      ),
      v_created_at
    ) returning id into v_movement_id;
  end if;

  return query
  select
    v_movement_id as movement_id,
    p_store_id as store_id,
    p_product_id as product_id,
    p_variant_id as variant_id,
    p_movement_type as movement_type,
    p_quantity as quantity,
    v_effective_location_id as location_id,
    v_effective_from_location_id as from_location_id,
    v_effective_to_location_id as to_location_id,
    p_transfer_id as transfer_id,
    v_location_after.on_hand as on_hand_after_location,
    v_location_after.reserved as reserved_after_location,
    v_store_after.on_hand as on_hand_after_store,
    v_store_after.reserved as reserved_after_store,
    v_created_at as created_at;
end;
$function$;

-- Reconciliar os consolidados existentes a partir dos saldos por local, sem alterar movimentos.
do $$
declare
  r record;
begin
  for r in
    select distinct store_id, product_id, variant_id
    from public.inventory_location_balances
  loop
    perform public.sync_inventory_balance_from_locations(r.store_id, r.product_id, r.variant_id);
  end loop;
end $$;
