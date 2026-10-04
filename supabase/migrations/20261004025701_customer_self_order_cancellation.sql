
create or replace function public.cancel_customer_self_order_safe(
  p_order_id uuid,
  p_reason text default 'Cancelado pelo cliente'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_order record;
  v_reservation record;
  v_released_count integer := 0;
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Cancelado pelo cliente');
begin
  if public.app_current_role() <> 'customer'
     or v_customer_id is null
     or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  select
    o.id,
    o.store_id,
    o.customer_id,
    o.order_code,
    o.status::text as status,
    o.payment_status
  into v_order
  from public.orders o
  where o.id = p_order_id
    and o.store_id = v_store_id
    and o.customer_id = v_customer_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  if v_order.status <> 'reserved' then
    return jsonb_build_object(
      'ok', false,
      'error', 'order_no_longer_cancellable',
      'status', v_order.status
    );
  end if;

  if coalesce(v_order.payment_status, 'pending') in ('paid', 'refund_pending', 'partially_refunded', 'refunded') then
    return jsonb_build_object(
      'ok', false,
      'error', 'paid_order_requires_refund',
      'payment_status', v_order.payment_status
    );
  end if;

  if exists (
    select 1
    from public.online_payment_intents i
    where i.order_id = v_order.id
      and i.store_id = v_order.store_id
      and i.status in ('authorized', 'paid')
  ) then
    return jsonb_build_object(
      'ok', false,
      'error', 'payment_already_authorized'
    );
  end if;

  for v_reservation in
    select
      sr.id,
      sr.store_id,
      sr.product_id,
      sr.location_id,
      sr.quantity
    from public.stock_reservations sr
    where sr.order_id = v_order.id
      and sr.status = 'active'
    for update
  loop
    update public.inventory_location_balances ilb
       set reserved = greatest(0, ilb.reserved - v_reservation.quantity),
           updated_at = now()
     where ilb.store_id = v_reservation.store_id
       and ilb.product_id = v_reservation.product_id
       and ilb.location_id = v_reservation.location_id;

    update public.inventory_balances ib
       set reserved = greatest(0, ib.reserved - v_reservation.quantity),
           updated_at = now()
     where ib.store_id = v_reservation.store_id
       and ib.product_id = v_reservation.product_id;

    update public.stock_reservations
       set status = 'cancelled',
           cancelled_at = now(),
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
             'cancelled_at', now(),
             'cancel_reason', v_reason,
             'cancel_source', 'customer_self_service',
             'customer_id', v_customer_id
           )
     where id = v_reservation.id;

    v_released_count := v_released_count + 1;
  end loop;

  update public.online_payment_intents
     set status = 'cancelled',
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'cancelled_at', now(),
           'cancel_source', 'customer_self_service',
           'cancel_reason', v_reason
         ),
         updated_at = now()
   where order_id = v_order.id
     and store_id = v_order.store_id
     and status in ('created', 'pending');

  update public.orders
     set status = 'cancelled',
         status_changed_at = now(),
         updated_at = now(),
         expires_at = null,
         cancellation_grace_until = null,
         commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object(
           'cancelled_reason', 'customer_cancelled',
           'cancelled_at', now(),
           'cancel_source', 'customer_self_service',
           'customer_id', v_customer_id
         ),
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
           'cancel_reason', v_reason,
           'cancel_source', 'customer_self_service'
         )
   where id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order.id,
    'order_code', v_order.order_code,
    'status', 'cancelled',
    'reservations_released', v_released_count
  );
end;
$function$;

revoke all on function public.cancel_customer_self_order_safe(uuid,text) from public;
revoke all on function public.cancel_customer_self_order_safe(uuid,text) from anon;
revoke all on function public.cancel_customer_self_order_safe(uuid,text) from authenticated;
grant execute on function public.cancel_customer_self_order_safe(uuid,text) to authenticated;
grant execute on function public.cancel_customer_self_order_safe(uuid,text) to service_role;
