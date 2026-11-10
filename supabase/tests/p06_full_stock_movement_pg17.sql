\set ON_ERROR_STOP on
\echo 'P06 REAL production apply_stock_movement_delta_v2 BODY: synthetic entry, exit, reservation, cancellation and confirmation'

alter table public.inventory_location_balances add column id uuid default gen_random_uuid();
create table public.products(id uuid primary key,store_id uuid not null);
insert into public.products values
 ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('b0000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
alter table public.products enable row level security;
create policy products_visible on public.products for select to authenticated using (true);
grant select on public.products to authenticated;
create table public.stock_locations(id uuid primary key,store_id uuid not null);
insert into public.stock_locations values
 ('d0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('d0000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002');
alter table public.stock_locations enable row level security;
create policy location_visible on public.stock_locations for select to authenticated using(true);
grant select on public.stock_locations to authenticated;

create function public.product_belongs_to_store(p_product_id uuid,p_store_id uuid)
returns boolean language sql stable as $fn$
select exists(select 1 from public.products where id=p_product_id and store_id=p_store_id)
$fn$;
create function public.get_default_stock_location_id(p_store_id uuid)
returns uuid language sql stable as $fn$
select id from public.stock_locations where store_id=p_store_id limit 1
$fn$;
create function public.stock_location_belongs_to_store(p_location_id uuid,p_store_id uuid)
returns boolean language sql stable as $fn$
select exists(select 1 from public.stock_locations where id=p_location_id and store_id=p_store_id)
$fn$;
grant execute on function public.product_belongs_to_store(uuid,uuid) to authenticated;
grant execute on function public.get_default_stock_location_id(uuid) to authenticated;
grant execute on function public.stock_location_belongs_to_store(uuid,uuid) to authenticated;

alter table public.inventory_location_balances enable row level security;
create policy loc_read on public.inventory_location_balances for select to authenticated
  using(exists(select 1 from public.p06_operator_access x where x.user_id=auth.uid() and x.store_id=inventory_location_balances.store_id));
create policy loc_write on public.inventory_location_balances for update to authenticated
  using(exists(select 1 from public.p06_operator_access x where x.user_id=auth.uid()
        and x.store_id=inventory_location_balances.store_id and x.can_adjust))
  with check(exists(select 1 from public.p06_operator_access x where x.user_id=auth.uid()
        and x.store_id=inventory_location_balances.store_id and x.can_adjust));
grant select,update on public.inventory_location_balances to authenticated;

create function public.apply_inventory_location_delta(
 p_store_id uuid,p_location_id uuid,p_product_id uuid,p_variant_id uuid,
 p_delta_on_hand numeric,p_delta_reserved numeric)
returns public.inventory_location_balances
language plpgsql security invoker set search_path=public,pg_temp
as $fn$
declare v public.inventory_location_balances;
begin
 if not exists(select 1 from public.p06_operator_access
  where user_id=auth.uid() and store_id=p_store_id and can_adjust) then
  raise exception 'No stock.adjust permission in synthetic fixture' using errcode='42501';
 end if;
 update public.inventory_location_balances
 set on_hand=on_hand+p_delta_on_hand,reserved=reserved+p_delta_reserved
 where store_id=p_store_id and product_id=p_product_id and
 (variant_id=p_variant_id or (variant_id is null and p_variant_id is null))
 returning * into v;
 if v.store_id is null then raise exception 'Synthetic inventory location not writable'; end if;
 return v;
end
$fn$;
grant execute on function public.apply_inventory_location_delta(uuid,uuid,uuid,uuid,numeric,numeric) to authenticated;

create table public.stock_movements(
 id uuid primary key default gen_random_uuid(), product_id uuid,order_id uuid,
 quantity integer,type public.stock_movement_type,reason text,user_id uuid,
 previous_stock integer,new_stock integer,created_at timestamptz,store_id uuid,
 affects_physical boolean,source text,source_id uuid,reason_code text,metadata jsonb,
 created_by uuid,supplier_id uuid,location_id uuid,from_location_id uuid,
 to_location_id uuid,transfer_id uuid
);
alter table public.stock_movements enable row level security;
create policy movements_insert on public.stock_movements for insert to authenticated
 with check(exists(select 1 from public.p06_operator_access x
 where x.user_id=auth.uid() and x.store_id=stock_movements.store_id and x.can_adjust));
create policy movements_select on public.stock_movements for select to authenticated
 using(exists(select 1 from public.p06_operator_access x
 where x.user_id=auth.uid() and x.store_id=stock_movements.store_id));
grant insert,select on public.stock_movements to authenticated;

create table public.audit_logs(
 id uuid primary key default gen_random_uuid(),store_id uuid,user_id uuid,action text,
 entity text,entity_id uuid,old_data jsonb,new_data jsonb,created_at timestamptz
);
alter table public.audit_logs enable row level security;
create policy audit_insert on public.audit_logs for insert to authenticated
 with check(exists(select 1 from public.p06_operator_access x
 where x.user_id=auth.uid() and x.store_id=audit_logs.store_id and x.can_adjust));
create policy audit_select on public.audit_logs for select to authenticated
 using(exists(select 1 from public.p06_operator_access x
 where x.user_id=auth.uid() and x.store_id=audit_logs.store_id));
grant insert,select on public.audit_logs to authenticated;

set role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
\echo 'P06 full function: entry +5 into store A'
select * from public.apply_stock_movement_delta_v2(
 '10000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'entry'::public.stock_movement_type,5,p_created_by:=auth.uid());
\echo 'P06 full function: exit -3 from store A'
select * from public.apply_stock_movement_delta_v2(
 '10000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'exit'::public.stock_movement_type,3,p_created_by:=auth.uid());
\echo 'P06 full function: reserve 2 at store A'
select * from public.apply_stock_movement_delta_v2(
 '10000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'reservation'::public.stock_movement_type,2,p_created_by:=auth.uid());
\echo 'P06 full function: cancel reservation 2'
select * from public.apply_stock_movement_delta_v2(
 '10000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'cancellation'::public.stock_movement_type,2,p_created_by:=auth.uid());
\echo 'P06 full function: confirmation of 1 reserved item'
select * from public.apply_stock_movement_delta_v2(
 '10000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'confirmation'::public.stock_movement_type,1,p_created_by:=auth.uid());
\echo 'P06 full function: other-store attempt denied'
do $cross$
begin
 perform public.apply_stock_movement_delta_v2(
 '20000000-0000-0000-0000-000000000002',
 'b0000000-0000-0000-0000-000000000002',
 'entry'::public.stock_movement_type,5,p_created_by:=auth.uid());
 raise exception 'P06 FAIL: cross-store stock modification succeeded';
exception when insufficient_privilege then null;
end $cross$;
select set_config('request.jwt.claims',
 '{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}',false);
\echo 'P06 full function: read-only employee denied'
do $reader$
begin
 perform public.apply_stock_movement_delta_v2(
 '10000000-0000-0000-0000-000000000001',
 'a0000000-0000-0000-0000-000000000001',
 'entry'::public.stock_movement_type,5,p_created_by:=auth.uid());
 raise exception 'P06 FAIL: reader stock modification succeeded';
exception when insufficient_privilege then null;
end $reader$;
reset role;

do $final$
declare a public.inventory_balances;b public.inventory_balances;nm int;na int;
begin
select * into a from public.inventory_balances where store_id='10000000-0000-0000-0000-000000000001';
select * into b from public.inventory_balances where store_id='20000000-0000-0000-0000-000000000002';
select count(*) into nm from public.stock_movements where store_id=a.store_id;
select count(*) into na from public.audit_logs where store_id=a.store_id;
if a.on_hand is distinct from 21 or a.reserved is distinct from 3
 or b.on_hand is distinct from 31 or b.reserved is distinct from 7
 or nm<>3 or na<>2 then
 raise exception 'P06 FAIL full movement: a %, aRes %, b %, bRes %, moves %, audits %',
 a.on_hand,a.reserved,b.on_hand,b.reserved,nm,na;
end if;
end $final$;
\echo 'P06 PASS: full real movement body entry/exit/reservation/cancellation/confirmation + role boundaries'
