create or replace function public.create_cashbook_entry_from_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order record;
  v_existing_id uuid;
  v_entry_id uuid;
  v_entry_code text;
  v_payment_name text;
  v_config_affects_cashbook boolean := true;
  v_payment_confirmed boolean := false;
  v_entry_status text;
  v_affects_balance boolean;
  v_origin_detail text;
  v_payment_method_code text;
  v_payment_timing text;
  v_destination_account_id uuid;
  v_destination_account record;
begin
  select
    o.id,
    o.store_id,
    o.order_code,
    o.customer_id,
    o.customer_name,
    o.total,
    o.status,
    o.payment_method,
    o.payment_method_code,
    o.payment_metadata,
    o.payment_status,
    o.sales_channel,
    o.fulfillment_type,
    o.table_code,
    o.completed_at
  into v_order
  from public.orders o
  where o.id = p_order_id
  limit 1;

  if v_order.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  if v_order.status::text <> 'completed' then
    return jsonb_build_object('ok', false, 'error', 'order_not_completed', 'status', v_order.status);
  end if;

  select id
  into v_existing_id
  from public.cashbook_entries
  where order_id = v_order.id
    and source = 'order'
    and type = 'sale'
    and status <> 'cancelled'
  order by created_at desc
  limit 1;

  if v_existing_id is not null then
    return jsonb_build_object('ok', true, 'already_exists', true, 'entry_id', v_existing_id);
  end if;

  v_payment_method_code := lower(coalesce(nullif(v_order.payment_method_code, ''), v_order.payment_method::text, 'pending'));
  v_payment_timing := public.get_order_payment_timing(coalesce(v_order.payment_metadata, '{}'::jsonb), v_order.payment_status);
  v_payment_name := public.format_order_cashbook_payment_label(v_order.fulfillment_type, v_payment_method_code, v_payment_timing);

  v_config_affects_cashbook := coalesce((v_order.payment_metadata->>'affects_cashbook')::boolean, true);
  v_payment_confirmed := coalesce((v_order.payment_metadata->>'confirmed_in_finalization')::boolean, false)
    or coalesce(v_order.payment_status, '') = 'paid';

  if v_payment_confirmed then
    v_entry_status := 'confirmed';
    v_affects_balance := true;
  elsif v_config_affects_cashbook then
    v_entry_status := 'confirmed';
    v_affects_balance := true;
  else
    v_entry_status := 'pending';
    v_affects_balance := false;
  end if;

  v_origin_detail := case
    when v_order.sales_channel = 'public_store' and v_order.fulfillment_type = 'pickup' then 'Loja online · Retirada'
    when v_order.sales_channel = 'public_store' and v_order.fulfillment_type = 'delivery' then 'Loja online · Entrega'
    when v_order.sales_channel in ('qr_table', 'table') then 'Mesa' || coalesce(' · ' || nullif(v_order.table_code, ''), '')
    when v_order.sales_channel = 'pdv' then 'PDV'
    when v_order.sales_channel = 'direct_sale' then 'Venda direta'
    when v_order.sales_channel = 'whatsapp' then 'WhatsApp'
    else coalesce(v_order.sales_channel, 'Pedido')
  end;

  v_destination_account_id := public.resolve_order_payment_destination_account(
    p_store_id := v_order.store_id,
    p_scope := coalesce(v_order.sales_channel, 'public_store'),
    p_fulfillment_type := coalesce(v_order.fulfillment_type, 'any'),
    p_payment_timing := v_payment_timing,
    p_payment_method_code := v_payment_method_code,
    p_override_account_id := null
  );

  if v_destination_account_id is not null then
    select * into v_destination_account
    from public.store_financial_accounts
    where id = v_destination_account_id
      and store_id = v_order.store_id
      and active = true;
  end if;

  v_entry_code := public.generate_cashbook_entry_code();

  insert into public.cashbook_entries (
    store_id, entry_code, entry_date, occurred_at, type, direction, amount,
    description, payment_method, payment_method_code, source, source_id,
    order_id, customer_id, status, affects_balance,
    destination_financial_account_id, affects_cash_drawer, affects_financial_result,
    metadata, created_by
  ) values (
    v_order.store_id, v_entry_code, coalesce(v_order.completed_at::date, current_date),
    coalesce(v_order.completed_at, now()), 'sale', 'in', v_order.total,
    'Venda concluída pelo pedido ' || v_order.order_code,
    v_payment_name, v_payment_method_code, 'order', v_order.id,
    v_order.id, v_order.customer_id, v_entry_status, v_affects_balance,
    v_destination_account_id, coalesce(v_destination_account.account_type = 'cash_drawer', false), true,
    jsonb_build_object(
      'order_code', v_order.order_code,
      'sales_channel', v_order.sales_channel,
      'fulfillment_type', v_order.fulfillment_type,
      'payment_timing', v_payment_timing,
      'table_code', v_order.table_code,
      'origin_detail', v_origin_detail,
      'customer_name', v_order.customer_name,
      'payment_confirmed_in_finalization', v_payment_confirmed,
      'payment_metadata', coalesce(v_order.payment_metadata, '{}'::jsonb),
      'destination_financial_account_id', v_destination_account_id,
      'destination_financial_account_name', v_destination_account.name,
      'destination_financial_account_code', v_destination_account.code,
      'destination_financial_account_type', v_destination_account.account_type,
      'payment_route_source', case when v_destination_account_id is null then 'unallocated' else 'store_order_payment_account_routes' end
    ),
    auth.uid()
  ) returning id into v_entry_id;

  return jsonb_build_object(
    'ok', true,
    'entry', jsonb_build_object(
      'id', v_entry_id,
      'entry_code', v_entry_code,
      'amount', v_order.total,
      'status', v_entry_status,
      'affects_balance', v_affects_balance,
      'origin_detail', v_origin_detail,
      'payment_method_code', v_payment_method_code,
      'payment_method', v_payment_name,
      'payment_timing', v_payment_timing,
      'destination_financial_account_id', v_destination_account_id,
      'destination_financial_account_name', v_destination_account.name
    )
  );
