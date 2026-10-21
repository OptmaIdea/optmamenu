\set ON_ERROR_STOP on
\echo 'P01: real PostgreSQL 17 test with synthetic data'
create schema if not exists auth;
create function auth.uid() returns uuid language sql stable as $f$ select '00000000-0000-0000-0000-000000000011'::uuid $f$;
create function public.app_is_store_owner(p_store_id uuid) returns boolean language sql as $f$ select true $f$;
create function public.user_has_store_permission_v2(p_store_id uuid,p_code text) returns boolean language sql as $f$ select true $f$;

create table public.store_online_payment_providers(
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null,
  provider_code text not null,
  environment text not null,
  display_name text not null default '',
  enabled boolean not null default false,
  is_default boolean not null default false,
  credential_status text not null default 'not_configured',
  capabilities jsonb not null default '{}'::jsonb,
  public_config jsonb not null default '{}'::jsonb,
  secret_ref text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (store_id,provider_code,environment)
);

insert into public.store_online_payment_providers
(store_id,provider_code,environment,display_name,enabled,is_default)
values
('00000000-0000-0000-0000-000000000001','asaas','sandbox','Asaas',true,true),
('00000000-0000-0000-0000-000000000001','optma_sandbox','sandbox','OptmaPay',true,false);

\echo 'P01: apply exact migration from repository'
\ir ../migrations/20261021150000_retire_asaas_provider_safe.sql

do $checks$
declare r jsonb;
begin
  select public.save_online_payment_provider_safe(
    '00000000-0000-0000-0000-000000000001'::uuid,'asaas','sandbox',true,true,'{}'::jsonb
  ) into r;
  if r->>'error' is distinct from 'provider_retired' then raise exception 'Asaas sandbox still configurable'; end if;

  select public.save_online_payment_provider_safe(
    '00000000-0000-0000-0000-000000000001'::uuid,'asaas','production',true,true,'{}'::jsonb
  ) into r;
  if r->>'error' is distinct from 'provider_retired' then raise exception 'Asaas production still configurable'; end if;

  select public.save_online_payment_provider_safe(
    '00000000-0000-0000-0000-000000000001'::uuid,'optma_sandbox','sandbox',true,true,'{}'::jsonb
  ) into r;
  if r->>'ok' is distinct from 'true' then raise exception 'OptmaPay regression: %',r; end if;
  if exists (select 1 from public.store_online_payment_providers where provider_code='asaas' and (enabled or is_default)) then
    raise exception 'Asaas provider remains active';
  end if;
  if not exists (select 1 from public.store_online_payment_providers where provider_code='optma_sandbox' and enabled and is_default) then
    raise exception 'OptmaPay did not remain enabled';
  end if;
end
$checks$;
\echo 'P01 passed'
