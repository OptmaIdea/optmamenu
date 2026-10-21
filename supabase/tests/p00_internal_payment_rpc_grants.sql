-- Isolated PostgreSQL 17 test: no Supabase project, no production data, no credentials.
-- Reproduce original unwanted PUBLIC EXECUTE and apply the exact versioned migration.
\set ON_ERROR_STOP on
\echo 'P00: create isolated roles and representative SECURITY DEFINER helper'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
grant usage on schema public to anon, authenticated, service_role;

create table public.store_online_payment_providers (
  store_id uuid not null,
  provider_code text not null,
  environment text not null,
  credential_status text not null,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.store_online_payment_providers (
  store_id, provider_code, environment, credential_status
) values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'synthetic_test', 'sandbox', 'configured'
);

create function public.mark_online_payment_provider_credential_status_internal(
  p_store_id uuid, p_provider_code text, p_environment text,
  p_status text, p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if p_status not in ('not_configured', 'configured', 'invalid', 'ready') then
    raise exception 'invalid credential status';
  end if;
  update public.store_online_payment_providers
  set credential_status=p_status,
      metadata=coalesce(metadata, '{}'::jsonb)||coalesce(p_metadata, '{}'::jsonb),
      updated_at=now()
  where store_id=p_store_id
    and provider_code=p_provider_code
    and environment=p_environment;
end;
$fn$;

do $precondition$
declare
  v_target regprocedure := 'public.mark_online_payment_provider_credential_status_internal(uuid,text,text,text,jsonb)'::regprocedure;
begin
  if not has_function_privilege('anon', v_target, 'EXECUTE')
    or not has_function_privilege('authenticated', v_target, 'EXECUTE') then
    raise exception 'P00 reproduction failed: expected original public EXECUTE';
  end if;
end
$precondition$;

\echo 'P00: apply actual migration against fresh isolated Postgres'
\ir ../migrations/20261021100000_revoke_public_payment_credential_status_internal.sql

\echo 'P00: negative role access — anon'
set role anon;
do $anon_test$
begin
  perform public.mark_online_payment_provider_credential_status_internal(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'synthetic_test', 'sandbox', 'invalid', '{}'::jsonb
  );
  raise exception 'P00 FAIL: anonymous role unexpectedly executed internal helper';
exception when insufficient_privilege then
  null;
end
$anon_test$;
reset role;

\echo 'P00: negative role access — authenticated'
set role authenticated;
do $auth_test$
begin
  perform public.mark_online_payment_provider_credential_status_internal(
    '00000000-0000-0000-0000-000000000001'::uuid,
    'synthetic_test', 'sandbox', 'invalid', '{}'::jsonb
  );
  raise exception 'P00 FAIL: authenticated role unexpectedly executed internal helper';
exception when insufficient_privilege then
  null;
end
$auth_test$;
reset role;

\echo 'P00: positive role access — service_role'
set role service_role;
select public.mark_online_payment_provider_credential_status_internal(
  '00000000-0000-0000-0000-000000000001'::uuid,
  'synthetic_test', 'sandbox', 'ready', '{"source":"acl_test"}'::jsonb
);
reset role;

\echo 'P00: verify only authorized call changed fixture'
do $postcondition$
declare
  v_status text;
  v_metadata jsonb;
begin
  select credential_status, metadata
  into v_status, v_metadata
  from public.store_online_payment_providers
  where store_id='00000000-0000-0000-0000-000000000001'::uuid
    and provider_code='synthetic_test';

  if v_status is distinct from 'ready'
    or v_metadata->>'source' is distinct from 'acl_test' then
    raise exception 'P00 FAIL: service_role call did not update synthetic fixture';
  end if;
end
$postcondition$;
\echo 'P00 PASS — privilege boundary enforced, no production data involved'
