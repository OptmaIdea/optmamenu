-- Carrinho multi-dispositivo, nomes históricos de produtos e reservas de delivery sem expiração.

create or replace function public.clear_customer_self_cart_draft_safe()
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_updated_at timestamptz;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  insert into public.customer_cart_drafts(store_id,customer_id,cart,updated_at)
  values(v_store_id,v_customer_id,jsonb_build_object('schemaVersion',2,'items','[]'::jsonb,'cleared',true,'clearedAt',clock_timestamp()),clock_timestamp())
  on conflict (store_id,customer_id)
  do update set cart=excluded.cart, updated_at=clock_timestamp()
  returning updated_at into v_updated_at;
  return jsonb_build_object('ok',true,'updated_at',v_updated_at);
end;
$function$;

revoke all on function public.clear_customer_self_cart_draft_safe() from public, anon;
grant execute on function public.clear_customer_self_cart_draft_safe() to authenticated, service_role;

create or replace function public.get_customer_self_orders_safe(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path to 'public'
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
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'order_code',q.order_code,'status',q.status,'payment_status',q.payment_status,
    'fulfillment_type',q.fulfillment_type,'total',q.total,'created_at',q.created_at,'order_items',q.order_items
  ) order by q.created_at desc),'[]'::jsonb)
  into v_orders
  from (
    select o.id,o.order_code,o.status::text status,o.payment_status::text payment_status,
           o.fulfillment_type::text fulfillment_type,o.total,o.created_at,
           coalesce((
             select jsonb_agg(jsonb_build_object(
               'id',oi.id,'product_id',oi.product_id,'quantity',oi.quantity,'unit_price',oi.unit_price,
               'product',jsonb_build_object('id',oi.product_id,'name',coalesce(nullif(oi.product_snapshot->>'name',''),nullif(p.name,''),'Produto indisponível'))
             ) order by oi.id)
             from public.order_items oi
             left join public.products p on p.id=oi.product_id and p.store_id=v_store_id
             where oi.order_id=o.id and oi.store_id=v_store_id
           ),'[]'::jsonb) order_items
    from public.orders o
    where o.customer_id=v_customer_id and o.store_id=v_store_id
    order by o.created_at desc limit v_limit
  ) q;
  return jsonb_build_object('ok',true,'orders',v_orders);
end;
$function$;

revoke all on function public.get_customer_self_orders_safe(integer) from public, anon;
grant execute on function public.get_customer_self_orders_safe(integer) to authenticated, service_role;

create or replace function public.enforce_delivery_stock_reservation_lifetime()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare v_fulfillment text;
begin
  select o.fulfillment_type::text into v_fulfillment from public.orders o where o.id=new.order_id limit 1;
  if v_fulfillment='delivery' then
    new.expires_at := 'infinity'::timestamptz;
    new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
      'timer_suspended_reason','delivery_order',
      'timer_suspended_at',coalesce(new.metadata->>'timer_suspended_at',clock_timestamp()::text)
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_delivery_stock_reservation_lifetime on public.stock_reservations;
create trigger trg_enforce_delivery_stock_reservation_lifetime
before insert or update of order_id,expires_at on public.stock_reservations
for each row execute function public.enforce_delivery_stock_reservation_lifetime();

update public.stock_reservations sr
set expires_at='infinity'::timestamptz,
    metadata=coalesce(sr.metadata,'{}'::jsonb)||jsonb_build_object(
      'timer_suspended_reason','delivery_order',
      'timer_suspended_at',coalesce(sr.metadata->>'timer_suspended_at',clock_timestamp()::text)
    )
from public.orders o
where o.id=sr.order_id and o.fulfillment_type::text='delivery' and sr.status='active'
  and sr.expires_at <> 'infinity'::timestamptz;
