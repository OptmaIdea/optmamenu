-- =========================================================
-- E1) CATÁLOGO (categories, products)
-- =========================================================

drop policy if exists "categories_store_read" on public.categories;
create policy "categories_store_read"
on public.categories
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
  and active = true
);

drop policy if exists "products_store_read" on public.products;
create policy "products_store_read"
on public.products
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
  and active = true
);

-- Owner CRUD
drop policy if exists "categories_owner_all" on public.categories;
create policy "categories_owner_all"
on public.categories
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all"
on public.products
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());