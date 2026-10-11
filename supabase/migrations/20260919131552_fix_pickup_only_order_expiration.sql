-- OptmaMenu
-- Corrige a expiração automática para atingir somente retiradas não pagas.
-- Delivery não expira pelo timer de reserva de estoque.

create or replace function public.cancel_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count integer := 0;
begin
  with candidates as materialized (
    select o.id
    from public.orders o
    where o.status::text in ('reserved', 'confirmed', 'ready')
      and coalesce(o.payment_status, 'pending') <> 'paid'
      and coalesce(o.fulfillment_type::text, 'pickup') = 'pickup'
      and exists (
        select 1
        from public.stock_reservations sr
        where sr.order_id = o.id
          and sr.store_id = o.store_id
          and sr.status = 'active'
          and coalesce(o.cancellation_grace_until, o.expires_at, sr.expires_at) <= now()
      )
    for update skip locked
  ), cancelled_orders as (
    update public.orders o
       set status = 'cancelled',
           commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'cancelled_reason', 'reservation_expired',
                  'cancelled_at', now(),
                  'cancelled_by', 'scheduled_cleanup'
                )
      from candidates c
     where o.id = c.id
       and o.status::text in ('reserved', 'confirmed', 'ready')
       and coalesce(o.payment_status, 'pending') <> 'paid'
       and coalesce(o.fulfillment_type::text, 'pickup') = 'pickup'
    returning o.id
  )
  update public.stock_reservations sr
     set status = 'cancelled',
         cancelled_at = now(),
         metadata = coalesce(sr.metadata, '{}'::jsonb)
           || jsonb_build_object(
                'cancelled_at', now(),
                'cancel_reason', 'reservation_expired',
                'cancelled_by', 'scheduled_cleanup'
              )
   where sr.order_id in (select id from cancelled_orders)
     and sr.status = 'active';

  get diagnostics v_count = row_count;
  perform public.reconcile_inventory_reservations(null, true);
  return v_count;
end;
$function$;

create or replace function public.cancel_expired_reservations(p_store_id uuid)
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
    select distinct o.id
    from public.orders o
    join public.stock_reservations sr
      on sr.order_id = o.id
     and sr.store_id = o.store_id
     and sr.status = 'active'
    where o.store_id = p_store_id
      and o.status::text in ('reserved', 'confirmed', 'ready')
      and coalesce(o.payment_status, 'pending') <> 'paid'
      and coalesce(o.fulfillment_type::text, 'pickup') = 'pickup'
      and coalesce(o.cancellation_grace_until, o.expires_at, sr.expires_at) < now()
  loop
    update public.orders
       set status = 'cancelled',
           commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'cancelled_reason', 'reservation_expired',
                  'cancelled_at', now()
                )
     where id = v_order_id
       and store_id = p_store_id
       and status::text in ('reserved', 'confirmed', 'ready')
       and coalesce(payment_status, 'pending') <> 'paid'
       and coalesce(fulfillment_type::text, 'pickup') = 'pickup';

    if found then
      update public.stock_reservations
         set status = 'cancelled',
             cancelled_at = now(),
             metadata = coalesce(metadata, '{}'::jsonb)
               || jsonb_build_object(
                    'cancelled_at', now(),
                    'cancel_reason', 'reservation_expired'
                  )
       where order_id = v_order_id
         and store_id = p_store_id
         and status = 'active';

      v_count := v_count + 1;
    end if;
  end loop;

  perform public.reconcile_inventory_reservations(p_store_id, true);
  return v_count;
end;
$function$;
