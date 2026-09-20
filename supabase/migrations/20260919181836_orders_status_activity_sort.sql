alter table public.orders
  add column if not exists status_changed_at timestamptz;

update public.orders
set status_changed_at = coalesce(
  case when status::text='completed' then completed_at end,
  case when status::text='ready' then ready_at end,
  case when status::text='confirmed' then confirmed_at end,
  updated_at,
  created_at,
  now()
)
where status_changed_at is null;

alter table public.orders
  alter column status_changed_at set default now();

create or replace function public.trg_orders_status_changed_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op='INSERT' then
    new.status_changed_at := coalesce(new.status_changed_at,new.created_at,now());
  elsif new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_orders_status_changed_at on public.orders;
create trigger trg_orders_status_changed_at
before insert or update of status
on public.orders
for each row
execute function public.trg_orders_status_changed_at();

create or replace function public.get_admin_orders_safe(
  p_store_id uuid,
  p_status text default 'all',
  p_limit integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_orders jsonb;
begin
  if p_store_id is null then
    return jsonb_build_object('ok',false,'error','missing_store_id','orders','[]'::jsonb);
  end if;

  if auth.uid() is null or not public.is_store_member(p_store_id) then
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
$function$;

revoke all on function public.get_admin_orders_safe(uuid,text,integer) from public;
grant execute on function public.get_admin_orders_safe(uuid,text,integer) to authenticated;
