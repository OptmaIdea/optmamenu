create or replace function public.get_product_stock_movements(
  p_store_id uuid,
  p_product_id uuid
)
returns table(
  id uuid,
  store_id uuid,
  product_id uuid,
  product_name text,
  order_id uuid,
  quantity integer,
  type text,
  reason text,
  user_id uuid,
  previous_stock integer,
  new_stock integer,
  created_at timestamptz,
  created_at_display text,
  affects_physical boolean,
  source text,
  source_id uuid,
  reason_code text,
  metadata jsonb,
  created_by uuid,
  supplier_id uuid,
  location_id uuid,
  location_code text,
  location_name text,
  from_location_id uuid,
  from_location_code text,
  from_location_name text,
  to_location_id uuid,
  to_location_code text,
  to_location_name text,
  transfer_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_store_id is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id, 'stock.view')
    or public.user_has_store_permission_v2(p_store_id, 'stock.adjust')
    or public.user_has_store_permission_v2(p_store_id, 'stock.transfer')
    or public.user_has_store_permission_v2(p_store_id, 'products.view')
  ) then
    raise exception 'Acesso negado à loja informada.';
  end if;

  return query
  with events as (
    select
      sm.id,
      sm.store_id,
      sm.product_id,
      p.name::text as product_name,
      sm.order_id,
      sm.quantity,
      sm.type::text as type,
      sm.reason,
      sm.user_id,
      sm.previous_stock,
      sm.new_stock,
      sm.created_at,
      public.format_datetime_sao_paulo(sm.created_at) as created_at_display,
      sm.affects_physical,
      sm.source,
      sm.source_id,
      sm.reason_code,
      sm.metadata,
      sm.created_by,
      sm.supplier_id,
      sm.location_id,
      loc.code::text as location_code,
      loc.name::text as location_name,
      sm.from_location_id,
      from_loc.code::text as from_location_code,
      from_loc.name::text as from_location_name,
      sm.to_location_id,
      to_loc.code::text as to_location_code,
      to_loc.name::text as to_location_name,
      sm.transfer_id
    from public.stock_movements sm
    join public.products p on p.id = sm.product_id and p.store_id = sm.store_id
    left join public.stock_locations loc on loc.id = sm.location_id and loc.store_id = sm.store_id
    left join public.stock_locations from_loc on from_loc.id = sm.from_location_id and from_loc.store_id = sm.store_id
    left join public.stock_locations to_loc on to_loc.id = sm.to_location_id and to_loc.store_id = sm.store_id
    where sm.store_id = p_store_id and sm.product_id = p_product_id

    union all

    select
      occurrence.id,
      occurrence.store_id,
      p.id as product_id,
      p.name::text as product_name,
      occurrence.order_id,
      greatest(0, coalesce(nullif(item.value->>'shortage_quantity', '')::numeric, nullif(item.value->>'shortage', '')::numeric, 0))::integer as quantity,
      'exit'::text as type,
      concat(
        'Divergência de estoque — ',
        case occurrence.status
          when 'open' then 'aberta'
          when 'under_review' then 'em análise'
          when 'waiting_stock_count' then 'aguardando contagem'
          when 'resolved' then 'resolvida'
          when 'cancelled' then 'cancelada'
          else occurrence.status
        end,
        case when occurrence.resolution_type is not null then concat('. Resolução: ', occurrence.resolution_type) else '' end,
        case when occurrence.resolution_notes is not null and btrim(occurrence.resolution_notes) <> '' then concat('. Observação: ', occurrence.resolution_notes) else '' end
      )::text as reason,
      coalesce(occurrence.resolved_by, occurrence.created_by) as user_id,
      coalesce(nullif(item.value->>'available_quantity', '')::numeric, nullif(item.value->>'available', '')::numeric, 0)::integer as previous_stock,
      coalesce(nullif(item.value->>'available_quantity', '')::numeric, nullif(item.value->>'available', '')::numeric, 0)::integer as new_stock,
      coalesce(occurrence.resolved_at, occurrence.updated_at, occurrence.created_at) as created_at,
      public.format_datetime_sao_paulo(coalesce(occurrence.resolved_at, occurrence.updated_at, occurrence.created_at)) as created_at_display,
      false as affects_physical,
      'stock_discrepancy'::text as source,
      occurrence.id as source_id,
      ('stock_discrepancy_' || occurrence.status)::text as reason_code,
      jsonb_build_object(
        'order_code', orders.order_code,
        'customer_name', orders.customer_name,
        'discrepancy_status', occurrence.status,
        'resolution_type', occurrence.resolution_type,
        'resolution_notes', occurrence.resolution_notes,
        'requested_quantity', coalesce(nullif(item.value->>'requested_quantity', '')::numeric, nullif(item.value->>'requested', '')::numeric, 0),
        'available_quantity', coalesce(nullif(item.value->>'available_quantity', '')::numeric, nullif(item.value->>'available', '')::numeric, 0),
        'shortage_quantity', coalesce(nullif(item.value->>'shortage_quantity', '')::numeric, nullif(item.value->>'shortage', '')::numeric, 0),
        'operational_event', 'sale_stock_discrepancy'
      ) as metadata,
      occurrence.created_by,
      null::uuid as supplier_id,
      occurrence.location_id,
      loc.code::text as location_code,
      loc.name::text as location_name,
      null::uuid as from_location_id,
      null::text as from_location_code,
      null::text as from_location_name,
      null::uuid as to_location_id,
      null::text as to_location_code,
      null::text as to_location_name,
      null::uuid as transfer_id
    from public.stock_discrepancy_occurrences occurrence
    cross join lateral jsonb_array_elements(coalesce(occurrence.items, '[]'::jsonb)) item(value)
    join public.products p
      on p.id = nullif(item.value->>'product_id', '')::uuid
     and p.store_id = occurrence.store_id
    left join public.orders orders on orders.id = occurrence.order_id and orders.store_id = occurrence.store_id
    left join public.stock_locations loc on loc.id = occurrence.location_id and loc.store_id = occurrence.store_id
    where occurrence.store_id = p_store_id
      and p.id = p_product_id
  )
  select * from events
  order by created_at desc
  limit 500;
end;
$$;

revoke all on function public.get_product_stock_movements(uuid, uuid) from public;
grant execute on function public.get_product_stock_movements(uuid, uuid) to authenticated;
