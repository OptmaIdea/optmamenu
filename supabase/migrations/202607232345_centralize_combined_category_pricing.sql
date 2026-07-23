-- Motor autoritativo de precificação para catálogo, venda direta e futuro PDV.

create or replace function public.calculate_store_cart_pricing(
  p_store_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_cart');
  end if;

  with requested as (
    select
      (entry->>'product_id')::uuid as product_id,
      sum(greatest(coalesce((entry->>'quantity')::integer, 0), 0))::integer as quantity
    from jsonb_array_elements(p_items) entry
    group by (entry->>'product_id')::uuid
  ),
  base as (
    select
      r.product_id,
      r.quantity,
      p.name,
      p.category_id,
      p.price::numeric as base_price,
      coalesce(p.use_category_pricing, false) as use_category_pricing,
      p.price_logic_type as product_price_logic_type,
      coalesce(p.price_rules, '[]'::jsonb) as product_price_rules,
      c.name as category_name,
      c.price_logic_type as category_price_logic_type,
      coalesce(c.price_rules, '[]'::jsonb) as category_price_rules
    from requested r
    join public.products p
      on p.id = r.product_id
     and p.store_id = p_store_id
     and p.active = true
     and coalesce(p.discontinued, false) = false
     and coalesce(p.is_discontinued, false) = false
    left join public.categories c
      on c.id = p.category_id
     and c.store_id = p_store_id
     and c.active = true
    where r.quantity > 0
  ),
  category_totals as (
    select category_id, sum(quantity)::integer as combined_quantity
    from base
    where category_id is not null
      and use_category_pricing = true
      and category_price_logic_type = 'category_volume'
    group by category_id
  ),
  priced as (
    select
      b.*,
      coalesce(ct.combined_quantity, b.quantity) as pricing_quantity,
      case
        when b.use_category_pricing = true and b.category_price_logic_type = 'category_volume'
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(b.category_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= coalesce(ct.combined_quantity, b.quantity)
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        ), b.base_price)
        when b.use_category_pricing = true and b.category_price_logic_type = 'standard'
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(b.category_price_rules) rule
          order by coalesce((rule->>'min')::integer, 0) asc
          limit 1
        ), b.base_price)
        when b.use_category_pricing = false
         and b.product_price_logic_type in ('product_volume', 'volume', 'quantity_volume')
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(b.product_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= b.quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        ), b.base_price)
        when b.use_category_pricing = false and b.product_price_logic_type = 'standard'
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(b.product_price_rules) rule
          order by coalesce((rule->>'min')::integer, 0) asc
          limit 1
        ), b.base_price)
        else b.base_price
      end::numeric as unit_price,
      case
        when b.use_category_pricing = true and b.category_price_logic_type = 'category_volume'
          then 'category_combined_volume'
        when b.use_category_pricing = true and b.category_price_logic_type = 'standard'
          then 'category_standard'
        when b.use_category_pricing = false
         and b.product_price_logic_type in ('product_volume', 'volume', 'quantity_volume')
          then 'product_volume'
        when b.use_category_pricing = false and b.product_price_logic_type = 'standard'
          then 'product_standard'
        else 'product_base_price'
      end as pricing_source
    from base b
    left join category_totals ct on ct.category_id = b.category_id
  ),
  final_items as (
    select
      p.*,
      round((p.base_price - p.unit_price) * p.quantity, 2) as discount_total,
      round(p.unit_price * p.quantity, 2) as line_total,
      case
        when p.pricing_source = 'category_combined_volume' then (
          select jsonb_build_object(
            'min', coalesce((rule->>'min')::integer, 0),
            'price', (rule->>'price')::numeric
          )
          from jsonb_array_elements(p.category_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= p.pricing_quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        )
        when p.pricing_source = 'product_volume' then (
          select jsonb_build_object(
            'min', coalesce((rule->>'min')::integer, 0),
            'price', (rule->>'price')::numeric
          )
          from jsonb_array_elements(p.product_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= p.quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        )
        else null
      end as applied_tier
    from priced p
  )
  select jsonb_build_object(
    'ok', true,
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'product_name', name,
        'category_id', category_id,
        'category_name', category_name,
        'quantity', quantity,
        'pricing_quantity', pricing_quantity,
        'base_price', base_price,
        'unit_price', unit_price,
        'discount_total', discount_total,
        'line_total', line_total,
        'pricing_source', pricing_source,
        'applied_tier', applied_tier
      ) order by name
    ), '[]'::jsonb),
    'subtotal', coalesce(sum(line_total), 0),
    'base_subtotal', coalesce(sum(base_price * quantity), 0),
    'total_discount', coalesce(sum(discount_total), 0)
  )
  into v_result
  from final_items;

  if jsonb_array_length(coalesce(v_result->'items', '[]'::jsonb)) <> jsonb_array_length(p_items) then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_unavailable_product');
  end if;

  return v_result;
