-- Incidente: badge e listagem de pedidos / papéis personalizados (14/10/2026).
-- O vínculo ativo não é suficiente: respeitar orders.view e o acesso comercial.
-- A owner permanece autorizada; negações individuais e do papel são respeitadas.
-- Status 'out_for_delivery' pertence aos pedidos atuais e precisa entrar no badge.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_active_order_count(p_store_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_count integer := 0;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'count', 0);
  end if;

  if auth.uid() is null
    or not public.is_store_member(p_store_id)
    or not (
      public.app_is_store_owner(p_store_id)
      or (
        public.user_has_store_permission_v2(p_store_id, 'commercial.view')
        and public.user_has_store_permission_v2(p_store_id, 'orders.view')
      )
    )
  then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'count', 0);
  end if;

  select count(*)::integer into v_count
  from public.orders
  where store_id = p_store_id
    and status::text in ('reserved', 'confirmed', 'ready', 'out_for_delivery');

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$function$

CREATE OR REPLACE FUNCTION public.get_admin_orders_safe(p_store_id uuid, p_status text DEFAULT 'all'::text, p_limit integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_orders jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok',false,'error','missing_store_id','orders','[]'::jsonb);
  end if;

  if auth.uid() is null
    or not public.is_store_member(p_store_id)
    or not (
      public.app_is_store_owner(p_store_id)
      or (
        public.user_has_store_permission_v2(p_store_id, 'commercial.view')
        and public.user_has_store_permission_v2(p_store_id, 'orders.view')
      )
    )
  then
    return jsonb_build_object('ok',false,'error','access_denied','orders','[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(to_jsonb(q) order by q.status_changed_at desc nulls last,q.created_at desc),
    '[]'::jsonb
  )
  into v_orders
  from (
    select
      o.*,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',oi.id,
            'quantity',oi.quantity,
            'unit_price',oi.unit_price,
            'product_id',oi.product_id,
            'product_snapshot',oi.product_snapshot,
            'commercial_metadata',oi.commercial_metadata,
            'product',jsonb_build_object(
              'name',coalesce(p.name,oi.product_snapshot->>'name'),
              'price',p.price
            )
          )
          order by oi.id
        )
        from public.order_items oi
        left join public.products p on p.id=oi.product_id
        where oi.order_id=o.id
      ),'[]'::jsonb) as order_items,
      case
        when coalesce(o.payment_status,'pending')='paid'
          or coalesce(o.fulfillment_type,'pickup')='delivery'
          or public.get_order_payment_timing(o.payment_metadata,o.payment_status::text)<>'pay_on_fulfillment'
        then '[]'::jsonb
        else coalesce((
          select jsonb_agg(to_jsonb(sr) order by sr.expires_at)
          from public.stock_reservations sr
          where sr.order_id=o.id
        ),'[]'::jsonb)
      end as stock_reservations
    from public.orders o
    where o.store_id=p_store_id
      and (
        p_status is null
        or p_status='all'
        or (
          p_status='expired_auto'
          and o.status::text='cancelled'
          and o.commercial_metadata->>'cancelled_reason'='reservation_expired'
        )
        or (
          p_status<>'expired_auto'
          and o.status::text=p_status
        )
      )
    order by o.status_changed_at desc nulls last,o.created_at desc
    limit greatest(1,least(coalesce(p_limit,200),500))
  ) q;

  return jsonb_build_object('ok',true,'orders',v_orders);
end;
$function$

COMMIT;
