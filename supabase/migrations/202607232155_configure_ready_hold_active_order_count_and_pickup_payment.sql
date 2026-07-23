update public.stores
set config = coalesce(config, '{}'::jsonb)
  || jsonb_build_object(
    'ready_hold_minutes', coalesce((config->>'ready_hold_minutes')::int, 5),
    'expiration_grace_minutes', coalesce((config->>'expiration_grace_minutes')::int, 5),
    'payment_timing', coalesce(config->'payment_timing', jsonb_build_object(
      'pay_now_enabled', false,
      'pay_on_pickup_enabled', true
    ))
  )
where slug = 'gelinharessjn';

update public.store_payment_methods
set name = 'Pagar na retirada',
    public_enabled = true,
    active = true
where code = 'pending'
  and store_id = (select id from public.stores where slug = 'gelinharessjn' limit 1);

create or replace function public.get_active_order_count(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'count', 0);
  end if;

  if auth.uid() is null or not public.is_store_member(p_store_id) then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'count', 0);
  end if;

  select count(*)::integer into v_count
  from public.orders
  where store_id = p_store_id
    and status::text in ('reserved', 'confirmed', 'ready');

  return jsonb_build_object('ok', true, 'count', v_count);
end;
$$;

grant execute on function public.get_active_order_count(uuid) to authenticated;
