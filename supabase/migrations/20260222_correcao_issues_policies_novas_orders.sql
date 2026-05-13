-- =========================================================
-- E5) ORDERS / ITEMS (owner total; customer limitado por phone claim)
-- =========================================================

-- Owner: tudo do store
drop policy if exists "orders_owner_all" on public.orders;
create policy "orders_owner_all"
on public.orders
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

-- Customer: select limitado (store + phone claim)
drop policy if exists "orders_customer_select_limited" on public.orders;
create policy "orders_customer_select_limited"
on public.orders
for select
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and store_id = public.app_current_store_id()
  and customer_phone is not null
  and customer_phone = public.app_jwt_claim('phone')
);

-- Customer insert (se você ainda precisar agora; ideal é RPC/edge)
drop policy if exists "orders_customer_insert_limited" on public.orders;
create policy "orders_customer_insert_limited"
on public.orders
for insert
to anon, authenticated
with check (
  public.app_current_role() = 'customer'
  and store_id = public.app_current_store_id()
  and customer_phone = public.app_jwt_claim('phone')
);

-- Items: owner all via order store
drop policy if exists "order_items_owner_all" on public.order_items;
create policy "order_items_owner_all"
on public.order_items
for all
to authenticated
using (
  exists (select 1 from public.orders o
          where o.id = order_items.order_id
            and o.store_id = public.app_current_store_id())
)
with check (
  exists (select 1 from public.orders o
          where o.id = order_items.order_id
            and o.store_id = public.app_current_store_id())
);

-- Customer all limitado via order.phone
drop policy if exists "order_items_customer_limited" on public.order_items;
create policy "order_items_customer_limited"
on public.order_items
for all
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.store_id = public.app_current_store_id()
      and o.customer_phone = public.app_jwt_claim('phone')
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.store_id = public.app_current_store_id()
      and o.customer_phone = public.app_jwt_claim('phone')
  )
);