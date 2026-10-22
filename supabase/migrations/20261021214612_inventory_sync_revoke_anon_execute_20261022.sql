-- P05 / 2026-10-22: minimal privilege reduction, no stock business logic changed.
-- Authenticated execution MUST remain until the invoker movement dependency is refactored.
-- SECURITY DEFINER callers execute as their owner; anonymous direct Data API calls are denied.
begin;
revoke execute on function public.sync_inventory_balance_from_locations(uuid,uuid,uuid)
  from public, anon;
grant execute on function public.sync_inventory_balance_from_locations(uuid,uuid,uuid)
  to authenticated, service_role;
do $p05$
declare r regprocedure := 'public.sync_inventory_balance_from_locations(uuid,uuid,uuid)'::regprocedure;
begin
  if has_function_privilege('anon',r,'EXECUTE') then
    raise exception 'P05: anonymous direct EXECUTE must be denied';
  end if;
  if not has_function_privilege('authenticated',r,'EXECUTE')
     or not has_function_privilege('service_role',r,'EXECUTE') then
    raise exception 'P05: legitimate stock caller privileges must be retained';
  end if;
end;
$p05$;
commit;
