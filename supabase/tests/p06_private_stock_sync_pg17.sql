\set ON_ERROR_STOP on
\echo 'P06: PG17 synthetic original function signatures + relocation to private schema'
-- stock_movement_type enum matches live schema.
create type public.stock_movement_type as enum ('entry','exit','reservation','confirmation','cancellation','clearance');
-- All code below is live pg_get_functiondef from baseline. The caller is deliberately
-- created but NOT executed: its full writes depend on the entire inventory schema.

CREATE OR REPLACE FUNCTION public.apply_stock_movement_delta_v2(p_store_id uuid, p_product_id uuid, p_movement_type stock_movement_type, p_quantity numeric, p_affects_physical boolean DEFAULT true, p_reason text DEFAULT NULL::text, p_order_id uuid DEFAULT NULL::uuid, p_source text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_created_by uuid DEFAULT NULL::uuid, p_location_id uuid DEFAULT NULL::uuid, p_from_location_id uuid DEFAULT NULL::uuid, p_to_location_id uuid DEFAULT NULL::uuid, p_transfer_id uuid DEFAULT NULL::uuid, p_supplier_id uuid DEFAULT NULL::uuid, p_reason_code text DEFAULT NULL::text, p_variant_id uuid DEFAULT NULL::uuid, p_sync_legacy_balance boolean DEFAULT true)
 RETURNS TABLE(movement_id uuid, store_id uuid, product_id uuid, variant_id uuid, movement_type stock_movement_type, quantity numeric, location_id uuid, from_location_id uuid, to_location_id uuid, transfer_id uuid, on_hand_after_location numeric, reserved_after_location numeric, on_hand_after_store numeric, reserved_after_store numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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

revoke execute on function public.apply_stock_movement_delta_v2(uuid,uuid,stock_movement_type,numeric,boolean,text,uuid,text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,boolean) from public,anon;
grant execute on function public.apply_stock_movement_delta_v2(uuid,uuid,stock_movement_type,numeric,boolean,text,uuid,text,jsonb,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,boolean) to authenticated,service_role;
\echo 'P06: apply EXACT migration to synthetic PG17'
\ir ../migrations/20261022013000_move_stock_sync_to_unexposed_schema.sql

-- A representative invoker authorization gate. The full production movement RPC
-- remains SECURITY INVOKER but has a wider set of DB/RLS dependencies.
create schema auth;
create function auth.uid() returns uuid language sql stable as $body$
  select nullif((nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub'),'')::uuid
$body$;

create table public.p06_operator_access (
  user_id uuid not null,
  store_id uuid not null,
  can_adjust boolean not null,
  primary key (user_id,store_id)
);
insert into public.p06_operator_access values
 ('e0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',true),
 ('e0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001',false),
 ('e0000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',true);
alter table public.p06_operator_access enable row level security;
create policy access_self on public.p06_operator_access for select to authenticated using(user_id=auth.uid());
grant select on public.p06_operator_access to authenticated;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;

create function public.p06_authorized_invoker_move(p_store_id uuid,p_product_id uuid)
returns numeric language plpgsql security invoker
set search_path = public,pg_temp
as $body$
declare result numeric;
begin
  if not exists(select 1 from public.p06_operator_access
    where user_id=auth.uid() and store_id=p_store_id and can_adjust) then
    raise exception 'P06 denied: permission to adjust stock not granted' using errcode='42501';
  end if;
  result := (optmamenu_stock_internal.sync_inventory_balance_from_locations(
    p_store_id,p_product_id,null)).on_hand;
  return result;
end
$body$;
revoke execute on function public.p06_authorized_invoker_move(uuid,uuid) from public,anon;
grant execute on function public.p06_authorized_invoker_move(uuid,uuid) to authenticated;

-- PostgreSQL privileges and positive internal invocation.
do $check$
begin
 if has_function_privilege('anon','optmamenu_stock_internal.sync_inventory_balance_from_locations(uuid,uuid,uuid)','EXECUTE') then
   raise exception 'P06 FAIL: anon still has permission'; end if;
 if has_function_privilege('anon','public.p06_authorized_invoker_move(uuid,uuid)','EXECUTE') then
   raise exception 'P06 FAIL: anon still has wrapper permission'; end if;
 if not has_function_privilege('authenticated','optmamenu_stock_internal.sync_inventory_balance_from_locations(uuid,uuid,uuid)','EXECUTE') then
   raise exception 'P06 FAIL: authenticated invoker cannot use moved function'; end if;
end $check$;

set role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
do $positive$
declare v numeric;
begin
  select public.p06_authorized_invoker_move(
  '10000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001') into v;
  if v is distinct from 20 then raise exception 'P06 FAIL: inventory invoker regression %',v; end if;
end $positive$;
do $cross$
begin
  perform public.p06_authorized_invoker_move('20000000-0000-0000-0000-000000000002',
   'b0000000-0000-0000-0000-000000000002');
  raise exception 'P06 FAIL: operator A adjusted B';
exception when insufficient_privilege then null;
end $cross$;
select set_config('request.jwt.claims',
 '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}',false);
do $readonly$
begin
  perform public.p06_authorized_invoker_move('10000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001');
  raise exception 'P06 FAIL: reader adjusted own store';
exception when insufficient_privilege then null;
end $readonly$;
reset role;

set role service_role;
select (optmamenu_stock_internal.sync_inventory_balance_from_locations(
 '20000000-0000-0000-0000-000000000002',
 'b0000000-0000-0000-0000-000000000002',null)).on_hand as service_sync;
reset role;

-- Authenticated does possess SQL EXECUTE in the nonexposed schema (necessary
-- to preserve the actual SECURITY INVOKER movement RPC). HTTP must deny RPC.
-- Do not expose the schema in Supabase Data API settings!
\echo 'P06 OK: PG17 moved function, business invoker authorization, stock values'
