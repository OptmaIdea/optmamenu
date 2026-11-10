-- Ao concluir delivery com dinheiro/troco, o lançamento temporário de troco deixa de afetar saldo.
-- O lançamento final passa a levar a conta no rótulo visível do Livro Diário.

create or replace function public.create_cashbook_entry_from_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
  v_existing_id uuid;
  v_entry_id uuid;
  v_entry_code text;
  v_payment_name text;
  v_payment_display_name text;
  v_config_affects_cashbook boolean := true;
  v_payment_confirmed boolean := false;
  v_entry_status text;
  v_affects_balance boolean;
  v_origin_detail text;
  v_payment_method_code text;
  v_payment_timing text;
  v_destination_account_id uuid;
  v_destination_account record;
  v_override_account_id uuid;
  v_resolved_change_count integer := 0;
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
    update public.cashbook_entries ce
       set status = 'cancelled',
           affects_balance = false,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('resolved_on_delivery_completion', true, 'resolved_at', now(), 'resolved_by_sale_entry_id', v_existing_id)
     where ce.store_id = v_order.store_id
       and ce.order_id = v_order.id
       and ce.source = 'order_change'
       and ce.status = 'confirmed'
       and coalesce(ce.metadata->>'temporary_change_sent','false') = 'true';
    return jsonb_build_object('ok', true, 'already_exists', true, 'entry_id', v_existing_id);
  end if;

  v_payment_method_code := lower(coalesce(nullif(v_order.payment_method_code, ''), v_order.payment_method::text, 'pending'));
  v_payment_timing := public.get_order_payment_timing(coalesce(v_order.payment_metadata, '{}'::jsonb), v_order.payment_status);
  v_payment_name := public.format_order_cashbook_payment_label(v_order.fulfillment_type, v_payment_method_code, v_payment_timing);
  v_override_account_id := nullif(v_order.payment_metadata->>'finalization_financial_account_id', '')::uuid;

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
    v_entry_status := 'draft';
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
    p_override_account_id := v_override_account_id
  );

  if v_destination_account_id is not null then
    select * into v_destination_account
    from public.store_financial_accounts
    where id = v_destination_account_id
      and store_id = v_order.store_id
      and active = true;
  end if;

  v_payment_display_name := case
    when v_destination_account.name is not null then v_payment_name || ' · ' || v_destination_account.name
    else v_payment_name
  end;

  v_entry_code := public.generate_cashbook_entry_code();

  insert into public.cashbook_entries (
    store_id,
    entry_code,
    entry_date,
    occurred_at,
    type,
    direction,
    amount,
    description,
    payment_method,
    payment_method_code,
    source,
    source_id,
    order_id,
    customer_id,
    status,
    affects_balance,
    destination_financial_account_id,
    affects_cash_drawer,
    affects_financial_result,
    metadata,
    created_by
  ) values (
    v_order.store_id,
    v_entry_code,
    coalesce(v_order.completed_at::date, current_date),
    coalesce(v_order.completed_at, now()),
    'sale',
    'in',
    v_order.total,
    'Venda concluída pelo pedido ' || v_order.order_code,
    v_payment_display_name,
    v_payment_method_code,
    'order',
    v_order.id,
    v_order.id,
    v_order.customer_id,
    v_entry_status,
    v_affects_balance,
    v_destination_account_id,
    coalesce(v_destination_account.account_type = 'cash_drawer', false),
    true,
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
      'payment_route_source', case when v_destination_account_id is null then 'unallocated' when v_override_account_id is not null then 'finalization_override' else 'store_order_payment_account_routes' end
    ),
    auth.uid()
  ) returning id into v_entry_id;

  update public.cashbook_entries ce
     set status = 'cancelled',
         affects_balance = false,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('resolved_on_delivery_completion', true, 'resolved_at', now(), 'resolved_by_sale_entry_id', v_entry_id)
   where ce.store_id = v_order.store_id
     and ce.order_id = v_order.id
     and ce.source = 'order_change'
     and ce.status = 'confirmed'
     and coalesce(ce.metadata->>'temporary_change_sent','false') = 'true';
  get diagnostics v_resolved_change_count = row_count;

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
      'payment_method', v_payment_display_name,
      'payment_timing', v_payment_timing,
      'destination_financial_account_id', v_destination_account_id,
      'destination_financial_account_name', v_destination_account.name,
      'resolved_change_entries', v_resolved_change_count
    )
  );
end;
$$;