end;
$function$;

create or replace function public.list_cashbook_entries_by_period_safe(
  p_store_id uuid,
  p_start_date date default null::date,
  p_end_date date default null::date,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_entries jsonb := '[]'::jsonb;
  v_limit integer := greatest(1, least(coalesce(p_limit, 500), 1000));
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'entries', '[]'::jsonb);
  end if;

  if auth.uid() is null or not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'cashbook.view')
    or public.user_has_store_permission(p_store_id, 'cashbook.create')
  ) then
    return jsonb_build_object('ok', false, 'error', 'access_denied', 'entries', '[]'::jsonb);
  end if;

  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    return jsonb_build_object('ok', false, 'error', 'invalid_date_range', 'message', 'A data inicial não pode ser posterior à data final.', 'entries', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.occurred_at desc), '[]'::jsonb)
  into v_entries
  from (
    select
      ce.*,
      o.customer_name as order_customer_name,
      o.order_code as order_code,
      case when src.id is null then null else jsonb_build_object('id', src.id, 'name', src.name, 'code', src.code, 'account_type', src.account_type) end as source_financial_account,
      case when dst.id is null then null else jsonb_build_object('id', dst.id, 'name', dst.name, 'code', dst.code, 'account_type', dst.account_type) end as destination_financial_account,
      coalesce(dst.name, src.name) as financial_account_name,
      coalesce(dst.code, src.code) as financial_account_code,
      coalesce(dst.account_type, src.account_type) as financial_account_type
    from public.cashbook_entries ce
    left join public.orders o on o.id = ce.order_id
    left join public.store_financial_accounts src on src.id = ce.source_financial_account_id
    left join public.store_financial_accounts dst on dst.id = ce.destination_financial_account_id
    where ce.store_id = p_store_id
      and (p_start_date is null or ce.entry_date >= p_start_date)
      and (p_end_date is null or ce.entry_date <= p_end_date)
    order by ce.entry_date desc, ce.occurred_at desc
    limit v_limit
  ) q;

  return jsonb_build_object('ok', true, 'entries', v_entries);
exception
  when others then
    return jsonb_build_object('ok', false, 'error', 'unexpected_error', 'message', 'Não foi possível listar os lançamentos do período.', 'entries', '[]'::jsonb);
end;
$function$;
