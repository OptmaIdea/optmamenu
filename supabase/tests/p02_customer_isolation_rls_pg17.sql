\set ON_ERROR_STOP on
\echo 'P02: PostgreSQL 17 isolated simulation using REAL Oct-21 production RLS policy expressions and identity functions'
-- Caution: JWT claims injected by trusted database test runner, not cryptographically verified.
-- All UUIDs/phones here are synthetic; no calls to production SQL or customer data.
create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon,authenticated;
create schema if not exists auth;
grant usage on schema auth to anon,authenticated;
create function auth.uid() returns uuid
 language sql stable as $a$
 select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub','')::uuid
 $a$;
create function auth.role() returns text
 language sql stable as $a$
 select nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'role','')
 $a$;

create table public.stores(id uuid primary key,user_id uuid not null);
create table public.customers(id uuid primary key,store_id uuid not null);
create table public.customer_auth_identities (
 customer_id uuid not null,store_id uuid not null,auth_user_id uuid not null,
 revoked_at timestamptz,sessions_valid_after timestamptz
);
create table public.customer_auth_session_devices (
 customer_id uuid not null,store_id uuid not null,auth_user_id uuid not null,
 session_id uuid not null,trusted_device_id uuid not null,revoked_at timestamptz
);
create table public.customer_auth_trusted_devices (
 id uuid primary key,customer_id uuid not null,store_id uuid not null,revoked_at timestamptz
);
create table public.orders (
 id uuid primary key,store_id uuid not null,customer_id uuid,customer_phone text
);
create table public.loyalty_transactions (
 id uuid primary key,customer_id uuid not null
);
-- Only database-admin roles see private customer auth material.
alter table public.customer_auth_identities enable row level security;
create policy customer_auth_identities_no_direct_access on public.customer_auth_identities
for all to public using (false) with check (false);
revoke all on public.customer_auth_identities from public,anon,authenticated;
grant select on public.orders,public.loyalty_transactions to anon,authenticated;
alter table public.orders enable row level security;
alter table public.loyalty_transactions enable row level security;

-- Staff loyalty helper has unrelated permission-tree dependencies; deny staff
-- in this focused CUSTOMER RLS test to avoid granting unsimulated staff powers.
create function public.can_view_loyalty_transaction_staff_safe(uuid)
returns boolean language sql stable as $h$ select false $h$;

-- Real helper definitions (read-only snapshot from project lgkkfmqzaorrutuoqeax):
CREATE OR REPLACE FUNCTION public.app_jwt_claim(claim text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim;
$function$;

CREATE OR REPLACE FUNCTION public.app_current_customer_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select (
    select cai.customer_id
    from public.customer_auth_identities cai
    join public.customer_auth_session_devices csd
      on csd.customer_id = cai.customer_id
     and csd.store_id = cai.store_id
     and csd.auth_user_id = cai.auth_user_id
     and csd.session_id = nullif(public.app_jwt_claim('session_id'), '')::uuid
     and csd.revoked_at is null
    join public.customer_auth_trusted_devices td
      on td.id = csd.trusted_device_id
     and td.customer_id = cai.customer_id
     and td.store_id = cai.store_id
     and td.revoked_at is null
    where cai.auth_user_id = auth.uid()
      and cai.revoked_at is null
      and (
        cai.sessions_valid_after is null
        or coalesce(nullif(public.app_jwt_claim('iat'), '')::bigint, 0)
           >= ceil(extract(epoch from cai.sessions_valid_after))::bigint
      )
    limit 1
  );
$function$;

CREATE OR REPLACE FUNCTION public.app_current_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_customer uuid;
  v_claim text := public.app_jwt_claim('role');
begin
  select cai.customer_id
    into v_customer
  from public.customer_auth_identities cai
  join public.customer_auth_session_devices csd
    on csd.customer_id = cai.customer_id
   and csd.store_id = cai.store_id
   and csd.auth_user_id = cai.auth_user_id
   and csd.session_id = nullif(public.app_jwt_claim('session_id'), '')::uuid
   and csd.revoked_at is null
  join public.customer_auth_trusted_devices td
    on td.id = csd.trusted_device_id
   and td.customer_id = cai.customer_id
   and td.store_id = cai.store_id
   and td.revoked_at is null
  where cai.auth_user_id = auth.uid()
    and cai.revoked_at is null
    and (
      cai.sessions_valid_after is null
      or coalesce(nullif(public.app_jwt_claim('iat'), '')::bigint, 0)
         >= ceil(extract(epoch from cai.sessions_valid_after))::bigint
    )
  limit 1;

  if v_customer is not null then
    return 'customer';
  end if;

  return coalesce(v_claim, auth.role());
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_current_store_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (
      select cai.store_id
      from public.customer_auth_identities cai
      join public.customer_auth_session_devices csd
        on csd.customer_id = cai.customer_id
       and csd.store_id = cai.store_id
       and csd.auth_user_id = cai.auth_user_id
       and csd.session_id = nullif(public.app_jwt_claim('session_id'), '')::uuid
       and csd.revoked_at is null
      join public.customer_auth_trusted_devices td
        on td.id = csd.trusted_device_id
       and td.customer_id = cai.customer_id
       and td.store_id = cai.store_id
       and td.revoked_at is null
      where cai.auth_user_id = auth.uid()
        and cai.revoked_at is null
        and (
          cai.sessions_valid_after is null
          or coalesce(nullif(public.app_jwt_claim('iat'), '')::bigint, 0)
             >= ceil(extract(epoch from cai.sessions_valid_after))::bigint
        )
      limit 1
    ),
    (select s.id from public.stores s where s.user_id = auth.uid() limit 1)
  );
