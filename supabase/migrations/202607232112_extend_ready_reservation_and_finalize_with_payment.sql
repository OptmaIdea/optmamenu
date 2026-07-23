-- Fase comercial: prazo adicional ao marcar pronto, finalização com pagamento real e monitor persistente.

create or replace function public.admin_mark_public_order_ready_safe(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order record;
  v_extension_minutes integer := 10;
  v_grace_minutes integer := 5;
  v_new_expires_at timestamptz;
begin
  select o.id,o.store_id,o.order_code,o.status,o.public_order_token,s.config
  into v_order
  from public.orders o
  join public.stores s on s.id=o.store_id
  where o.id=p_order_id;

  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  if auth.uid() is null or not public.is_store_member(v_order.store_id) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if v_order.status::text not in ('confirmed','ready') then return jsonb_build_object('ok',false,'error','invalid_status','current_status',v_order.status::text); end if;

  v_extension_minutes := greatest(1, least(coalesce((v_order.config->>'extension_minutes')::integer,10),120));
  v_grace_minutes := greatest(0, least(coalesce((v_order.config->>'expiration_grace_minutes')::integer,5),120));

  update public.stock_reservations sr
  set expires_at = greatest(sr.expires_at, now()) + make_interval(mins => v_extension_minutes),
      metadata = coalesce(sr.metadata,'{}'::jsonb) || jsonb_build_object(
        'ready_extended_at', now(),
        'ready_extended_by', auth.uid(),
        'ready_extension_minutes', v_extension_minutes
      )
  where sr.order_id=v_order.id and sr.status='active';

  select max(sr.expires_at) into v_new_expires_at
  from public.stock_reservations sr
  where sr.order_id=v_order.id and sr.status='active';

  update public.orders
  set status='ready',
      ready_at=coalesce(ready_at,now()),
      expires_at=coalesce(v_new_expires_at, expires_at),
      available_until=coalesce(v_new_expires_at, available_until),
      cancellation_grace_until=case when v_new_expires_at is not null then v_new_expires_at + make_interval(mins => v_grace_minutes) else cancellation_grace_until end,
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
        'ready_at',now(),
        'ready_by',auth.uid(),
        'ready_extension_minutes',v_extension_minutes,
        'available_until',v_new_expires_at
      )
  where id=v_order.id;

  return jsonb_build_object(
    'ok',true,
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'status','ready',
    'ready_at',now(),
    'extension_minutes',v_extension_minutes,
    'expires_at',v_new_expires_at,
    'grace_minutes',v_grace_minutes
  );
end;
$function$;

grant execute on function public.admin_mark_public_order_ready_safe(uuid) to authenticated;

create or replace function public.admin_finalize_public_order_with_payment(
  p_order_id uuid,
  p_payment_method_code text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order record;
  v_method_code text;
  v_legacy_method public.payment_method;
  v_result jsonb;
begin
  select id,store_id,order_code,status into v_order from public.orders where id=p_order_id;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  if auth.uid() is null or not public.is_store_member(v_order.store_id) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if v_order.status::text not in ('confirmed','ready') then return jsonb_build_object('ok',false,'error','invalid_status','current_status',v_order.status::text); end if;

  v_method_code := lower(trim(coalesce(p_payment_method_code,'')));
  if v_method_code not in ('pix','cash','debit_card','credit_card') then
    return jsonb_build_object('ok',false,'error','invalid_payment_method');
  end if;

  v_legacy_method := case
    when v_method_code='pix' then 'pix'::public.payment_method
    when v_method_code='cash' then 'cash'::public.payment_method
    else 'card'::public.payment_method
  end;

  update public.orders
  set payment_method_code=v_method_code,
      payment_method=v_legacy_method,
      payment_status='paid',
      payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
        'confirmed_at',now(),
        'confirmed_by',auth.uid(),
        'confirmed_in_finalization',true,
        'payment_method_code',v_method_code
      )
  where id=v_order.id;

  if v_order.status::text='ready' then
    update public.orders set status='confirmed' where id=v_order.id;
  end if;

  v_result := public.complete_confirmed_public_order(v_order.id);
  return v_result || jsonb_build_object('payment_method_code',v_method_code,'payment_status','paid');
end;
$function$;

grant execute on function public.admin_finalize_public_order_with_payment(uuid,text) to authenticated;

create or replace function public.get_order_monitor_pending_orders(
  p_store_id uuid,
  p_since timestamptz,
  p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_orders jsonb;
begin
  if p_store_id is null then return jsonb_build_object('ok',false,'error','missing_store_id','orders','[]'::jsonb); end if;
  if auth.uid() is null or not public.is_store_member(p_store_id) then return jsonb_build_object('ok',false,'error','access_denied','orders','[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,
    'created_at',q.created_at,
    'status',q.status,
    'customer_phone',q.customer_phone,
    'customer_name',q.customer_name,
    'metadata',q.metadata,
    'order_code',q.order_code,
    'total',q.total
  ) order by q.created_at asc),'[]'::jsonb)
  into v_orders
  from (
    select o.id,o.created_at,o.status::text as status,o.customer_phone,o.customer_name,
           coalesce(o.metadata,'{}'::jsonb) as metadata,o.order_code,o.total
    from public.orders o
    where o.store_id=p_store_id and o.status='reserved'::public.order_status
    order by o.created_at asc
    limit greatest(1,least(coalesce(p_limit,20),50))
  ) q;

  return jsonb_build_object('ok',true,'orders',v_orders);
end;
$function$;

grant execute on function public.get_order_monitor_pending_orders(uuid,timestamptz,integer) to authenticated;

notify pgrst, 'reload schema';
