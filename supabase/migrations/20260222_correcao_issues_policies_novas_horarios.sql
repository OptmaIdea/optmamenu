-- =========================================================
-- E3) STORE HOURS / MESSAGES
-- =========================================================

drop policy if exists "store_hours_read" on public.store_hours;
create policy "store_hours_read"
on public.store_hours
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
);

drop policy if exists "store_messages_read" on public.store_messages;
create policy "store_messages_read"
on public.store_messages
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
  and (expires_at is null or expires_at > now())
);

drop policy if exists "store_hours_owner_all" on public.store_hours;
create policy "store_hours_owner_all"
on public.store_hours
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "store_messages_owner_all" on public.store_messages;
create policy "store_messages_owner_all"
on public.store_messages
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());