-- Escopo da regra de atacado por categoria e políticas seguras do bucket.

drop policy if exists "Category Images Store Insert" on storage.objects;
drop policy if exists "Category Images Store Update" on storage.objects;
drop policy if exists "Category Images Store Delete" on storage.objects;

create policy "Category Images Store Insert"
on storage.objects for insert
to public
with check (
  bucket_id = 'category-images'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.app_current_store_id()::text
);

create policy "Category Images Store Update"
on storage.objects for update
to public
using (
  bucket_id = 'category-images'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.app_current_store_id()::text
)
with check (
  bucket_id = 'category-images'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.app_current_store_id()::text
);

create policy "Category Images Store Delete"
on storage.objects for delete
to public
using (
  bucket_id = 'category-images'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = public.app_current_store_id()::text
);

update public.categories
set pricing_strategy = jsonb_set(
  coalesce(pricing_strategy, '{}'::jsonb),
  '{volume_scope}',
  '"combined"'::jsonb,
  true
)
where price_logic_type = 'category_volume'
  and not (coalesce(pricing_strategy, '{}'::jsonb) ? 'volume_scope');

-- A definição vigente de calculate_store_cart_pricing foi atualizada no banco
-- para interpretar pricing_strategy.volume_scope como:
-- combined: soma os produtos participantes da categoria;
-- per_product: calcula a faixa pela quantidade de cada produto.
