create or replace function public.get_admin_orders_safe(
  p_store_id uuid,
  p_status text default 'all'::text,
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_orders jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'orders', '[]'::jsonb);
  end if;

  if auth.uid() is null or not public.is_store_member(p_store_id) then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'orders', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc), '[]'::jsonb)
  into v_orders
  from (
    select
      o.*,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'product_id', oi.product_id,
            'product_snapshot', oi.product_snapshot,
            'commercial_metadata', oi.commercial_metadata,
            'product', jsonb_build_object(
              'name', coalesce(p.name, oi.product_snapshot->>'name'),
              'price', p.price
            )
          )
          order by oi.id
        )
        from public.order_items oi
        left join public.products p on p.id = oi.product_id
        where oi.order_id = o.id
      ), '[]'::jsonb) as order_items,
      coalesce((
        select jsonb_agg(to_jsonb(sr) order by sr.expires_at)
        from public.stock_reservations sr
        where sr.order_id = o.id
      ), '[]'::jsonb) as stock_reservations
    from public.orders o
    where o.store_id = p_store_id
      and (
        p_status is null
        or p_status = 'all'
        or (
          p_status = 'expired_auto'
          and o.status::text = 'cancelled'
          and o.commercial_metadata->>'cancelled_reason' = 'reservation_expired'
        )
        or (p_status <> 'expired_auto' and o.status::text = p_status)
      )
    order by o.created_at desc
    limit greatest(1, least(coalesce(p_limit, 200), 500))
  ) q;

  return jsonb_build_object('ok', true, 'orders', v_orders);
end;
$function$;

revoke all on function public.get_admin_orders_safe(uuid, text, integer) from public;
grant execute on function public.get_admin_orders_safe(uuid, text, integer) to authenticated;
