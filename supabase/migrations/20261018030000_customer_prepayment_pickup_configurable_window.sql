begin;
-- Configurable advance-payment reservation for pickup only, no changes to past orders.
CREATE OR REPLACE FUNCTION public.create_public_order_by_slug_v3(p_slug text, p_customer_name text, p_customer_phone text, p_fulfillment_type text, p_sales_channel text, p_items jsonb, p_delivery_address jsonb DEFAULT '{}'::jsonb, p_table_code text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_payment_selection jsonb DEFAULT '{}'::jsonb, p_delivery_method_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_store_id uuid;
  v_fulfillment text := case when p_fulfillment_type = 'table' then 'qr_table' else coalesce(nullif(trim(p_fulfillment_type), ''), 'pickup') end;
  v_timing text := coalesce(nullif(trim(p_payment_selection->>'timing'), ''), 'pay_on_fulfillment');
  v_selected_method_code text := nullif(trim(p_payment_selection->>'method_code'), '');
  v_promised_method_code text := nullif(trim(p_payment_selection->>'promised_method_code'), '');
  v_change_for numeric := null;
  v_method record;
  v_effective_payment_code text := 'pending';
  v_effective_delivery_code text;
  v_result jsonb;
  v_order_id uuid;
  v_checkout_metadata jsonb;
  v_payment_enum public.payment_method := 'pending'::public.payment_method;
  v_auth_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_customer_name text;
  v_customer_phone text;
  v_prepayment_hold_minutes integer;
  v_prepayment_deadline timestamptz;
begin
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);
  if v_store_id is null then return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled'); end if;

  -- Enforce on the server before allocating stock, creating an order or a Pix intent.
  -- The UI is not an authorization boundary.
  if (v_timing='pay_now' or v_fulfillment<>'pickup') and not (
      public.app_current_role()='customer'
      and public.app_current_customer_id() is not null
      and public.app_current_store_id()=v_store_id
  ) then
    return jsonb_build_object('ok',false,'error','customer_auth_required_for_checkout');
  end if;

  v_effective_delivery_code := case
    when nullif(trim(coalesce(p_delivery_method_code, '')), '') is null then null
    when p_delivery_method_code = 'delivery' then 'local_delivery'
    else p_delivery_method_code
  end;

  if p_payment_selection ? 'change_for' and nullif(trim(p_payment_selection->>'change_for'), '') is not null then
    begin
      v_change_for := (p_payment_selection->>'change_for')::numeric;
    exception when others then
      return jsonb_build_object('ok', false, 'error', 'invalid_change_for');
    end;
    if v_change_for <= 0 then return jsonb_build_object('ok', false, 'error', 'invalid_change_for'); end if;
  end if;

  if v_timing = 'pay_now' then
    if v_selected_method_code is null then return jsonb_build_object('ok', false, 'error', 'payment_method_required'); end if;

    select pm.code, pm.name, coalesce(pm.base_code, pm.code) as base_code, pm.requires_proof, pm.metadata
      into v_method
    from public.store_payment_methods pm
    where pm.store_id = v_store_id
      and pm.code = v_selected_method_code
      and pm.active = true
      and pm.public_enabled = true
      and coalesce((pm.metadata->'checkout'->>'pay_now')::boolean, false) = true
    limit 1;

    if v_method.code is null then return jsonb_build_object('ok', false, 'error', 'payment_method_disabled'); end if;

    if coalesce(v_method.metadata->'checkout'->>'confirmation_mode', '') = 'api'
       and coalesce((v_method.metadata->'checkout'->>'integration_enabled')::boolean, false) = false then
      return jsonb_build_object('ok', false, 'error', 'payment_integration_unavailable');
    end if;

    if coalesce(v_method.metadata->'checkout'->>'confirmation_mode', '') = 'manual_proof'
       and v_method.requires_proof is not true then
      return jsonb_build_object('ok', false, 'error', 'payment_method_misconfigured');
    end if;

    v_effective_payment_code := v_method.code;
    v_payment_enum := case
      when v_method.base_code = 'pix' then 'pix'::public.payment_method
      when v_method.base_code = 'cash' then 'cash'::public.payment_method
      when v_method.base_code in ('debit_card', 'credit_card') then 'card'::public.payment_method
      else 'pending'::public.payment_method
    end;
    v_checkout_metadata := jsonb_build_object(
      'timing', 'pay_now',
      'selected_method_code', v_method.code,
      'selected_method_name', v_method.name,
      'confirmation_mode', coalesce(v_method.metadata->'checkout'->>'confirmation_mode', 'api'),
      'requires_proof', coalesce(v_method.requires_proof, false),
      'awaiting_confirmation', true
    );
  elsif v_timing = 'pay_on_fulfillment' then
    if not exists (
      select 1 from public.store_payment_methods pm
      where pm.store_id = v_store_id and pm.code = 'pending' and pm.active = true and pm.public_enabled = true
    ) then return jsonb_build_object('ok', false, 'error', 'payment_method_disabled'); end if;

    if v_fulfillment = 'delivery' then
      if v_promised_method_code not in ('pix', 'card', 'cash') then return jsonb_build_object('ok', false, 'error', 'delivery_payment_method_required'); end if;

      if v_promised_method_code = 'pix' and not exists (
        select 1 from public.store_payment_methods pm where pm.store_id = v_store_id and pm.active = true and pm.public_enabled = true
          and coalesce(pm.base_code, pm.code) = 'pix' and pm.code <> 'pix_manual_qr'
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean, false) = true
      ) then return jsonb_build_object('ok', false, 'error', 'delivery_payment_method_disabled'); end if;

      if v_promised_method_code = 'card' and not exists (
        select 1 from public.store_payment_methods pm where pm.store_id = v_store_id and pm.active = true and pm.public_enabled = true
          and coalesce(pm.base_code, pm.code) in ('debit_card', 'credit_card')
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean, false) = true
      ) then return jsonb_build_object('ok', false, 'error', 'delivery_payment_method_disabled'); end if;

      if v_promised_method_code = 'cash' and not exists (
        select 1 from public.store_payment_methods pm where pm.store_id = v_store_id and pm.active = true and pm.public_enabled = true
          and coalesce(pm.base_code, pm.code) = 'cash'
          and coalesce((pm.metadata->'checkout'->>'pay_on_delivery')::boolean, false) = true
      ) then return jsonb_build_object('ok', false, 'error', 'delivery_payment_method_disabled'); end if;
    else
      v_promised_method_code := null;
      v_change_for := null;
    end if;

    v_effective_payment_code := 'pending';
    v_payment_enum := 'pending'::public.payment_method;
    v_checkout_metadata := jsonb_build_object(
      'timing', 'pay_on_fulfillment',
      'fulfillment_label', case
        when v_fulfillment = 'delivery' then 'Pagar na entrega'
        when v_fulfillment in ('qr_table', 'dine_in') then 'Pagar no atendimento'
        else 'Pagar na retirada'
      end,
      'promised_method_code', v_promised_method_code,
      'change_for', v_change_for,
      'awaiting_confirmation', true
    );
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_payment_timing');
  end if;

  v_result := public.create_public_order_by_slug_v2(
    p_slug,
    p_customer_name,
    p_customer_phone,
    v_fulfillment,
    p_sales_channel,
    p_payment_method_code => v_effective_payment_code,
    p_delivery_method_code => v_effective_delivery_code,
    p_items => p_items,
    p_delivery_address => p_delivery_address,
    p_table_code => p_table_code,
    p_notes => p_notes
  );

  if coalesce((v_result->>'ok')::boolean, false) = false then return v_result; end if;

  v_order_id := nullif(v_result->'order'->>'id', '')::uuid;
  if v_order_id is null then return jsonb_build_object('ok', false, 'error', 'order_result_missing_id'); end if;

  update public.orders o
  set payment_method = v_payment_enum,
      payment_method_code = v_effective_payment_code,
      payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb) || jsonb_build_object('checkout', v_checkout_metadata),
      commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
        'payment_timing', v_timing,
        'promised_payment_method', v_promised_method_code,
        'payment_confirmation_mode', case when v_timing = 'pay_now' then v_checkout_metadata->>'confirmation_mode' else 'at_fulfillment' end
      )
  where o.id = v_order_id and o.store_id = v_store_id;

  if v_auth_user_id is not null then
    select
      c.id,
      coalesce(nullif(trim(c.full_name), ''), nullif(trim(c.nickname), ''), 'Cliente'),
      coalesce(nullif(trim(c.phone), ''), nullif(trim(c.phone_e164), ''))
    into v_customer_id, v_customer_name, v_customer_phone
    from public.customer_auth_identities cai
    join public.customers c
      on c.id = cai.customer_id
     and c.store_id = cai.store_id
    where cai.auth_user_id = v_auth_user_id
      and cai.store_id = v_store_id
      and cai.revoked_at is null
      and c.status = 'active'
    order by cai.last_issued_at desc nulls last, cai.created_at desc
    limit 1;

    if v_customer_id is not null then
      update public.orders o
      set customer_id = v_customer_id,
          customer_name = v_customer_name,
          customer_phone = coalesce(v_customer_phone, o.customer_phone),
          customer_snapshot = coalesce(o.customer_snapshot, '{}'::jsonb) || jsonb_build_object(
            'customer_id', v_customer_id,
            'name', v_customer_name,
            'phone', coalesce(v_customer_phone, o.customer_phone),
            'customer_mode', 'registered',
            'registered_customer', true,
            'identity_verified', true,
            'identity_source', 'authenticated_customer_session'
          ),
          commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
            'customer_id', v_customer_id,
            'customer_mode', 'registered',
            'customer_registered', true,
            'customer_identity_source', 'authenticated_customer_session'
          )
      where o.id = v_order_id
        and o.store_id = v_store_id;

      v_result := jsonb_set(
        v_result,
        '{order}',
        coalesce(v_result->'order', '{}'::jsonb) || jsonb_build_object(
          'customer_id', v_customer_id,
          'customer_name', v_customer_name,
          'customer_phone', v_customer_phone,
          'customer_registered', true
        ),
        true
      );
    end if;
  end if;

  v_result := jsonb_set(
    v_result,
    '{order}',
    coalesce(v_result->'order', '{}'::jsonb) || jsonb_build_object(
      'payment_method', v_payment_enum::text,
      'payment_timing', v_timing,
      'payment_method_code', v_effective_payment_code,
      'promised_payment_method_code', v_promised_method_code,
      'requires_proof', coalesce((v_checkout_metadata->>'requires_proof')::boolean, false),
      'payment_confirmation_mode', case when v_timing = 'pay_now' then v_checkout_metadata->>'confirmation_mode' else 'at_fulfillment' end
    ),
    true
  );


  -- Pay-now PICKUP orders are held only during the store-configured payment window.
  -- Paid orders suspend expiry in the existing trigger. Do not change delivery
  -- reservation lifetimes here (delivery uses a separate stock policy).
  if v_timing='pay_now' and v_fulfillment='pickup' then
    select coalesce(
      (
        select case when coalesce(ss.order_settings->>'prepayment_hold_minutes','') ~ '^[0-9]{1,4}
$function$

                    then greatest(5,least(1440,(ss.order_settings->>'prepayment_hold_minutes')::integer))
                    else null end
        from public.store_settings ss where ss.store_id=v_store_id limit 1
      ),
      (select greatest(5,least(1440,coalesce(s.reservation_time_minutes,10)))
       from public.stores s where s.id=v_store_id),
      10
    ) into v_prepayment_hold_minutes;

    v_prepayment_deadline:=clock_timestamp()+make_interval(mins=>v_prepayment_hold_minutes);

    update public.orders o
    set expires_at=v_prepayment_deadline,
        cancellation_grace_until=v_prepayment_deadline,
        commercial_metadata=coalesce(o.commercial_metadata,'{}'::jsonb)
          || jsonb_build_object('payment_deadline_at',v_prepayment_deadline,
               'prepayment_hold_minutes',v_prepayment_hold_minutes,
               'operational_queue','awaiting_payment')
    where o.id=v_order_id and o.store_id=v_store_id
      and o.status::text='reserved'
      and coalesce(o.payment_status,'pending')<>'paid';

    update public.stock_reservations sr
    set expires_at=v_prepayment_deadline,
        metadata=coalesce(sr.metadata,'{}'::jsonb)
          || jsonb_build_object('prepayment_hold_minutes',v_prepayment_hold_minutes)
    where sr.order_id=v_order_id and sr.store_id=v_store_id and sr.status='active';

    v_result:=jsonb_set(v_result,'{order}',
      coalesce(v_result->'order','{}'::jsonb)
        ||jsonb_build_object('payment_deadline_at',v_prepayment_deadline,
           'prepayment_hold_minutes',v_prepayment_hold_minutes),true);
  end if;

  return v_result;
end;
$function$
;
commit;