-- Corrige fluxo delivery: baixa física só no despacho, finalização só depois de sair para entrega,
-- e cria lançamento temporário de troco enviado com o entregador.

create or replace function public.admin_complete_public_order_safe_internal_0d(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_result jsonb;
begin
  if p_order_id is null then return jsonb_build_object('ok', false, 'error', 'missing_order_id'); end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if auth.uid() is null or not public.is_store_member(v_order.store_id) then return jsonb_build_object('ok', false, 'error', 'access_denied'); end if;
  if v_order.status::text = 'completed' then return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_completed', 'order_id', v_order.id, 'order_code', v_order.order_code); end if;

  if coalesce(v_order.fulfillment_type, 'pickup') = 'delivery' and v_order.status::text <> 'out_for_delivery' then
    return jsonb_build_object(
      'ok', false,
      'error', 'delivery_must_be_dispatched_first',
      'message', 'Pedido de entrega precisa passar por "Saiu para entrega" antes da conclusão.',
      'current_status', v_order.status::text
    );
  end if;

  if v_order.status::text = 'out_for_delivery' then
    update public.orders
    set status = 'completed',
        completed_at = coalesce(completed_at, now()),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('delivery_completed_at', now()),
        updated_at = now()
    where id = v_order.id;
    perform public.create_cashbook_entry_from_order(v_order.id);
    return jsonb_build_object('ok', true, 'order_id', v_order.id, 'order_code', v_order.order_code, 'status', 'completed');
  end if;

  if v_order.status::text not in ('confirmed', 'ready') then return jsonb_build_object('ok', false, 'error', 'order_not_confirmed', 'current_status', v_order.status::text); end if;
  if v_order.status::text = 'ready' then update public.orders set status = 'confirmed' where id = v_order.id; end if;
  v_result := public.complete_confirmed_public_order(v_order.id);
  return v_result;
end;
$$;

-- A função complete_confirmed_public_order também passa a rejeitar delivery direto.
-- A baixa física de delivery deve passar por admin_dispatch_public_order_safe_internal_0d.

create or replace function public.admin_dispatch_public_order_safe_internal_0d(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_change_for numeric;
  v_change_amount numeric;
  v_cash_account_id uuid;
  v_entry_id uuid;
  v_entry_code text;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if auth.uid() is null or not public.is_store_member(v_order.store_id) then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;
  if coalesce(v_order.fulfillment_type, 'pickup') <> 'delivery' then
    return jsonb_build_object('ok', false, 'error', 'order_is_not_delivery');
  end if;
  if v_order.status::text = 'out_for_delivery' then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_out_for_delivery', 'order_id', v_order.id);
  end if;
  if v_order.status::text not in ('confirmed', 'ready') then
    return jsonb_build_object('ok', false, 'error', 'order_not_ready_for_dispatch', 'current_status', v_order.status::text);
  end if;

  perform public.confirm_order_stock(v_order.store_id, v_order.id, auth.uid());

  v_change_for := nullif(v_order.payment_metadata #>> '{checkout,change_for}', '')::numeric;
  v_change_amount := greatest(coalesce(v_change_for, 0) - coalesce(v_order.total, 0), 0);

  if lower(coalesce(v_order.payment_method_code, v_order.payment_method::text, '')) = 'cash' and v_change_amount > 0 then
    v_cash_account_id := public.resolve_order_payment_destination_account(
      p_store_id := v_order.store_id,
      p_scope := coalesce(v_order.sales_channel, 'public_store'),
      p_fulfillment_type := 'delivery',
      p_payment_timing := 'pay_on_fulfillment',
      p_payment_method_code := 'cash',
      p_override_account_id := null
    );

    select ce.id into v_entry_id
    from public.cashbook_entries ce
    where ce.store_id = v_order.store_id
      and ce.order_id = v_order.id
      and ce.source = 'order_change'
      and ce.status = 'confirmed'
      and coalesce(ce.metadata->>'temporary_change_sent','false') = 'true'
    limit 1;

    if v_cash_account_id is not null and v_entry_id is null then
      v_entry_code := public.generate_cashbook_entry_code();
      insert into public.cashbook_entries (
        store_id, entry_code, entry_date, occurred_at, type, direction, amount,
        description, notes, payment_method, payment_method_code, source, source_id, order_id,
        status, affects_balance, source_financial_account_id, affects_cash_drawer, affects_financial_result,
        metadata, created_by
      ) values (
        v_order.store_id, v_entry_code, current_date, now(), 'other', 'out', v_change_amount,
        'Troco enviado com o pedido ' || v_order.order_code,
        'Lançamento temporário para conferência do caixa enquanto o pedido está em entrega.',
        'Dinheiro · troco enviado', 'cash_change_sent', 'order_change', v_order.id, v_order.id,
        'confirmed', true, v_cash_account_id, true, false,
        jsonb_build_object(
          'order_code', v_order.order_code,
          'temporary_change_sent', true,
          'change_for', v_change_for,
          'order_total', v_order.total,
          'change_amount', v_change_amount,
          'resolved_on_delivery_completion', false
        ),
        auth.uid()
      ) returning id into v_entry_id;
    end if;
  end if;

  update public.orders
  set status = 'out_for_delivery',
      expires_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'out_for_delivery_at', now(), 'stock_written_off_at', now(), 'change_sent_entry_id', v_entry_id, 'change_sent_amount', v_change_amount
      ),
      updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('ok', true, 'order_id', v_order.id, 'order_code', v_order.order_code, 'status', 'out_for_delivery', 'change_sent_amount', v_change_amount, 'change_entry_id', v_entry_id);
end;
$$;
