\set ON_ERROR_STOP on
-- E2E HTTP JWT synthetic fixture runs AFTER p02_customer_isolation_rls_pg17.sql.
update public.customer_auth_identities set sessions_valid_after = null
where auth_user_id = 'c0000000-0000-0000-0000-000000000001'::uuid;
create role authenticator login noinherit password 'p04-only-local-postgrest';
grant anon, authenticated to authenticator;
grant usage on schema public to authenticator;
grant usage on schema auth to authenticator;
do $check$
begin
  if exists(select 1 from pg_roles where rolname in ('anon','authenticated','authenticator') and (rolbypassrls or rolsuper)) then
    raise exception 'P04 JWT roles must not have superuser/bypassrls';
  end if;
end $check$;
\echo 'P04 signed JWT HTTP fixture ready (synthetic data only)'
