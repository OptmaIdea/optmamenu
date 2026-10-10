
create or replace function public.apply_online_card_receivable_settlement_internal(
  p_intent_id uuid,
  p_provider_event_id text default null,
  p_settled_at timestamptz default now(),
  p_net_amount numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_role text;
  v_receivable public.online_payment_receivables%rowtype;
  v_provider public.store_online_payment_providers%rowtype;
  v_settlement_account_id uuid;
  v_receivable_account_id uuid;
  v_account_ref text;
  v_entry_id uuid;
  v_fee_entry_id uuid;
  v_group_id uuid := gen_random_uuid();
  v_amount numeric;
  v_extra_fee numeric := 0;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role',true),''),
    nullif(auth.role(),''),
    current_user
  );
  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  select * into v_receivable
  from public.online_payment_receivables
  where intent_id=p_intent_id
  for update;

  if v_receivable.id is null then
    return jsonb_build_object('ok',false,'error','receivable_not_found');
  end if;

  if v_receivable.status='settled' then
    return jsonb_build_object(
      'ok',true,'duplicate',true,'receivable_id',v_receivable.id,
      'settlement_cashbook_entry_id',v_receivable.settlement_cashbook_entry_id
    );
  end if;

  if v_receivable.status in ('cancelled','refunded','chargeback') then
    return jsonb_build_object('ok',false,'error','receivable_not_settleable','status',v_receivable.status);
  end if;

  v_amount := round(coalesce(p_net_amount,v_receivable.net_amount),2);

  if v_amount <= 0 then
    return jsonb_build_object('ok',false,'error','invalid_settlement_amount');
  end if;

  if v_amount > v_receivable.net_amount + 0.01 then
    return jsonb_build_object(
      'ok',false,'error','settlement_amount_above_expected',
      'expected',v_receivable.net_amount,'received',v_amount
    );
  end if;

  -- Quando o provedor liquida menos que o líquido originalmente previsto,
  -- a diferença é custo financeiro adicional (ex.: antecipação), não divergência bancária.
  v_extra_fee := greatest(0,round(v_receivable.net_amount-v_amount,2));

  select * into v_provider
  from public.store_online_payment_providers
  where id=v_receivable.provider_id and store_id=v_receivable.store_id
  for update;

  if v_provider.id is null then
    return jsonb_build_object('ok',false,'error','provider_not_found');
  end if;

  v_account_ref := nullif(trim(coalesce(v_provider.public_config->>'settlement_financial_account_id','')),'');
  if v_account_ref is null then
    return jsonb_build_object('ok',false,'error','settlement_account_required');
  end if;

  begin
    v_settlement_account_id := v_account_ref::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('ok',false,'error','invalid_settlement_account');
  end;

  select id into v_receivable_account_id
  from public.store_financial_accounts
  where store_id=v_receivable.store_id and code='optmapay_receivable' and active=true
  limit 1;

  if v_receivable_account_id is null then
    return jsonb_build_object('ok',false,'error','receivable_account_required');
  end if;

  if not exists (
    select 1
    from public.store_financial_accounts
    where id=v_settlement_account_id and store_id=v_receivable.store_id and active=true
  ) then
    return jsonb_build_object('ok',false,'error','settlement_account_invalid');
  end if;

  if v_extra_fee > 0 then
    v_fee_entry_id := v_receivable.fee_cashbook_entry_id;

    if v_fee_entry_id is not null then
      update public.cashbook_entries
      set amount=round(v_receivable.fee_amount+coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee,2),
          description=case
            when coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee > 0
              then 'Taxas do pagamento OptmaPay'
            else description
          end,
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'mdr_fee_amount',v_receivable.fee_amount,
            'anticipation_fee_amount',coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee,
            'fee_kind','processing_and_anticipation',
            'settlement_provider_event_id',p_provider_event_id
          ),
          updated_at=now()
      where id=v_fee_entry_id
        and store_id=v_receivable.store_id
        and status<>'cancelled';
    else
      insert into public.cashbook_entries(
        store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,
        payment_method,payment_method_code,source,source_id,order_id,status,affects_balance,
        account_plan_code,source_financial_account_id,
        is_transfer,affects_cash_drawer,affects_financial_result,metadata,created_by
      ) values (
        v_receivable.store_id,public.generate_cashbook_entry_code(),
        (coalesce(p_settled_at,now()) at time zone 'America/Sao_Paulo')::date,
        coalesce(p_settled_at,now()),'manual_expense','out',
        round(v_receivable.fee_amount+coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee,2),
        'Taxas do pagamento OptmaPay',
        v_receivable.payment_method_code,v_receivable.payment_method_code,
        'online_payment_fee',v_receivable.intent_id,v_receivable.order_id,
        'confirmed',true,'payment_processing_fees',
        v_receivable_account_id,false,false,true,
        jsonb_build_object(
          'online_payment_intent_id',v_receivable.intent_id,
          'provider_code',v_provider.provider_code,
          'provider_event_id',p_provider_event_id,
          'mdr_fee_amount',v_receivable.fee_amount,
          'anticipation_fee_amount',coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee,
          'fee_kind','processing_and_anticipation'
        ),null
      )
      returning id into v_fee_entry_id;
    end if;
  else
    v_fee_entry_id := v_receivable.fee_cashbook_entry_id;
  end if;

  insert into public.cashbook_entries(
    store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,
    payment_method,payment_method_code,source,source_id,order_id,status,affects_balance,
    account_plan_code,source_financial_account_id,destination_financial_account_id,
    is_transfer,transfer_group_id,affects_cash_drawer,affects_financial_result,metadata,created_by
  ) values (
    v_receivable.store_id,public.generate_cashbook_entry_code(),
    (coalesce(p_settled_at,now()) at time zone 'America/Sao_Paulo')::date,
    coalesce(p_settled_at,now()),'transfer','out',v_amount,
    'Crédito de recebível OptmaPay',
    v_receivable.payment_method_code,v_receivable.payment_method_code,
    'online_payment_settlement',v_receivable.intent_id,v_receivable.order_id,
    'confirmed',true,'transfer_card_to_bank',
    v_receivable_account_id,v_settlement_account_id,
    true,v_group_id,false,false,
    jsonb_build_object(
      'online_payment_intent_id',v_receivable.intent_id,
      'online_payment_receivable_id',v_receivable.id,
      'provider_event_id',p_provider_event_id,
      'settlement_plan',v_receivable.settlement_plan,
      'gross_amount',v_receivable.gross_amount,
      'mdr_fee_amount',v_receivable.fee_amount,
      'anticipation_fee_amount',coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee,
      'total_fee_amount',round(v_receivable.fee_amount+coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee,2),
      'net_amount',v_amount,
      'anticipated',v_extra_fee>0
    ),
    null
  )
  returning id into v_entry_id;

  update public.online_payment_receivables
  set status='settled',
      settled_at=coalesce(p_settled_at,now()),
      anticipation_fee_amount=coalesce(anticipation_fee_amount,0)+v_extra_fee,
      net_amount=v_amount,
      fee_cashbook_entry_id=coalesce(v_fee_entry_id,fee_cashbook_entry_id),
      settlement_cashbook_entry_id=v_entry_id,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'settlement_provider_event_id',p_provider_event_id,
        'settlement_net_amount',v_amount,
        'additional_financial_fee_amount',v_extra_fee,
        'anticipated',v_extra_fee>0
      ),
      updated_at=now()
  where id=v_receivable.id;

  return jsonb_build_object(
    'ok',true,
    'receivable_id',v_receivable.id,
    'settled_amount',v_amount,
    'additional_financial_fee_amount',v_extra_fee,
    'total_fee_amount',round(v_receivable.fee_amount+coalesce(v_receivable.anticipation_fee_amount,0)+v_extra_fee,2),
    'settled_at',coalesce(p_settled_at,now()),
    'settlement_cashbook_entry_id',v_entry_id,
    'fee_cashbook_entry_id',v_fee_entry_id,
    'source_financial_account_id',v_receivable_account_id,
    'destination_financial_account_id',v_settlement_account_id
  );
end;
$function$;

revoke all on function public.apply_online_card_receivable_settlement_internal(uuid,text,timestamptz,numeric) from public;
revoke all on function public.apply_online_card_receivable_settlement_internal(uuid,text,timestamptz,numeric) from anon;
revoke all on function public.apply_online_card_receivable_settlement_internal(uuid,text,timestamptz,numeric) from authenticated;
grant execute on function public.apply_online_card_receivable_settlement_internal(uuid,text,timestamptz,numeric) to service_role;
