\set ON_ERROR_STOP on
\echo 'P07: synthetic PostgreSQL 17 with pre-existing REAL policy conditions and permission boundary'
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon,authenticated;
create schema if not exists auth;
grant usage on schema auth to authenticated,anon;
create function auth.uid() returns uuid language sql stable as $fn$
 select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid $fn$;

create table public.stores(id uuid primary key,user_id uuid);
create table public.store_members(user_id uuid,store_id uuid,role text,status text,permissions jsonb default '{}'::jsonb);
create table public.inventory_location_balances(
 id uuid primary key,store_id uuid not null,product_id uuid not null,on_hand numeric not null,reserved numeric not null
);
insert into public.stores values
 ('10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000005');
insert into public.store_members(user_id,store_id,role,status,permissions) values
 ('e0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','staff','active','{"stock.adjust":true}'),
 ('e0000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','staff','active','{"stock.view":true}'),
 ('e0000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','staff','active','{"stock.transfer":true}'),
 ('e0000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000002','staff','active','{"stock.adjust":true}');
insert into public.inventory_location_balances values
 ('f0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',20,4),
 ('f0000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',31,7);

create function public.is_store_member(p_store_id uuid) returns boolean language sql stable security definer
set search_path = public as $fn$
 select exists(select 1 from public.stores where id=p_store_id and user_id=auth.uid())
 or exists(select 1 from public.store_members where store_id=p_store_id and user_id=auth.uid() and status='active') $fn$;
create function public.app_is_store_owner(p_store_id uuid) returns boolean language sql stable security definer
set search_path = public as $fn$
 select exists(select 1 from public.stores where id=p_store_id and user_id=auth.uid())
 or exists(select 1 from public.store_members where store_id=p_store_id and user_id=auth.uid() and status='active' and role='owner') $fn$;
create function public.user_has_store_permission(p_store_id uuid,p_perm text) returns boolean
language sql stable security definer set search_path=public as $fn$
 select exists(select 1 from public.store_members where store_id=p_store_id and user_id=auth.uid()
  and status='active' and coalesce((permissions->>p_perm)::boolean,false)) $fn$;
grant execute on function public.is_store_member(uuid),public.app_is_store_owner(uuid),public.user_has_store_permission(uuid,text) to authenticated;
alter table public.inventory_location_balances enable row level security;
grant select,insert,update,delete on public.inventory_location_balances to authenticated;
-- Exact production policy expressions and names on October 22.
create policy inventory_location_balances_select on public.inventory_location_balances for select to public
 using(is_store_member(store_id));
create policy inventory_location_balances_select_by_permission on public.inventory_location_balances for select to authenticated
 using(app_is_store_owner(store_id) or user_has_store_permission(store_id,'stock.view')
  or user_has_store_permission(store_id,'stock.adjust') or user_has_store_permission(store_id,'stock.transfer')
  or user_has_store_permission(store_id,'products.view'));
create policy inventory_location_balances_insert on public.inventory_location_balances for insert to public
 with check(is_store_member(store_id));
create policy inventory_location_balances_update on public.inventory_location_balances for update to public
 using(is_store_member(store_id)) with check(is_store_member(store_id));
create policy inventory_location_balances_delete on public.inventory_location_balances for delete to public
 using(is_store_member(store_id));
create policy inventory_location_balances_insert_by_permission on public.inventory_location_balances for insert to authenticated
 with check(app_is_store_owner(store_id) or user_has_store_permission(store_id,'stock.adjust') or user_has_store_permission(store_id,'stock.transfer'));
create policy inventory_location_balances_update_by_permission on public.inventory_location_balances for update to authenticated
 using(app_is_store_owner(store_id) or user_has_store_permission(store_id,'stock.adjust') or user_has_store_permission(store_id,'stock.transfer'))
 with check(app_is_store_owner(store_id) or user_has_store_permission(store_id,'stock.adjust') or user_has_store_permission(store_id,'stock.transfer'));

\echo 'P07 baseline: reproduce read-only employee unauthorized UPDATE (fixture only)'
set role authenticated;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}',false);
do $vulnerable$
declare count_rows int;
begin
 update public.inventory_location_balances set on_hand=on_hand+1
 where id='f0000000-0000-0000-0000-000000000001'::uuid;
 get diagnostics count_rows = row_count;
 if count_rows<>1 then raise exception 'P07 fixture did not reproduce broad member-only UPDATE'; end if;
