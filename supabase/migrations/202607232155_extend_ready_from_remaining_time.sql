create or replace function public.admin_mark_public_order_ready_safe(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order record;
  v_ready_hold_minutes integer;
  v_grace_minutes integer;
  v_current_expires_at timestamptz;
  v_new_expires_at timestamptz;
  v_grace_until timestamptz;
begin
  select o.id,o.store_id,o.order_code,o.status,o.public_order_token,o.payment_status,
         coalesce((s.config->>'ready_hold_minutes')::integer,5) as ready_hold_minutes,
         coalesce((s.config->>'expiration_grace_minutes')::integer,5) as grace_minutes
    into v_order
  from public.orders o
  join public.stores s on s.id=o.store_id
  where o.id=p_order_id;

  if v_order.id is null then
    return jsonb_build_object('ok',false,'error','order_not_found');
  end if;

  if auth.uid() is null or not public.is_store_member(v_order.store_id) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if v_order.status::text not in ('confirmed','ready') then
    return jsonb_build_object('ok',false,'error','invalid_status','current_status',v_order.status::text);
  end if;

  v_ready_hold_minutes := greatest(0,coalesce(v_order.ready_hold_minutes,5));
  v_grace_minutes := greatest(0,coalesce(v_order.grace_minutes,5));

  select max(sr.expires_at)
    into v_current_expires_at
  from public.stock_reservations sr
  where sr.order_id=v_order.id and sr.status='active';

  v_new_expires_at := greatest(coalesce(v_current_expires_at,now()),now())
                      + make_interval(mins => v_ready_hold_minutes);
  v_grace_until := v_new_expires_at + make_interval(mins => v_grace_minutes);

  update public.stock_reservations
     set expires_at=v_new_expires_at,
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
           'ready_extended_at',now(),
           'ready_hold_minutes',v_ready_hold_minutes,
           'ready_extended_by',auth.uid()
         )
   where order_id=v_order.id and status='active';

  update public.orders
     set status='ready',
         ready_at=coalesce(ready_at,now()),
         available_until=v_new_expires_at,
         cancellation_grace_until=v_grace_until,
         commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
           'ready_at',now(),
           'ready_by',auth.uid(),
           'ready_hold_minutes',v_ready_hold_minutes,
           'ready_extended_from_remaining',true
         )
   where id=v_order.id;

  return jsonb_build_object(
    'ok',true,
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'status','ready',
    'ready_at',now(),
    'expires_at',v_new_expires_at,
    'cancellation_grace_until',v_grace_until,
    'ready_hold_minutes',v_ready_hold_minutes,
    'payment_status',coalesce(v_order.payment_status::text,'pending')
  );
end;
$function$;

grant execute on function public.admin_mark_public_order_ready_safe(uuid) to authenticated;
