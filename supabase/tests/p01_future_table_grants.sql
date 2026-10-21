-- P01 / October 30, 2026 readiness
-- Real PostgreSQL 17 isolated CI test; synthetic tables and roles only.
-- Demonstrates that existing grants are preserved while newly created tables
-- require deliberate opt-in; tests least-privilege grants separately from RLS.
\set ON_ERROR_STOP on

\echo 'P01: emulate legacy Supabase default table permissions'
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;

create table public.p01_legacy_probe (id integer primary key);

do $legacy$
begin
  if not has_table_privilege('anon', 'public.p01_legacy_probe', 'SELECT')
    or not has_table_privilege('authenticated', 'public.p01_legacy_probe', 'UPDATE')
    or not has_table_privilege('service_role', 'public.p01_legacy_probe', 'INSERT') then
    raise exception 'P01 FAIL: legacy default-grants reproduction failed';
  end if;
end
$legacy$;

\echo 'P01: simulate new default — no automatic Data API table grants'
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

create table public.p01_internal_credentials (
  id integer primary key,
  synthetic_secret text not null
);
create table public.p01_public_catalog (
  id integer primary key,
  label text not null
);

do $defaults$
begin
  if has_table_privilege('anon', 'public.p01_internal_credentials', 'SELECT')
    or has_table_privilege('authenticated', 'public.p01_internal_credentials', 'INSERT')
    or has_table_privilege('service_role', 'public.p01_internal_credentials', 'SELECT')
    or has_table_privilege('anon', 'public.p01_public_catalog', 'SELECT')
    then
    raise exception 'P01 FAIL: new tables unexpectedly inherited broad grants';
  end if;

  if not has_table_privilege('anon', 'public.p01_legacy_probe', 'SELECT') then
    raise exception 'P01 FAIL: existing table lost its historical grant';
  end if;
end
$defaults$;

\echo 'P01: explicit limited access to catalog; internal table stays private'
alter table public.p01_internal_credentials enable row level security;
alter table public.p01_public_catalog enable row level security;
create policy p01_anon_catalog_select
  on public.p01_public_catalog
  for select to anon using (true);
grant select on table public.p01_public_catalog to anon;
insert into public.p01_public_catalog(id,label) values (1,'synthetic public catalog');

set role anon;
do $deny_secret$
begin
  perform count(*) from public.p01_internal_credentials;
  raise exception 'P01 FAIL: anonymous read private table';
exception when insufficient_privilege then
  null;
end
$deny_secret$;
select count(*) as synthetic_catalog_visible from public.p01_public_catalog;
reset role;

set role authenticated;
do $deny_auth$
begin
  perform count(*) from public.p01_internal_credentials;
  raise exception 'P01 FAIL: authenticated read private table';
exception when insufficient_privilege then
  null;
end
$deny_auth$;
reset role;

do $final$
begin
  if has_table_privilege('anon', 'public.p01_internal_credentials', 'SELECT')
    or has_table_privilege('authenticated', 'public.p01_internal_credentials', 'SELECT')
    or has_table_privilege('service_role', 'public.p01_internal_credentials', 'SELECT') then
    raise exception 'P01 FAIL: internal table was accidentally exposed';
  end if;
  if has_table_privilege('authenticated', 'public.p01_public_catalog', 'SELECT')
    or not has_table_privilege('anon', 'public.p01_public_catalog', 'SELECT') then
    raise exception 'P01 FAIL: catalog grant matrix incorrect';
  end if;
end
$final$;

\echo 'P01 PASS — new private tables remain inaccessible; explicitly public catalog works'