end $vulnerable$;
reset role;
update public.inventory_location_balances set on_hand=20 where id='f0000000-0000-0000-0000-000000000001';
\echo 'P07 apply exact production migration'
\ir ../migrations/20261022063929_inventory_location_balances_write_policy_hardening_20261022.sql

-- Safe test utility executes under caller RLS, checks actual ROW_COUNT and effects.
create function public.p07_attempt_write(p_action text,p_target_store uuid)
returns int language plpgsql security invoker set search_path=public,pg_temp as $fn$
declare n int;
begin
 if p_action='update' then
  update public.inventory_location_balances set on_hand=on_hand+1 where store_id=p_target_store;
 elsif p_action='delete' then
  delete from public.inventory_location_balances where store_id=p_target_store;
 elsif p_action='insert' then
  insert into public.inventory_location_balances(id,store_id,product_id,on_hand,reserved)
   values (gen_random_uuid(),p_target_store,gen_random_uuid(),1,0);
 else raise exception 'invalid test action'; end if;
 get diagnostics n=row_count;
 return n;
end $fn$;
grant execute on function public.p07_attempt_write(text,uuid) to authenticated;
\echo 'P07 read-only same-store: can SELECT but cannot write any row'
set role authenticated;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-0000-0000-000000000003","role":"authenticated"}',false);
do $readonly$
declare n int;
begin
 select count(*) into n from public.inventory_location_balances where store_id='10000000-0000-0000-0000-000000000001';
 if n<>1 then raise exception 'P07 read-only SELECT regression';end if;
 select public.p07_attempt_write('update','10000000-0000-0000-0000-000000000001') into n;
 if n<>0 then raise exception 'P07 read-only UPDATE permitted';end if;
 select public.p07_attempt_write('delete','10000000-0000-0000-0000-000000000001') into n;
 if n<>0 then raise exception 'P07 read-only DELETE permitted';end if;
 begin
  perform public.p07_attempt_write('insert','10000000-0000-0000-0000-000000000001');
  raise exception 'P07 read-only INSERT permitted';
 exception when insufficient_privilege then null;
 end;
end $readonly$;
reset role;
\echo 'P07 cross-store operator: A adjust cannot touch B'
set role authenticated;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}',false);
do $cross$
declare n int;
begin
 select public.p07_attempt_write('update','20000000-0000-0000-0000-000000000002') into n;
 if n<>0 then raise exception 'P07 cross-store UPDATE permitted';end if;
 select public.p07_attempt_write('delete','20000000-0000-0000-0000-000000000002') into n;
 if n<>0 then raise exception 'P07 cross-store DELETE permitted';end if;
 begin
  perform public.p07_attempt_write('insert','20000000-0000-0000-0000-000000000002');
  raise exception 'P07 cross-store INSERT permitted';
 exception when insufficient_privilege then null;end;
end $cross$;
reset role;
\echo 'P07 owner A, stock.adjust A and stock.transfer A remain authorized'
set role authenticated;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated"}',false);
select public.p07_attempt_write('update','10000000-0000-0000-0000-000000000001') as owner_update;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-0000-0000-000000000002","role":"authenticated"}',false);
select public.p07_attempt_write('insert','10000000-0000-0000-0000-000000000001') as adjust_insert;
select set_config('request.jwt.claims','{"sub":"e0000000-0000-0000-0000-000000000004","role":"authenticated"}',false);
select public.p07_attempt_write('delete','10000000-0000-0000-0000-000000000001') as transfer_delete;
reset role;

do $check$
declare a int;b int;
begin
 select count(*) into a from public.inventory_location_balances where store_id='10000000-0000-0000-0000-000000000001';
 select count(*) into b from public.inventory_location_balances where store_id='20000000-0000-0000-0000-000000000002';
 if a<>0 or b<>1 then raise exception 'P07 post-state unexpected A=% B=%',a,b;end if;
end $check$;
\echo 'P07 PASS: denied reader/cross-store; owner/adjust/transfer preserved; SELECT untouched'
