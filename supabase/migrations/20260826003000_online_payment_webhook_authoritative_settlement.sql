-- Confirmação autoritativa de pagamento online via webhook.
-- O lançamento é idempotente e só é criado quando há conta de liquidação explícita e compatível.

create or replace function public.apply_online_payment_settlement_internal(
  p_intent_id uuid,
  p_provider_event_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_intent public.online_payment_intents%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_order public.orders%rowtype;
  v_payment public.store_payment_methods%rowtype;
  v_account_id uuid;
  v_account_ref text;
  v_entry_id uuid;
  v_base_code text;
  v_payment_method_enum public.payment_method;
  v_paid_at timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'service_role_required');
  end if;

  select * into v_intent
  from public.online_payment_intents
  where id = p_intent_id
  for update;

  if v_intent.id is null then
    return jsonb_build_object('ok', false, 'error', 'payment_intent_not_found');
  end if;
  if v_intent.status <> 'paid' then
    return jsonb_build_object('ok', false, 'error', 'payment_not_received', 'status', v_intent.status);
  end if;
  if v_intent.order_id is null then
    return jsonb_build_object('ok', true, 'skipped', true, 'reason', 'intent_without_order');
  end if;

  select * into v_provider
  from public.store_online_payment_providers
  where id = v_intent.provider_id and store_id = v_intent.store_id
  for update;
  if v_provider.id is null or not v_provider.enabled then
    return jsonb_build_object('ok', false, 'error', 'payment_provider_inactive');
  end if;

  select * into v_order
  from public.orders
  where id = v_intent.order_id and store_id = v_intent.store_id
  for update;
  if v_order.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;
  if v_order.status::text = 'cancelled' then
    return jsonb_build_object('ok', false, 'error', 'order_cancelled');
  end if;
  if abs(coalesce(v_order.total, 0) - coalesce(v_intent.amount, 0)) > 0.01 then
    return jsonb_build_object(
      'ok', false,
      'error', 'payment_amount_mismatch',
      'order_total', v_order.total,
      'payment_amount', v_intent.amount
    );
  end if;

  select * into v_payment
  from public.store_payment_methods
  where store_id = v_intent.store_id
    and code = v_intent.method_code
    and active = true
  limit 1;
  if v_payment.id is null then
    return jsonb_build_object('ok', false, 'error', 'payment_method_not_available');
  end if;
  v_base_code := coalesce(nullif(v_payment.base_code, ''), v_payment.code);

  v_account_ref := nullif(trim(coalesce(v_provider.public_config->>'settlement_financial_account_id', '')), '');
  if v_account_ref is null then
    return jsonb_build_object('ok', false, 'error', 'settlement_account_required');
  end if;
  begin
    v_account_id := v_account_ref::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'invalid_settlement_account');
  end;

  if not exists (
    select 1
    from public.store_financial_accounts account
    where account.id = v_account_id
      and account.store_id = v_intent.store_id
      and account.active = true
      and exists (
        select 1
        from public.store_financial_account_payment_methods account_method
        where account_method.store_id = v_intent.store_id
          and account_method.account_id = account.id
          and account_method.active = true
          and account_method.payment_method_code in (v_payment.code, v_base_code)
      )
  ) then
    return jsonb_build_object('ok', false, 'error', 'settlement_account_incompatible');
  end if;

  v_payment_method_enum := case
    when v_base_code = 'cash' then 'cash'::public.payment_method
    when v_base_code = 'pix' then 'pix'::public.payment_method
    when v_base_code in ('debit_card', 'credit_card') then 'card'::public.payment_method
    else 'pending'::public.payment_method
  end;
  v_paid_at := coalesce(v_intent.paid_at, now());

  update public.orders
  set payment_status = 'paid',
      payment_method = v_payment_method_enum,
      payment_method_code = v_payment.code,
      payment_metadata = coalesce(payment_metadata, '{}'::jsonb) || jsonb_build_object(
        'code', v_payment.code,
        'name', v_payment.name,
        'base_code', v_base_code,
        'status', 'paid',
        'confirmed_at', v_paid_at,
        'confirmation_mode', 'api',
        'provider_code', v_provider.provider_code,
        'provider_environment', v_provider.environment,
        'online_payment_intent_id', v_intent.id,
        'provider_event_id', p_provider_event_id
      ),
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'online_payment_received_at', v_paid_at,
        'online_payment_intent_id', v_intent.id,
        'online_payment_provider', v_provider.provider_code
      ),
      updated_at = now()
  where id = v_order.id and store_id = v_order.store_id;

  select id into v_entry_id
  from public.cashbook_entries
  where store_id = v_order.store_id
    and order_id = v_order.id
    and type = 'sale'
    and status <> 'cancelled'
  order by created_at desc
  limit 1
  for update;

  if v_entry_id is null then
    insert into public.cashbook_entries (
      store_id, entry_code, entry_date, occurred_at, type, direction, amount,
      description, payment_method, payment_method_code, source, source_id,
      order_id, customer_id, status, affects_balance,
      destination_financial_account_id, metadata, created_by
    ) values (
      v_order.store_id,
      public.generate_cashbook_entry_code(),
      (v_paid_at at time zone 'America/Sao_Paulo')::date,
      v_paid_at,
      'sale', 'in', v_intent.amount,
      'Pagamento online confirmado pelo pedido ' || v_order.order_code,
      v_payment.name, v_payment.code, 'order', v_order.id,
      v_order.id, v_order.customer_id, 'confirmed', true,
      v_account_id,
      jsonb_build_object(
        'order_code', v_order.order_code,
        'online_payment_intent_id', v_intent.id,
        'provider_code', v_provider.provider_code,
        'provider_environment', v_provider.environment,
        'provider_event_id', p_provider_event_id,
        'settlement_financial_account_id', v_account_id,
        'payment_method_base_code', v_base_code
      ),
      null
    )
    returning id into v_entry_id;
  else
    update public.cashbook_entries
    set entry_date = (v_paid_at at time zone 'America/Sao_Paulo')::date,
        occurred_at = v_paid_at,
        amount = v_intent.amount,
        payment_method = v_payment.name,
        payment_method_code = v_payment.code,
        status = 'confirmed',
        affects_balance = true,
        destination_financial_account_id = v_account_id,
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'online_payment_intent_id', v_intent.id,
          'provider_code', v_provider.provider_code,
          'provider_environment', v_provider.environment,
          'provider_event_id', p_provider_event_id,
          'settlement_financial_account_id', v_account_id,
          'payment_method_base_code', v_base_code
        ),
        updated_at = now()
    where id = v_entry_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'intent_id', v_intent.id,
    'order_id', v_order.id,
    'cashbook_entry_id', v_entry_id,
    'settlement_financial_account_id', v_account_id
  );
end;
$function$;

revoke all on function public.apply_online_payment_settlement_internal(uuid,text) from public, anon, authenticated;
grant execute on function public.apply_online_payment_settlement_internal(uuid,text) to service_role;
