create or replace function public.get_pos_bootstrap_v2(
  p_store_id uuid,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_result jsonb;
  v_location_id uuid;
  v_products jsonb;
begin
  v_result := public.get_pos_bootstrap(p_store_id, p_location_id);
  v_location_id := nullif(v_result->>'selected_location_id', '')::uuid;

  select coalesce(jsonb_agg(
    product
    || jsonb_build_object(
      'on_hand_stock', coalesce(ilb.on_hand, 0),
      'reserved_stock', coalesce(ilb.reserved, 0),
      'available_stock', greatest(coalesce(ilb.on_hand, 0) - coalesce(ilb.reserved, 0), 0)
    )
    order by product->>'name'
  ), '[]'::jsonb)
  into v_products
  from jsonb_array_elements(coalesce(v_result->'products', '[]'::jsonb)) product
  left join public.inventory_location_balances ilb
    on ilb.store_id = p_store_id
   and ilb.location_id = v_location_id
   and ilb.product_id = (product->>'id')::uuid
   and ilb.variant_id is null;

  return jsonb_set(v_result, '{products}', v_products, true);
end;
$function$;

grant execute on function public.get_pos_bootstrap_v2(uuid, uuid) to authenticated;

create or replace function public.create_pos_sale_safe(
  p_store_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_customer_phone text default null,
  p_payment_method_code text default 'pending',
  p_notes text default null,
  p_location_id uuid default null,
  p_sales_channel text default 'in_person',
  p_fulfillment_type text default 'in_person',
  p_create_customer_if_missing boolean default false,
  p_marketing_consent boolean default false,
  p_loyalty_opt_in boolean default false,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_conflict record;
  v_result jsonb;
  v_order_id uuid;
  v_allow_exception boolean := coalesce((p_metadata->>'allow_stock_exception')::boolean, false);
begin
  if p_location_id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'sales_location_not_configured',
      'message', 'Selecione um local de venda antes de concluir.'
    );
  end if;

  if v_allow_exception then
    select
      pr.id as product_id,
      pr.name as product_name,
      greatest(coalesce(ilb.on_hand, 0), 0) as on_hand,
      greatest(coalesce(ilb.reserved, 0), 0) as reserved,
      greatest(coalesce((item->>'quantity')::integer, 0), 0) as requested
    into v_conflict
    from jsonb_array_elements(p_items) item
    join public.products pr
      on pr.id = nullif(item->>'product_id', '')::uuid
     and pr.store_id = p_store_id
    left join public.inventory_location_balances ilb
      on ilb.store_id = p_store_id
     and ilb.location_id = p_location_id
     and ilb.product_id = pr.id
     and ilb.variant_id is null
    where greatest(coalesce((item->>'quantity')::integer, 0), 0) > 0
      and greatest(coalesce(ilb.on_hand, 0) - greatest(coalesce((item->>'quantity')::integer, 0), 0), 0)
          < greatest(coalesce(ilb.reserved, 0), 0)
    order by pr.name
    limit 1;

    if v_conflict.product_id is not null then
      return jsonb_build_object(
        'ok', false,
        'error', 'reserved_stock_conflict',
        'message', v_conflict.product_name || ' possui ' || v_conflict.reserved::text ||
          ' unidade(s) comprometida(s) com pedidos ativos. A venda solicitada reduziria o físico abaixo do reservado.',
        'product_id', v_conflict.product_id,
        'product_name', v_conflict.product_name,
        'on_hand', v_conflict.on_hand,
        'reserved', v_conflict.reserved,
        'available', greatest(v_conflict.on_hand - v_conflict.reserved, 0),
        'requested', v_conflict.requested
      );
    end if;
  end if;

  v_result := public.create_admin_direct_sale_order_safe(
    p_store_id,
    p_items,
    p_customer_id,
    p_customer_name,
    p_customer_phone,
    p_payment_method_code,
    p_notes,
    p_location_id,
    p_sales_channel,
    p_fulfillment_type,
    p_create_customer_if_missing,
    p_marketing_consent,
    p_loyalty_opt_in,
    p_metadata
  );

  if coalesce((v_result->>'ok')::boolean, false)
     and coalesce(p_payment_method_code, 'pending') <> 'pending' then
    v_order_id := nullif(v_result->'order'->>'id', '')::uuid;

    update public.orders
    set
      payment_status = 'paid',
      payment_metadata = coalesce(payment_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'paid_at', coalesce(payment_metadata->>'paid_at', now()::text),
          'paid_by', auth.uid(),
          'paid_by_source', 'create_pos_sale_safe'
        )
    where id = v_order_id
      and store_id = p_store_id;
  end if;

  return v_result;
end;
$function$;

grant execute on function public.create_pos_sale_safe(
  uuid, jsonb, uuid, text, text, text, text, uuid, text, text, boolean, boolean, boolean, jsonb
) to authenticated;

update public.orders
set
  payment_status = 'paid',
  payment_metadata = coalesce(payment_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'backfilled_at', now(),
      'backfilled_reason', 'completed_direct_sale_with_non_pending_payment'
    )
where status = 'completed'
  and sales_channel in ('direct', 'in_person')
  and coalesce(payment_method_code, 'pending') <> 'pending'
  and coalesce(payment_status, 'pending') <> 'paid';