end;
$$;

create or replace function public.quote_public_order_by_slug(
  p_slug text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store_id uuid;
begin
  select id into v_store_id
  from public.stores
  where slug = lower(trim(p_slug))
    and public_store_enabled = true
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  return public.calculate_store_cart_pricing(v_store_id, p_items);
end;
$$;

create or replace function public.create_public_order_by_slug_v2(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_type text,
  p_sales_channel text,
  p_items jsonb,
  p_delivery_address jsonb default '{}'::jsonb,
  p_table_code text default null,
  p_notes text default null,
  p_payment_method_code text default 'pending',
  p_delivery_method_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_pricing jsonb;
  v_store_id uuid;
  v_order_id uuid;
  v_delivery_fee numeric := 0;
  v_item jsonb;
begin
  select id into v_store_id
  from public.stores
  where slug = lower(trim(p_slug))
    and public_store_enabled = true
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  v_pricing := public.calculate_store_cart_pricing(v_store_id, p_items);
  if coalesce((v_pricing->>'ok')::boolean, false) = false then
    return v_pricing;
  end if;

  v_result := public.create_public_order_by_slug(
    p_slug,
    p_customer_name,
    p_customer_phone,
    p_fulfillment_type,
    p_sales_channel,
    p_items,
    p_delivery_address,
    p_table_code,
    p_notes,
    p_payment_method_code,
    p_delivery_method_code
  );

  if coalesce((v_result->>'ok')::boolean, false) = false then
    return v_result;
  end if;

  v_order_id := (v_result->'order'->>'id')::uuid;

  select coalesce(delivery_fee, 0)
  into v_delivery_fee
  from public.orders
  where id = v_order_id;

  for v_item in select value from jsonb_array_elements(v_pricing->'items')
  loop
    update public.order_items
    set
      unit_price = (v_item->>'unit_price')::numeric,
      discount = 0,
      product_snapshot = coalesce(product_snapshot, '{}'::jsonb) || jsonb_build_object(
        'base_price', (v_item->>'base_price')::numeric,
        'applied_unit_price', (v_item->>'unit_price')::numeric,
        'pricing_source', v_item->>'pricing_source',
        'category_id', v_item->>'category_id',
        'category_name', v_item->>'category_name'
      ),
      commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object(
        'pricing_source', v_item->>'pricing_source',
        'pricing_quantity', (v_item->>'pricing_quantity')::integer,
        'base_price', (v_item->>'base_price')::numeric,
        'unit_price', (v_item->>'unit_price')::numeric,
        'discount_total', (v_item->>'discount_total')::numeric,
        'line_total', (v_item->>'line_total')::numeric,
        'applied_tier', v_item->'applied_tier'
      )
    where order_id = v_order_id
      and product_id = (v_item->>'product_id')::uuid;
  end loop;

  update public.orders
  set
    subtotal = (v_pricing->>'subtotal')::numeric,
    total = (v_pricing->>'subtotal')::numeric + v_delivery_fee,
    commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object(
      'pricing_engine', 'calculate_store_cart_pricing_v1',
      'base_subtotal', (v_pricing->>'base_subtotal')::numeric,
      'total_discount', (v_pricing->>'total_discount')::numeric,
      'pricing_snapshot', v_pricing
    )
  where id = v_order_id;

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_result, '{order,subtotal}', to_jsonb((v_pricing->>'subtotal')::numeric), true),
      '{order,total}', to_jsonb((v_pricing->>'subtotal')::numeric + v_delivery_fee), true
    ),
    '{pricing}', v_pricing, true
  );
end;
$$;

grant execute on function public.calculate_store_cart_pricing(uuid, jsonb) to authenticated;
grant execute on function public.quote_public_order_by_slug(text, jsonb) to anon, authenticated;
grant execute on function public.create_public_order_by_slug_v2(text,text,text,text,text,jsonb,jsonb,text,text,text,text) to anon, authenticated;

update public.categories
set pricing_strategy = coalesce(pricing_strategy, '{}'::jsonb) || jsonb_build_object(
  'mode', case when price_logic_type = 'category_volume' then 'category_volume' else coalesce(price_logic_type, 'standard') end,
  'scope', case when price_logic_type = 'category_volume' then 'combined_category' else 'category' end,
  'version', 1
)
where price_logic_type is not null;
