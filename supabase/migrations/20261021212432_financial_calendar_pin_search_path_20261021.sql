-- P04: Pin search_path for two financial calendar helpers (no change to logic).
-- Both are SECURITY INVOKER and use pg_catalog built-ins / public-qualified helpers.
begin;
alter function public.financial_easter_sunday(integer) set search_path = '';
alter function public.financial_banking_holidays_for_year(integer) set search_path = '';
do $p04$
begin
  if exists(select 1 from pg_proc p join pg_namespace n on p.pronamespace=n.oid
    where n.nspname='public' and p.proname in ('financial_easter_sunday','financial_banking_holidays_for_year')
      and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) cfg where starts_with(cfg,'search_path=')) or p.prosecdef))
  then raise exception 'P04 search_path pin or SECURITY INVOKER assertion failed'; end if;
end
$p04$;
commit;
