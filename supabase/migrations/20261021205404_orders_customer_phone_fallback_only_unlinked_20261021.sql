-- OptmaMenu P02. Do not let phone fallback override a linked customer_id.
-- Retains legacy unlinked guest orders for phone-matched, trusted customer sessions.
-- Preserves the store boundary and revocable customer session/device checks.
begin;

do $preflight$
declare
  v_using text;
begin
  select qual into v_using
  from pg_policies
  where schemaname='public'
    and tablename='orders'
    and policyname='orders_customer_select_own'
    and cmd='SELECT';
  if v_using is null
     or position('customer_phone' in v_using)=0
     or position('app_current_store_id' in v_using)=0
     or position('app_current_customer_id' in v_using)=0 then
    raise exception 'P02 preflight failed: current orders customer policy differs from reviewed baseline';
  end if;
end
$preflight$;

alter policy orders_customer_select_own
on public.orders
using (
  public.app_current_role() = 'customer'::text
  and store_id = public.app_current_store_id()
  and (
    customer_id = public.app_current_customer_id()
    or (
      customer_id is null
      and customer_phone is not null
      and customer_phone = public.app_jwt_claim('phone'::text)
    )
  )
);

do $postflight$
declare v_using text;
begin
  select qual into v_using from pg_policies
  where schemaname='public' and tablename='orders'
    and policyname='orders_customer_select_own';
  if position('customer_id IS NULL' in upper(v_using))=0
     and position('CUSTOMER_ID IS NULL' in upper(v_using))=0 then
    raise exception 'P02 postflight failed: unlinked-order guard is absent';
  end if;
end
$postflight$;
commit;
