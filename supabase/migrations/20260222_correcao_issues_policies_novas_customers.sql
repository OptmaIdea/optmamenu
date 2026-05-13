-- =========================================================
-- E4) CUSTOMERS / ADDRESSES / NOTIFICATIONS / CONSENT
-- =========================================================

-- Owner: vê todos customers do store
drop policy if exists "customers_owner_read" on public.customers;
create policy "customers_owner_read"
on public.customers
for select
to authenticated
using (store_id = public.app_current_store_id());

-- Customer: vê só o próprio
drop policy if exists "customers_self_select" on public.customers;
create policy "customers_self_select"
on public.customers
for select
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and id = public.app_current_customer_id()
  and store_id = public.app_current_store_id()
);

drop policy if exists "customers_self_update" on public.customers;
create policy "customers_self_update"
on public.customers
for update
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and id = public.app_current_customer_id()
  and store_id = public.app_current_store_id()
)
with check (
  id = public.app_current_customer_id()
  and store_id = public.app_current_store_id()
);

-- Addresses: owner read, customer self all
drop policy if exists "addresses_owner_read" on public.customer_addresses;
create policy "addresses_owner_read"
on public.customer_addresses
for select
to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and c.store_id = public.app_current_store_id()
  )
);

drop policy if exists "addresses_self_all" on public.customer_addresses;
create policy "addresses_self_all"
on public.customer_addresses
for all
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and c.id = public.app_current_customer_id()
      and c.store_id = public.app_current_store_id()
  )
)
with check (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and c.id = public.app_current_customer_id()
      and c.store_id = public.app_current_store_id()
  )
);

-- Notifications: owner read, customer self all
drop policy if exists "notifications_owner_read" on public.customer_notifications;
create policy "notifications_owner_read"
on public.customer_notifications
for select
to authenticated
using (store_id = public.app_current_store_id());

drop policy if exists "notifications_self_all" on public.customer_notifications;
create policy "notifications_self_all"
on public.customer_notifications
for all
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and store_id = public.app_current_store_id()
  and customer_id = public.app_current_customer_id()
)
with check (
  store_id = public.app_current_store_id()
  and customer_id = public.app_current_customer_id()
);

-- Consent logs: apenas owner (por segurança)
drop policy if exists "consent_owner_read" on public.customer_consent_logs;
create policy "consent_owner_read"
on public.customer_consent_logs
for select
to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_consent_logs.customer_id
      and c.store_id = public.app_current_store_id()
  )
);