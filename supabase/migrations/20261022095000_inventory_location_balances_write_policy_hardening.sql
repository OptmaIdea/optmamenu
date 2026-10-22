-- P07: Harden legacy permissive write policies on inventory_location_balances.
-- Previously every active store member could INSERT/UPDATE/DELETE, regardless of stock permission.
-- Preserve SELECT/read-only policies and all stock movement/business functions.
begin;
do $baseline$
declare v_count integer;
begin
 if not exists(select 1 from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname='public' and c.relname='inventory_location_balances' and c.relrowsecurity)
 then raise exception 'P07 RLS not enabled'; end if;
 select count(*) into v_count from pg_policies
 where schemaname='public' and tablename='inventory_location_balances'
 and (
   (policyname='inventory_location_balances_insert' and cmd='INSERT' and with_check='is_store_member(store_id)')
   or (policyname='inventory_location_balances_update' and cmd='UPDATE' and qual='is_store_member(store_id)' and with_check='is_store_member(store_id)')
   or (policyname='inventory_location_balances_delete' and cmd='DELETE' and qual='is_store_member(store_id)')
 );
 if v_count<>3 then raise exception 'P07 policy baseline drift: % policies matched, expected 3', v_count; end if;
end $baseline$;

-- Existing permission-based policies already authorize INSERT and UPDATE.
-- Narrow the three legacy rules to identical write permissions, retaining policy names.
alter policy inventory_location_balances_insert on public.inventory_location_balances
to authenticated
with check (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id,'stock.adjust')
  or public.user_has_store_permission(store_id,'stock.transfer')
);

alter policy inventory_location_balances_update on public.inventory_location_balances
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id,'stock.adjust')
  or public.user_has_store_permission(store_id,'stock.transfer')
)
with check (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id,'stock.adjust')
  or public.user_has_store_permission(store_id,'stock.transfer')
);

alter policy inventory_location_balances_delete on public.inventory_location_balances
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id,'stock.adjust')
  or public.user_has_store_permission(store_id,'stock.transfer')
);

do $post$
begin
 if exists (select 1 from pg_policies where schemaname='public' and tablename='inventory_location_balances'
  and policyname in ('inventory_location_balances_insert','inventory_location_balances_update','inventory_location_balances_delete')
  and (roles::text <> '{authenticated}'
   or coalesce(qual,'') ilike '%is_store_member%'
   or coalesce(with_check,'') ilike '%is_store_member%'))
 then raise exception 'P07 incomplete: unsafe member-only legacy write policy remains'; end if;
 if (select count(*) from pg_policies where schemaname='public' and tablename='inventory_location_balances' and policyname in
 ('inventory_location_balances_select','inventory_location_balances_select_by_permission')) <> 2
 then raise exception 'P07 accidentally removed stock read policies'; end if;
end $post$;
commit;
