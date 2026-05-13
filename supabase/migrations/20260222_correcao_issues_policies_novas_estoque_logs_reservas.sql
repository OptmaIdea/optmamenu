-- =========================================================
-- E6) STOCK / HISTORY / RESERVATIONS / SECURITY LOGS (owner only)
-- =========================================================

drop policy if exists "stock_movements_owner_all" on public.stock_movements;
create policy "stock_movements_owner_all"
on public.stock_movements
for all
to authenticated
using (
  exists (select 1 from public.products p
          where p.id = stock_movements.product_id
            and p.store_id = public.app_current_store_id())
)
with check (
  exists (select 1 from public.products p
          where p.id = stock_movements.product_id
            and p.store_id = public.app_current_store_id())
);

drop policy if exists "inventory_history_owner_all" on public.inventory_history;
create policy "inventory_history_owner_all"
on public.inventory_history
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "stock_reservations_owner_all" on public.stock_reservations;
create policy "stock_reservations_owner_all"
on public.stock_reservations
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "store_security_logs_owner_all" on public.store_security_logs;
create policy "store_security_logs_owner_all"
on public.store_security_logs
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());