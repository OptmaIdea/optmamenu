create or replace function public.get_public_catalog_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_store_id uuid;
  v_catalog_enabled boolean;
  v_categories jsonb;
begin
  select s.id, s.public_catalog_enabled
  into v_store_id, v_catalog_enabled
  from public.stores s
  where s.slug = lower(trim(p_slug))
    and s.public_store_enabled = true
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  if coalesce(v_catalog_enabled, false) = false then
    return jsonb_build_object('ok', true, 'catalog_enabled', false, 'categories', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(category_payload order by category_sort_order, category_name), '[]'::jsonb)
  into v_categories
  from (
    select
      c.sort_order as category_sort_order,
      c.name as category_name,
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'description', c.description,
        'image_url', c.image_url,
        'sort_order', c.sort_order,
        'active', c.active,
        'price_logic_type', coalesce(c.price_logic_type, 'standard'),
        'price_rules', coalesce(c.price_rules, '[]'::jsonb),
        'pricing_strategy', coalesce(c.pricing_strategy, jsonb_build_object('volume_scope', 'combined')),
        'loyalty_eligible', coalesce(c.loyalty_eligible, true),
        'loyalty_multiplier', coalesce(c.loyalty_multiplier, 1.0),
        'products', products_payload.products
      ) as category_payload
    from public.categories c
    cross join lateral (
      select
        coalesce(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'category_id', p.category_id,
            'name', p.name,
            'description', p.description,
            'price', p.price,
            'active', p.active,
            'images', coalesce(to_jsonb(p.images), '[]'::jsonb),
            'image_url', case when array_length(p.images, 1) > 0 then p.images[1] else null end,
            'sort_order', p.sort_order,
            'use_category_pricing', coalesce(p.use_category_pricing, false),
            'price_logic_type', coalesce(p.price_logic_type, 'standard'),
            'price_rules', coalesce(p.price_rules, '[]'::jsonb),
            'stock_quantity', coalesce(p.stock_quantity, 0),
            'featured', false,
            'sales_count', 0,
            'rating_avg', 5.0,
            'review_count', 0,
            'category_loyalty_eligible', coalesce(c.loyalty_eligible, true),
            'category_loyalty_multiplier', coalesce(c.loyalty_multiplier, 1.0)
          ) order by p.sort_order, p.name
        ), '[]'::jsonb) as products,
        count(*) as products_count
      from public.products p
      where p.store_id = v_store_id
        and p.category_id = c.id
        and p.active = true
        and coalesce(p.discontinued, false) = false
        and coalesce(p.is_discontinued, false) = false
    ) products_payload
    where c.store_id = v_store_id
      and c.active = true
      and products_payload.products_count > 0
  ) q;

  return jsonb_build_object('ok', true, 'catalog_enabled', true, 'categories', v_categories);
end;
$function$;

grant execute on function public.get_public_catalog_by_slug(text) to anon, authenticated;
notify pgrst, 'reload schema';
