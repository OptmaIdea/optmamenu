\set ON_ERROR_STOP on
create role authenticator login noinherit password 'p06-lab-postgrest-only';
grant anon,authenticated to authenticator;
grant usage on schema public to authenticator;
grant usage on schema auth to authenticator;
do $check$
begin
 if exists(select 1 from pg_roles where rolname in ('anon','authenticated','authenticator') and (rolsuper or rolbypassrls)) then
 raise exception 'P06 HTTP test roles must not bypass RLS'; end if;
end $check$;
