-- =========================================================
-- E2) PROMOTIONS (sem store_id: policy por vínculo com category/product)
-- =========================================================

drop policy if exists "promotions_store_read" on public.promotions;
create policy "promotions_store_read"
on public.promotions
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and active = true
  and (
    (category_id is not null and exists (
      select 1 from public.categories c
      where c.id = promotions.category_id
        and c.store_id = public.app_current_store_id()
    ))
    or
    (product_id is not null and exists (
      select 1 from public.products p
      where p.id = promotions.product_id
        and p.store_id = public.app_current_store_id()
    ))
  )
);

drop policy if exists "promotions_owner_all" on public.promotions;
create policy "promotions_owner_all"
on public.promotions
for all
to authenticated
using (
  (
    category_id is not null and exists (
      select 1 from public.categories c
      where c.id = promotions.category_id
        and c.store_id = public.app_current_store_id()
    )
  )
  or
  (
    product_id is not null and exists (
      select 1 from public.products p
      where p.id = promotions.product_id
        and p.store_id = public.app_current_store_id()
    )
  )
)
with check (
  (
    category_id is not null and exists (
      select 1 from public.categories c
      where c.id = promotions.category_id
        and c.store_id = public.app_current_store_id()
    )
  )
  or
  (
    product_id is not null and exists (
      select 1 from public.products p
      where p.id = promotions.product_id
        and p.store_id = public.app_current_store_id()
    )
  )
);