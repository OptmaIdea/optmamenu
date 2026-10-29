-- Corrige duas regras de negócio da loja pública:
-- 1) timer de reserva só existe para retirada com pagamento posterior;
-- 2) confirmação manual de PIX usa a rota configurada por fulfillment/timing/método,
--    não a conta do provedor Asaas de forma fixa.

create or replace function public.resolve_order_payment_destination_account(
  p_store_id uuid,
  p_scope text,
  p_fulfillment_type text,
  p_payment_timing text,
  p_payment_method_code text,
  p_override_account_id uuid default null::uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_account_id uuid;
  v_method text := lower(coalesce(nullif(trim(p_payment_method_code), ''), '*'));
  v_scope text := coalesce(nullif(trim(p_scope), ''), 'public_store');
  v_fulfillment text := lower(coalesce(nullif(trim(p_fulfillment_type), ''), 'any'));
  v_timing text := lower(coalesce(nullif(trim(p_payment_timing), ''), 'any'));
begin
  if v_timing in ('pay_now', 'advance', 'prepaid', 'online') then
    v_timing := 'advance';
  elsif v_timing in ('pay_on_receipt', 'on_delivery', 'on_pickup', 'pay_later', 'posterior') then
    v_timing := 'pay_on_fulfillment';
  end if;

  if v_method in ('pix_asaas') then
    v_method := 'asaas_pix';
  end if;

  if p_override_account_id is not null then
    select a.id into v_account_id
    from public.store_financial_accounts a
    where a.id = p_override_account_id
      and a.store_id = p_store_id
      and a.active = true;
    if v_account_id is not null then
      return v_account_id;
    end if;
  end if;

  select r.destination_financial_account_id into v_account_id
  from public.store_order_payment_account_routes r
  join public.store_financial_accounts a on a.id = r.destination_financial_account_id
  where r.store_id = p_store_id
    and r.scope in (v_scope, 'any')
    and r.fulfillment_type in (v_fulfillment, 'any')
    and r.payment_timing in (v_timing, 'any')
    and r.payment_method_code in (v_method, '*')
    and r.active = true
    and a.active = true
  order by
    case when r.scope = v_scope then 0 else 1 end,
    case when r.fulfillment_type = v_fulfillment then 0 else 1 end,
    case when r.payment_timing = v_timing then 0 else 1 end,
    case when r.payment_method_code = v_method then 0 else 1 end,
    r.sort_order,
    r.created_at desc
  limit 1;

  if v_account_id is not null then
    return v_account_id;
  end if;

  select a.id into v_account_id
  from public.store_financial_accounts a
  where a.store_id = p_store_id
    and a.active = true
    and a.is_sales_clearing_default = true
  order by a.sort_order, a.name
  limit 1;

  if v_account_id is not null then
    return v_account_id;
  end if;

  select a.id into v_account_id
  from public.store_financial_accounts a
  where a.store_id = p_store_id
    and a.active = true
    and (
      (v_method in ('cash','dinheiro') and a.account_type = 'cash_drawer')
      or (v_method in ('pix','pix_manual_qr','asaas_pix','pix_asaas') and a.account_type = 'pix_wallet')
      or (v_method in ('card','credit_card','debit_card') and a.account_type in ('card_receivable','card_acquirer'))
    )
  order by a.is_default desc, a.sort_order, a.name
  limit 1;

  return v_account_id;
end;
$$;

create or replace function public.cancel_expired_reservations(p_store_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_order_id uuid;
  v_count integer := 0;
begin
  if p_store_id is null then raise exception 'missing_store_id'; end if;
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
      and public.get_order_payment_timing(o.payment_metadata, o.payment_status::text) = 'pay_on_fulfillment'
      and coalesce(o.cancellation_grace_until, o.expires_at, sr.expires_at) < now()
  loop
    update public.orders
    set status = 'cancelled',
        commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object(
          'cancelled_reason', 'reservation_expired',
          'cancelled_at', now()
        )
    where id = v_order_id
      and store_id = p_store_id
      and status::text in ('reserved', 'confirmed', 'ready')
      and coalesce(payment_status, 'pending') <> 'paid'
      and coalesce(fulfillment_type::text, 'pickup') = 'pickup'
      and public.get_order_payment_timing(payment_metadata, payment_status::text) = 'pay_on_fulfillment';

    if found then
      update public.stock_reservations
      set status = 'cancelled',
          cancelled_at = now(),
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
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
$$;

create or replace function public.get_admin_orders_safe(p_store_id uuid, p_status text default 'all'::text, p_limit integer default 200)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare v_orders jsonb;
begin
 if p_store_id is null then return jsonb_build_object('ok',false,'error','missing_store_id','orders','[]'::jsonb); end if;
 if auth.uid() is null or not public.is_store_member(p_store_id) then return jsonb_build_object('ok',false,'error','access_denied','orders','[]'::jsonb); end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.created_at desc),'[]'::jsonb) into v_orders from (
  select o.*,
   coalesce((select jsonb_agg(jsonb_build_object('id',oi.id,'quantity',oi.quantity,'unit_price',oi.unit_price,'product_id',oi.product_id,'product_snapshot',oi.product_snapshot,'commercial_metadata',oi.commercial_metadata,'product',jsonb_build_object('name',coalesce(p.name,oi.product_snapshot->>'name'),'price',p.price)) order by oi.id) from public.order_items oi left join public.products p on p.id=oi.product_id where oi.order_id=o.id),'[]'::jsonb) as order_items,
   case
    when coalesce(o.payment_status,'pending')='paid'
      or coalesce(o.fulfillment_type,'pickup')='delivery'
      or public.get_order_payment_timing(o.payment_metadata, o.payment_status::text) <> 'pay_on_fulfillment'
    then '[]'::jsonb
    else coalesce((select jsonb_agg(to_jsonb(sr) order by sr.expires_at) from public.stock_reservations sr where sr.order_id=o.id),'[]'::jsonb)
   end as stock_reservations
  from public.orders o where o.store_id=p_store_id and (p_status is null or p_status='all' or (p_status='expired_auto' and o.status::text='cancelled' and o.commercial_metadata->>'cancelled_reason'='reservation_expired') or (p_status<>'expired_auto' and o.status::text=p_status))
  order by o.created_at desc limit greatest(1,least(coalesce(p_limit,200),500))
 ) q;
 return jsonb_build_object('ok',true,'orders',v_orders);
