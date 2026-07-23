create or replace function public.enrich_stock_movement_order_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_order_id uuid;
begin
  v_order_id := coalesce(
    new.order_id,
    case
      when new.source in ('order', 'public_order', 'direct_sale') then new.source_id
      else null
    end
  );

  if v_order_id is null then
    return new;
  end if;

  select o.*
  into v_order
  from public.orders o
  where o.id = v_order_id
    and o.store_id = new.store_id
  limit 1;

  if v_order.id is null then
    return new;
  end if;

  new.order_id := coalesce(new.order_id, v_order.id);
  new.metadata := coalesce(new.metadata, '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'customer_name', nullif(trim(v_order.customer_name), ''),
        'customer_id', v_order.customer_id,
        'order_code', nullif(trim(v_order.order_code), ''),
        'sales_channel', nullif(trim(v_order.sales_channel), ''),
        'fulfillment_type', nullif(trim(v_order.fulfillment_type), '')
      )
    );

  return new;
end;
$$;

drop trigger if exists trg_enrich_stock_movement_order_metadata on public.stock_movements;

create trigger trg_enrich_stock_movement_order_metadata
before insert or update of order_id, source_id, source, metadata
on public.stock_movements
for each row
execute function public.enrich_stock_movement_order_metadata();

update public.stock_movements sm
set
  order_id = coalesce(sm.order_id, o.id),
  metadata = coalesce(sm.metadata, '{}'::jsonb)
    || jsonb_strip_nulls(
      jsonb_build_object(
        'customer_name', nullif(trim(o.customer_name), ''),
        'customer_id', o.customer_id,
        'order_code', nullif(trim(o.order_code), ''),
        'sales_channel', nullif(trim(o.sales_channel), ''),
        'fulfillment_type', nullif(trim(o.fulfillment_type), '')
      )
    )
from public.orders o
where o.store_id = sm.store_id
  and o.id = coalesce(
    sm.order_id,
    case
      when sm.source in ('order', 'public_order', 'direct_sale') then sm.source_id
      else null
    end
  );

notify pgrst, 'reload schema';
