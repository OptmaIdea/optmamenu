create or replace function public.get_customer_self_orders_safe(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_limit integer := least(greatest(coalesce(p_limit,100),1),200);
  v_orders jsonb;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', q.id,
        'order_code', q.order_code,
        'status', q.status,
        'payment_status', q.payment_status,
        'fulfillment_type', q.fulfillment_type,
        'total', q.total,
        'created_at', q.created_at,
        'status_changed_at', q.status_changed_at,
        'order_items', q.order_items
      )
      order by q.status_changed_at desc nulls last, q.created_at desc
    ),
    '[]'::jsonb
  )
  into v_orders
  from (
    select
      o.id,
      o.order_code,
      o.status::text as status,
      o.payment_status::text as payment_status,
      o.fulfillment_type::text as fulfillment_type,
      o.total,
      o.created_at,
      coalesce(o.status_changed_at,o.updated_at,o.created_at) as status_changed_at,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', oi.id,
            'product_id', oi.product_id,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'product', jsonb_build_object(
              'id', oi.product_id,
              'name', coalesce(
                nullif(oi.product_snapshot->>'name',''),
                nullif(p.name,''),
                'Produto indisponível'
              )
            )
          )
          order by oi.id
        )
        from public.order_items oi
        left join public.products p
          on p.id = oi.product_id
         and p.store_id = v_store_id
        where oi.order_id = o.id
          and oi.store_id = v_store_id
      ), '[]'::jsonb) as order_items
    from public.orders o
    where o.customer_id = v_customer_id
      and o.store_id = v_store_id
    order by coalesce(o.status_changed_at,o.updated_at,o.created_at) desc, o.created_at desc
    limit v_limit
  ) q;

  return jsonb_build_object('ok',true,'orders',v_orders);
end;
$function$;

revoke all on function public.get_customer_self_orders_safe(integer) from public,anon;
grant execute on function public.get_customer_self_orders_safe(integer) to authenticated,service_role;