$function$;

-- Real policy expressions (read-only snapshot):
create policy loyalty_transactions_customer_select_own on public.loyalty_transactions for SELECT to anon, authenticated
using ((app_current_role() = 'customer'::text) AND (customer_id = app_current_customer_id()));

create policy loyalty_transactions_staff_select_realtime on public.loyalty_transactions for SELECT to authenticated
using can_view_loyalty_transaction_staff_safe(customer_id);

create policy orders_customer_select_own on public.orders for SELECT to anon, authenticated
using ((app_current_role() = 'customer'::text) AND (store_id = app_current_store_id()) AND ((customer_id = app_current_customer_id()) OR ((customer_phone IS NOT NULL) AND (customer_phone = app_jwt_claim('phone'::text)))));

create policy orders_owner_all on public.orders for ALL to authenticated
using ((app_current_role() <> 'customer'::text) AND (store_id = app_current_store_id()))
with check ((app_current_role() <> 'customer'::text) AND (store_id = app_current_store_id()));

\echo 'P02: seed 2 stores, 3 customers, 3 customer sessions and 1 store owner'
insert into public.stores values
 ('10000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000002');
insert into public.customers values
 ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
 ('b0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
insert into public.customer_auth_identities(customer_id,store_id,auth_user_id) values
 ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001'),
 ('a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002'),
 ('b0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001');
insert into public.customer_auth_trusted_devices(id,customer_id,store_id) values
 ('f1000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('f1000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001'),
 ('f1000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002');
insert into public.customer_auth_session_devices(customer_id,store_id,auth_user_id,session_id,trusted_device_id) values
 ('a0000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001'),
 ('a0000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000002'),
 ('b0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000003');
insert into public.orders(id,store_id,customer_id,customer_phone) values
 ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','+5511999000001'),
 ('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','+5511999000002'),
 ('11000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','+5511999000001'),
 ('11000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','+5511999000001');
insert into public.loyalty_transactions(id,customer_id) values
 ('22000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001'),
 ('22000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002'),
 ('22000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001');

create function public.p02_assert_counts(expected_orders int,expected_loyalty int,scenario text)
returns void language plpgsql as $assert$
declare got_orders int;got_loyalty int;
begin
 select count(*) into got_orders from public.orders;
 select count(*) into got_loyalty from public.loyalty_transactions;
 if got_orders <> expected_orders or got_loyalty <> expected_loyalty then
   raise exception 'P02 FAIL %: got orders=%, loyalty=%, expected orders=%, loyalty=%',
      scenario,got_orders,got_loyalty,expected_orders,expected_loyalty;
 end if;
 raise notice 'P02 PASS: % orders=% loyalty=%',scenario,got_orders,got_loyalty;
end
$assert$;

\echo 'P02 customer A — claims try to spoof another store, but DB uses verified device/store'
set role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f0000000-0000-0000-0000-000000000001","iat":1780000000,"phone":"+5511999000001","store_id":"20000000-0000-0000-0000-000000000002"}',false);
-- Two visible orders: own id, PLUS order 4 linked to another customer
-- in same store with same phone. Explicitly document this legacy fallback risk.
select public.p02_assert_counts(2,1,'A valid, other-store claim ignored and loyalty isolated');
do $guard$
begin
 if public.app_current_store_id() is distinct from '10000000-0000-0000-0000-000000000001'::uuid
    or public.app_current_customer_id() is distinct from 'a0000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'P02: customer identity not derived from trusted session';
 end if;
end
$guard$;

\echo 'P02 customer role claim escalation remains customer if device session is valid'
select set_config('request.jwt.claims',
 '{"sub":"c0000000-0000-0000-0000-000000000001","role":"owner","session_id":"f0000000-0000-0000-0000-000000000001","iat":1780000000,"phone":"+5511999000001"}',false);
select public.p02_assert_counts(2,1,'valid customer session ignores spoofed owner role');

\echo 'P02 customer B (same phone in different store) cannot access A orders'
select set_config('request.jwt.claims',
 '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f0000000-0000-0000-0000-000000000003","iat":1780000000,"phone":"+5511999000001"}',false);
select public.p02_assert_counts(1,1,'B cannot see A even with same phone');

\echo 'P02 customer A2 cannot see A orders with a different phone'
select set_config('request.jwt.claims',
 '{"sub":"c0000000-0000-0000-0000-000000000002","role":"authenticated","session_id":"f0000000-0000-0000-0000-000000000002","iat":1780000000,"phone":"+5511999000002"}',false);
select public.p02_assert_counts(2,1,'A2 only own customer orders and loyalty');

\echo 'P02 staff A can see its own store orders; staff loyalty is deliberately not simulated'
select set_config('request.jwt.claims',
 '{"sub":"e0000000-0000-0000-0000-000000000001","role":"authenticated","iat":1780000000}',false);
select public.p02_assert_counts(3,0,'staff A own store only');
reset role;

\echo 'P02 revoke trusted device A (no remaining client access)'
update public.customer_auth_trusted_devices set revoked_at=now()
where id='f1000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claims',
 '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated","session_id":"f0000000-0000-0000-0000-000000000001","iat":1780000000,"phone":"+5511999000001"}',false);
select public.p02_assert_counts(0,0,'device revoked');
reset role;
update public.customer_auth_trusted_devices set revoked_at=null
where id='f1000000-0000-0000-0000-000000000001';

\echo 'P02 revoke session A'
update public.customer_auth_session_devices set revoked_at=now()
where session_id='f0000000-0000-0000-0000-000000000001';
set role authenticated;
select public.p02_assert_counts(0,0,'session revoked');
reset role;
update public.customer_auth_session_devices set revoked_at=null
where session_id='f0000000-0000-0000-0000-000000000001';

\echo 'P02 revoke identity A'
update public.customer_auth_identities set revoked_at=now()
where auth_user_id='c0000000-0000-0000-0000-000000000001';
set role authenticated;
select public.p02_assert_counts(0,0,'identity revoked');
reset role;
update public.customer_auth_identities set revoked_at=null
where auth_user_id='c0000000-0000-0000-0000-000000000001';

\echo 'P02 force token issuance before sessions_valid_after'
update public.customer_auth_identities set sessions_valid_after=now()
where auth_user_id='c0000000-0000-0000-0000-000000000001';
set role authenticated;
select public.p02_assert_counts(0,0,'token issued before session cutoff');
reset role;

\echo 'P02 anonymous user cannot read orders or loyalty'
set role anon;
select set_config('request.jwt.claims','{"role":"anon"}',false);
select public.p02_assert_counts(0,0,'anonymous');
reset role;

\echo 'P02 no direct read of customer identity table'
do $privacy$
begin
 if has_table_privilege('authenticated','public.customer_auth_identities','SELECT')
    or has_table_privilege('anon','public.customer_auth_identities','SELECT') then
    raise exception 'P02 FAIL: direct identity-table read exposed';
 end if;
end
$privacy$;

\echo 'P02 PASS: verified identities, session/device revocation, store/customer separation, explicit same-phone fallback'
