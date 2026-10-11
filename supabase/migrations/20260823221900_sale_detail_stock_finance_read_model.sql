create or replace function public.get_sale_detail_safe(
  p_store_id uuid,
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_order jsonb;
  v_items jsonb := '[]'::jsonb;
  v_stock_movements jsonb := '[]'::jsonb;
  v_reservations jsonb := '[]'::jsonb;
  v_discrepancies jsonb := '[]'::jsonb;
  v_financial_entries jsonb := '[]'::jsonb;
  v_route_audit jsonb := '[]'::jsonb;
  v_can_view_stock boolean := false;
  v_can_view_finance boolean := false;
begin
  if p_store_id is null or p_order_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_parameters');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'orders.view')
      or public.user_has_store_permission_v2(p_store_id, 'orders.manage')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;

    v_can_view_stock := public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'stock.view')
      or public.user_has_store_permission_v2(p_store_id, 'products.view');

    v_can_view_finance := public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'cashbook.view')
      or public.user_has_store_permission_v2(p_store_id, 'financial.accounts.view')
      or public.user_has_store_permission_v2(p_store_id, 'financial.manage');
  else
    v_can_view_stock := true;
    v_can_view_finance := true;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_code', o.order_code,
    'status', o.status,
    'created_at', o.created_at,
    'confirmed_at', o.confirmed_at,
    'ready_at', o.ready_at,
    'completed_at', o.completed_at,
    'customer_id', o.customer_id,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'customer_snapshot', o.customer_snapshot,
    'sales_channel', o.sales_channel,
    'fulfillment_type', o.fulfillment_type,
    'delivery_method_code', o.delivery_method_code,
    'delivery_address', o.delivery_address,
    'delivery_address_snapshot', o.delivery_address_snapshot,
    'delivery_fee', o.delivery_fee,
    'table_code', o.table_code,
    'notes', o.notes,
    'subtotal', o.subtotal,
    'total', o.total,
    'payment_method', o.payment_method,
    'payment_method_code', o.payment_method_code,
    'payment_method_name', pm.name,
    'payment_method_base_code', coalesce(pm.base_code, pm.code),
    'payment_status', o.payment_status,
    'proof_url', o.proof_url,
    'payment_metadata', o.payment_metadata,
    'commercial_metadata', o.commercial_metadata,
    'metadata', o.metadata
  )
  into v_order
  from public.orders o
  left join public.store_payment_methods pm
    on pm.store_id = o.store_id and pm.code = o.payment_method_code
  where o.id = p_order_id and o.store_id = p_store_id;

  if v_order is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', oi.id,
    'product_id', oi.product_id,
    'product_name', coalesce(nullif(oi.product_snapshot->>'name', ''), p.name, 'Produto'),
    'quantity', oi.quantity,
    'unit_price', oi.unit_price,
    'discount', oi.discount,
    'line_total', (oi.quantity * oi.unit_price - coalesce(oi.discount, 0))::numeric,
    'product_snapshot', oi.product_snapshot,
    'commercial_metadata', oi.commercial_metadata
  ) order by oi.id), '[]'::jsonb)
  into v_items
  from public.order_items oi
  left join public.products p on p.id = oi.product_id and p.store_id = p_store_id
  where oi.order_id = p_order_id and oi.store_id = p_store_id;

  if v_can_view_stock then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', sm.id,
      'product_id', sm.product_id,
      'product_name', coalesce(p.name, 'Produto'),
      'quantity', sm.quantity,
      'type', sm.type,
      'reason', sm.reason,
      'reason_code', sm.reason_code,
      'source', sm.source,
      'source_id', sm.source_id,
      'affects_physical', sm.affects_physical,
      'previous_stock', sm.previous_stock,
      'new_stock', sm.new_stock,
      'location_id', sm.location_id,
      'location_name', sl.name,
      'from_location_id', sm.from_location_id,
      'from_location_name', fl.name,
      'to_location_id', sm.to_location_id,
      'to_location_name', tl.name,
      'created_at', sm.created_at,
      'metadata', sm.metadata
    ) order by sm.created_at, sm.id), '[]'::jsonb)
    into v_stock_movements
    from public.stock_movements sm
    left join public.products p on p.id = sm.product_id and p.store_id = p_store_id
    left join public.stock_locations sl on sl.id = sm.location_id and sl.store_id = p_store_id
    left join public.stock_locations fl on fl.id = sm.from_location_id and fl.store_id = p_store_id
    left join public.stock_locations tl on tl.id = sm.to_location_id and tl.store_id = p_store_id
    where sm.order_id = p_order_id and sm.store_id = p_store_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', sr.id,
      'product_id', sr.product_id,
      'product_name', coalesce(p.name, 'Produto'),
      'quantity', sr.quantity,
      'status', sr.status,
      'sales_channel', sr.sales_channel,
      'location_id', sr.location_id,
      'location_name', sl.name,
      'created_at', sr.created_at,
      'expires_at', sr.expires_at,
      'consumed_at', sr.consumed_at,
      'cancelled_at', sr.cancelled_at,
      'metadata', sr.metadata
    ) order by sr.created_at, sr.id), '[]'::jsonb)
    into v_reservations
    from public.stock_reservations sr
    left join public.products p on p.id = sr.product_id and p.store_id = p_store_id
    left join public.stock_locations sl on sl.id = sr.location_id and sl.store_id = p_store_id
    where sr.order_id = p_order_id and sr.store_id = p_store_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', sd.id,
      'occurrence_type', sd.occurrence_type,
      'status', sd.status,
      'location_id', sd.location_id,
      'location_name', sl.name,
      'items', sd.items,
      'opening_notes', sd.opening_notes,
      'resolution_type', sd.resolution_type,
      'resolution_notes', sd.resolution_notes,
      'resolved_at', sd.resolved_at,
      'created_at', sd.created_at,
      'metadata', sd.metadata
    ) order by sd.created_at, sd.id), '[]'::jsonb)
    into v_discrepancies
    from public.stock_discrepancy_occurrences sd
    left join public.stock_locations sl on sl.id = sd.location_id and sl.store_id = p_store_id
    where sd.order_id = p_order_id and sd.store_id = p_store_id;
  end if;

  if v_can_view_finance then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', ce.id,
      'entry_code', ce.entry_code,
      'entry_date', ce.entry_date,
      'occurred_at', ce.occurred_at,
      'type', ce.type,
      'direction', ce.direction,
      'amount', ce.amount,
      'description', ce.description,
      'notes', ce.notes,
      'payment_method', ce.payment_method,
      'payment_method_code', ce.payment_method_code,
      'payment_method_name', pm.name,
      'status', ce.status,
      'affects_balance', ce.affects_balance,
      'affects_financial_result', ce.affects_financial_result,
      'is_transfer', ce.is_transfer,
      'source', ce.source,
      'source_financial_account_id', ce.source_financial_account_id,
      'source_financial_account_name', sfa.name,
      'destination_financial_account_id', ce.destination_financial_account_id,
      'destination_financial_account_name', dfa.name,
      'metadata', ce.metadata
    ) order by ce.occurred_at, ce.id), '[]'::jsonb)
    into v_financial_entries
    from public.cashbook_entries ce
    left join public.store_financial_accounts sfa on sfa.id = ce.source_financial_account_id and sfa.store_id = p_store_id
    left join public.store_financial_accounts dfa on dfa.id = ce.destination_financial_account_id and dfa.store_id = p_store_id
    left join public.store_payment_methods pm on pm.store_id = p_store_id and pm.code = ce.payment_method_code
    where ce.order_id = p_order_id and ce.store_id = p_store_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id,
      'cashbook_entry_id', a.cashbook_entry_id,
      'old_payment_method_code', a.old_payment_method_code,
      'new_payment_method_code', a.new_payment_method_code,
      'old_source_financial_account_name', osa.name,
      'old_destination_financial_account_name', oda.name,
      'new_source_financial_account_name', nsa.name,
      'new_destination_financial_account_name', nda.name,
      'reason', a.reason,
      'created_at', a.created_at,
      'metadata', a.metadata
    ) order by a.created_at, a.id), '[]'::jsonb)
    into v_route_audit
    from public.cashbook_payment_route_audit a
    left join public.store_financial_accounts osa on osa.id = a.old_source_financial_account_id and osa.store_id = p_store_id
    left join public.store_financial_accounts oda on oda.id = a.old_destination_financial_account_id and oda.store_id = p_store_id
    left join public.store_financial_accounts nsa on nsa.id = a.new_source_financial_account_id and nsa.store_id = p_store_id
    left join public.store_financial_accounts nda on nda.id = a.new_destination_financial_account_id and nda.store_id = p_store_id
    where a.order_id = p_order_id and a.store_id = p_store_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'order', v_order,
    'items', v_items,
    'can_view_stock', v_can_view_stock,
    'stock', jsonb_build_object(
      'movements', v_stock_movements,
      'reservations', v_reservations,
      'discrepancies', v_discrepancies
    ),
    'can_view_finance', v_can_view_finance,
    'finance', jsonb_build_object(
      'entries', v_financial_entries,
      'route_audit', v_route_audit
    )
  );
end;
$function$;

revoke all on function public.get_sale_detail_safe(uuid, uuid) from public, anon;
grant execute on function public.get_sale_detail_safe(uuid, uuid) to authenticated, service_role;
