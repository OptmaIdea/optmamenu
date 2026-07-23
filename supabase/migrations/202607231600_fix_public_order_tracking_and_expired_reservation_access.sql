create or replace function public.get_public_order_by_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order record;
  v_items jsonb;
begin
  if p_token is null or length(trim(p_token)) < 24 then
    return jsonb_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select
    o.id,
    o.order_code,
    o.status::text as status,
    o.customer_name,
    o.subtotal,
    o.delivery_fee,
    o.total,
    o.sales_channel,
    o.fulfillment_type,
    o.table_code,
    o.created_at,
    o.confirmed_at,
    o.completed_at,
    o.expires_at,
    o.delivery_metadata,
    o.payment_metadata,
    s.name as store_name,
    s.slug as store_slug,
    s.logo_url as store_logo_url
  into v_order
  from public.orders o
  join public.stores s on s.id = o.store_id
  where o.public_order_token = trim(p_token)
  limit 1;

  if v_order.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', coalesce(oi.product_snapshot->>'name', p.name, 'Produto'),
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'discount', coalesce(oi.discount, 0),
        'line_total', (oi.quantity * oi.unit_price) - coalesce(oi.discount, 0)
      )
      order by oi.id
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  left join public.products p on p.id = oi.product_id
  where oi.order_id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'store', jsonb_build_object(
      'name', v_order.store_name,
      'slug', v_order.store_slug,
      'logo_url', v_order.store_logo_url
    ),
    'order', jsonb_build_object(
      'order_code', v_order.order_code,
      'status', v_order.status,
      'customer_name', v_order.customer_name,
      'subtotal', v_order.subtotal,
      'delivery_fee', v_order.delivery_fee,
      'total', v_order.total,
      'sales_channel', v_order.sales_channel,
      'fulfillment_type', v_order.fulfillment_type,
      'delivery_method_name', v_order.delivery_metadata->>'name',
      'payment_method_name', v_order.payment_metadata->>'name',
      'table_code', v_order.table_code,
      'created_at', v_order.created_at,
      'confirmed_at', v_order.confirmed_at,
      'completed_at', v_order.completed_at,
      'expires_at', v_order.expires_at,
      'items', v_items
    )
  );
end;
$function$;

drop function if exists public.cancel_expired_reservations(uuid);

create function public.cancel_expired_reservations(p_store_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_order_id uuid;
  v_count integer := 0;
begin
  if p_store_id is null then
    raise exception 'missing_store_id';
  end if;

  if auth.uid() is not null and not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id, 'orders.manage')
  ) then
    raise exception 'access_denied';
  end if;

  for v_order_id in
    select distinct sr.order_id
    from public.stock_reservations sr
    join public.orders o on o.id = sr.order_id and o.store_id = sr.store_id
    where sr.store_id = p_store_id
      and sr.expires_at < now()
      and o.status = 'reserved'
  loop
    update public.orders
    set status = 'cancelled'
    where id = v_order_id
      and store_id = p_store_id
      and status = 'reserved';

    if found then
      delete from public.stock_reservations
      where order_id = v_order_id
        and store_id = p_store_id;
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$function$;

revoke all on function public.cancel_expired_reservations(uuid) from public, anon;
grant execute on function public.cancel_expired_reservations(uuid) to authenticated, service_role;