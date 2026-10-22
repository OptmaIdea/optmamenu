\set ON_ERROR_STOP on
\echo 'P05 synthetic PostgreSQL 17: inventory definer direct ACL vs invoker call chain'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to anon,authenticated,service_role;

create table public.inventory_location_balances(
 store_id uuid not null,
 product_id uuid not null,
 variant_id uuid,
 on_hand numeric not null,
 reserved numeric not null
);
create table public.inventory_balances(
 id uuid primary key,
 store_id uuid not null,
 product_id uuid not null,
 variant_id uuid,
 on_hand numeric not null,
 reserved numeric not null,
 updated_at timestamptz not null default now()
);
insert into public.inventory_location_balances values
 ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',null,20,4),
 ('20000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',null,31,7);
insert into public.inventory_balances(id,store_id,product_id,variant_id,on_hand,reserved) values
 ('f0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',null,0,0),
 ('f0000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',null,0,0);

create function public.get_inventory_balance_for_update(
 p_store_id uuid,p_product_id uuid,p_variant_id uuid default null
) returns public.inventory_balances language plpgsql as $fn$
declare v_row public.inventory_balances;
begin
 select * into v_row from public.inventory_balances
 where store_id=p_store_id and product_id=p_product_id
 and (variant_id=p_variant_id or (variant_id is null and p_variant_id is null))
 for update;
 if v_row.id is null then raise exception 'Missing synthetic balance'; end if;
 return v_row;
end
$fn$;

-- Production function body, copied verbatim via read-only pg_get_functiondef:

CREATE OR REPLACE FUNCTION public.sync_inventory_balance_from_locations(p_store_id uuid, p_product_id uuid, p_variant_id uuid DEFAULT NULL::uuid)
 RETURNS inventory_balances
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_on_hand numeric := 0;
  v_reserved numeric := 0;
  v_row public.inventory_balances;
begin
  select coalesce(sum(ilb.on_hand), 0), coalesce(sum(ilb.reserved), 0)
    into v_on_hand, v_reserved
  from public.inventory_location_balances ilb
  where ilb.store_id = p_store_id
    and ilb.product_id = p_product_id
    and (
      (p_variant_id is null and ilb.variant_id is null)
      or ilb.variant_id = p_variant_id
    );

  v_row := public.get_inventory_balance_for_update(p_store_id, p_product_id, p_variant_id);

  update public.inventory_balances
     set on_hand = v_on_hand,
         reserved = v_reserved,
         updated_at = now()
   where id = v_row.id
  returning * into v_row;

  return v_row;
end;
$function$;

-- Representative security-invoker caller: the real apply_stock_movement_delta_v2
-- is SECURITY INVOKER and calls this helper under authenticated role.
create function public.p05_invoker_stock_path(p_store_id uuid,p_product_id uuid)
returns numeric language sql security invoker
as $fn$
select (public.sync_inventory_balance_from_locations(p_store_id,p_product_id,null)).on_hand
$fn$;
grant execute on function public.p05_invoker_stock_path(uuid,uuid) to authenticated;

do $pre$
declare t regprocedure := 'public.sync_inventory_balance_from_locations(uuid,uuid,uuid)'::regprocedure;
begin
 if not has_function_privilege('anon',t,'EXECUTE') or not has_function_privilege('authenticated',t,'EXECUTE') then
  raise exception 'P05 fixture did not reproduce original open ACL';
 end if;
end $pre$;
\ir ../migrations/20261022004000_inventory_sync_revoke_anon_execute.sql

set role anon;
do $neg$
begin
  perform public.sync_inventory_balance_from_locations(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000001'::uuid,null);
  raise exception 'P05 FAIL: anon called privileged stock sync';
exception when insufficient_privilege then null;
end $neg$;
reset role;

set role authenticated;
do $positive$
declare v numeric;
begin
 select public.p05_invoker_stock_path(
    '10000000-0000-0000-0000-000000000001'::uuid,
    'a0000000-0000-0000-0000-000000000001'::uuid) into v;
 if v is distinct from 20 then
   raise exception 'P05 FAIL: authorized invoker chain did not preserve stock aggregation: %',v;
 end if;
end $positive$;
reset role;

set role service_role;
select (public.sync_inventory_balance_from_locations(
 '20000000-0000-0000-0000-000000000002'::uuid,
 'b0000000-0000-0000-0000-000000000002'::uuid,null)).on_hand as service_sync;
reset role;

do $check$
declare a public.inventory_balances; b public.inventory_balances;
begin
 select * into a from public.inventory_balances where store_id='10000000-0000-0000-0000-000000000001';
 select * into b from public.inventory_balances where store_id='20000000-0000-0000-0000-000000000002';
 if a.on_hand is distinct from 20 or a.reserved is distinct from 4
 or b.on_hand is distinct from 31 or b.reserved is distinct from 7 then
   raise exception 'P05 FAIL: inventory balances after aggregation are unexpected';
 end if;
end $check$;
\echo 'P05 PASS: anonymous EXECUTE denied; authenticated invoker and service_role intact'