end;
$function$;

-- A função confirm_order_external_pix_payment_safe foi atualizada em HML para usar
-- resolve_order_payment_destination_account. Mantemos a versão completa no histórico
-- operacional desta frente porque a função é extensa e será consolidada antes do merge final.

update public.orders o
   set expires_at = null,
       available_until = null,
       cancellation_grace_until = null,
       payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb) || jsonb_build_object('timer_suspended_reason', 'advance_payment_waiting_confirmation'),
       commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object('timer_suspended_reason', 'advance_payment_waiting_confirmation')
 where o.status::text in ('reserved','confirmed','ready')
   and coalesce(o.payment_status, 'pending') <> 'paid'
   and coalesce(o.fulfillment_type::text, 'pickup') = 'pickup'
   and public.get_order_payment_timing(o.payment_metadata, o.payment_status::text) = 'advance';

update public.stock_reservations sr
   set expires_at = 'infinity'::timestamptz,
       metadata = coalesce(sr.metadata, '{}'::jsonb) || jsonb_build_object('timer_suspended_reason', 'advance_payment_waiting_confirmation', 'timer_suspended_at', now())
  from public.orders o
 where sr.order_id = o.id
   and sr.store_id = o.store_id
   and sr.status = 'active'
   and o.status::text in ('reserved','confirmed','ready')
   and coalesce(o.payment_status, 'pending') <> 'paid'
   and coalesce(o.fulfillment_type::text, 'pickup') = 'pickup'
   and public.get_order_payment_timing(o.payment_metadata, o.payment_status::text) = 'advance';
