-- PIX payment confirmation must settle financially without expiring paid reservations.
-- Also supports manual conference when proof arrives outside the app (WhatsApp/e-mail/bank statement).

-- admin_accept_public_order_safe_internal_0d(uuid)
CREATE OR REPLACE FUNCTION public.admin_accept_public_order_safe_internal_0d(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order record;
  v_minutes integer := 10;
  v_grace integer := 5;
  v_available_until timestamptz;
  v_grace_until timestamptz;
  v_should_keep_timer boolean := true;
begin
  select o.id,o.store_id,o.order_code,o.status,o.payment_status,o.fulfillment_type,s.config,s.reservation_time_minutes
  into v_order
  from public.orders o
  join public.stores s on s.id=o.store_id
  where o.id=p_order_id;

  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  if auth.uid() is null or not public.is_store_member(v_order.store_id) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if v_order.status::text not in ('reserved','confirmed') then
    return jsonb_build_object('ok',false,'error','invalid_status','current_status',v_order.status::text);
  end if;

  v_should_keep_timer := coalesce(v_order.payment_status::text,'pending') <> 'paid'
                         and coalesce(v_order.fulfillment_type::text,'pickup') <> 'delivery';

  if v_should_keep_timer then
    v_minutes := greatest(1,coalesce((v_order.config->>'timer_duration_minutes')::int,v_order.reservation_time_minutes,10));
    v_grace := greatest(0,coalesce((v_order.config->>'expiration_grace_minutes')::int,5));
    v_available_until := now() + make_interval(mins=>v_minutes);
    v_grace_until := v_available_until + make_interval(mins=>v_grace);

    update public.stock_reservations
    set expires_at=v_available_until,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('accepted_at',now(),'grace_until',v_grace_until)
    where order_id=v_order.id and status='active';
  else
    v_available_until := null;
    v_grace_until := null;

    update public.stock_reservations
    set expires_at=null,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'accepted_at',now(),
          'timer_suspended_at',now(),
          'timer_suspended_reason',case when coalesce(v_order.payment_status::text,'pending')='paid' then 'payment_confirmed' else 'delivery_order' end
        )
    where order_id=v_order.id and status='active';
  end if;

  update public.orders
  set status='confirmed',
      confirmed_at=coalesce(confirmed_at,now()),
      expires_at=case when v_should_keep_timer then v_available_until else null end,
      available_until=v_available_until,
      cancellation_grace_until=v_grace_until,
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
        'accepted_at',now(),
        'accepted_by',auth.uid(),
        'availability_minutes',case when v_should_keep_timer then v_minutes else null end,
        'grace_minutes',case when v_should_keep_timer then v_grace else null end,
        'timer_suspended_reason',case when v_should_keep_timer then null when coalesce(v_order.payment_status::text,'pending')='paid' then 'payment_confirmed' else 'delivery_order' end
      )
  where id=v_order.id;

  return jsonb_build_object('ok',true,'order_id',v_order.id,'order_code',v_order.order_code,'status','confirmed','available_until',v_available_until,'cancellation_grace_until',v_grace_until,'timer_active',v_should_keep_timer);
end;
$function$;

-- admin_mark_public_order_ready_safe_internal_0d(uuid)
CREATE OR REPLACE FUNCTION public.admin_mark_public_order_ready_safe_internal_0d(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order record;
  v_ready_hold_minutes integer;
  v_grace_minutes integer;
  v_current_expires_at timestamptz;
  v_new_expires_at timestamptz;
  v_grace_until timestamptz;
  v_should_keep_timer boolean := true;
begin
  select o.id,o.store_id,o.order_code,o.status,o.public_order_token,o.payment_status,o.fulfillment_type,
         coalesce((s.config->>'ready_hold_minutes')::integer,5) as ready_hold_minutes,
         coalesce((s.config->>'expiration_grace_minutes')::integer,5) as grace_minutes
    into v_order
  from public.orders o
  join public.stores s on s.id=o.store_id
  where o.id=p_order_id;

  if v_order.id is null then
    return jsonb_build_object('ok',false,'error','order_not_found');
  end if;

  if auth.uid() is null or not public.is_store_member(v_order.store_id) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if v_order.status::text not in ('confirmed','ready') then
    return jsonb_build_object('ok',false,'error','invalid_status','current_status',v_order.status::text);
  end if;

  v_should_keep_timer := coalesce(v_order.payment_status::text,'pending') <> 'paid'
                         and coalesce(v_order.fulfillment_type::text,'pickup') <> 'delivery';

  if v_should_keep_timer then
    v_ready_hold_minutes := greatest(0,coalesce(v_order.ready_hold_minutes,5));
    v_grace_minutes := greatest(0,coalesce(v_order.grace_minutes,5));

    select max(sr.expires_at)
      into v_current_expires_at
    from public.stock_reservations sr
    where sr.order_id=v_order.id and sr.status='active';

    v_new_expires_at := greatest(coalesce(v_current_expires_at,now()),now())
                        + make_interval(mins => v_ready_hold_minutes);
    v_grace_until := v_new_expires_at + make_interval(mins => v_grace_minutes);

    update public.stock_reservations
       set expires_at=v_new_expires_at,
           metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
             'ready_extended_at',now(),
             'ready_hold_minutes',v_ready_hold_minutes,
             'ready_extended_by',auth.uid()
           )
     where order_id=v_order.id and status='active';
  else
    v_new_expires_at := null;
    v_grace_until := null;

    update public.stock_reservations
       set expires_at=null,
           metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
             'ready_at',now(),
             'timer_suspended_at',now(),
             'timer_suspended_reason',case when coalesce(v_order.payment_status::text,'pending')='paid' then 'payment_confirmed' else 'delivery_order' end
           )
     where order_id=v_order.id and status='active';
  end if;

  update public.orders
     set status='ready',
         ready_at=coalesce(ready_at,now()),
         expires_at=case when v_should_keep_timer then v_new_expires_at else null end,
         available_until=v_new_expires_at,
         cancellation_grace_until=v_grace_until,
         commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
           'ready_at',now(),
           'ready_by',auth.uid(),
           'ready_hold_minutes',case when v_should_keep_timer then v_ready_hold_minutes else null end,
           'ready_extended_from_remaining',v_should_keep_timer,
           'timer_suspended_reason',case when v_should_keep_timer then null when coalesce(v_order.payment_status::text,'pending')='paid' then 'payment_confirmed' else 'delivery_order' end
         )
   where id=v_order.id;

  return jsonb_build_object(
    'ok',true,
    'order_id',v_order.id,
    'order_code',v_order.order_code,
    'status','ready',
    'ready_at',now(),
    'expires_at',v_new_expires_at,
    'cancellation_grace_until',v_grace_until,
    'ready_hold_minutes',case when v_should_keep_timer then v_ready_hold_minutes else null end,
    'payment_status',coalesce(v_order.payment_status::text,'pending'),
    'timer_active',v_should_keep_timer
  );
end;
$function$;

-- confirm_order_external_pix_payment_safe(uuid,uuid,uuid,text)
CREATE OR REPLACE FUNCTION public.confirm_order_external_pix_payment_safe(p_store_id uuid, p_order_id uuid, p_financial_account_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_order record;
  v_method record;
  v_account_id uuid;
  v_configured_account_id uuid;
  v_account_active boolean;
  v_account_has_routes boolean := false;
  v_account_accepts boolean := false;
  v_entry_id uuid;
  v_entry_code text;
  v_existing_entry_id uuid;
  v_existing_entry_code text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id, 'financial.manage')
    or public.user_has_store_permission_v2(p_store_id, 'cashbook.create')
  ) then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  select o.id, o.store_id, o.order_code, o.status::text as status, o.payment_status,
         o.payment_method_code, o.total, o.customer_id, o.customer_name, o.fulfillment_type
    into v_order
  from public.orders o
  where o.id = p_order_id and o.store_id = p_store_id
  for update;

  if v_order.id is null then
    return jsonb_build_object('ok', false, 'error', 'order_not_found');
  end if;

  if v_order.status not in ('reserved','confirmed','ready') then
    return jsonb_build_object('ok', false, 'error', 'order_not_eligible', 'status', v_order.status);
  end if;

  if coalesce(v_order.payment_status, 'pending') = 'paid' then
    select ce.id, ce.entry_code
      into v_existing_entry_id, v_existing_entry_code
    from public.cashbook_entries ce
    where ce.store_id = p_store_id
      and ce.order_id = v_order.id
      and ce.type = 'sale'
      and ce.direction = 'in'
      and ce.status = 'confirmed'
      and ce.affects_balance = true
    order by ce.created_at desc
    limit 1;

    update public.orders
       set expires_at = null,
           available_until = null,
           cancellation_grace_until = null,
           payment_metadata = coalesce(payment_metadata, '{}'::jsonb) || jsonb_build_object('timer_suspended_reason', 'payment_confirmed'),
           commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object('timer_suspended_reason', 'payment_confirmed')
     where id = v_order.id;

    update public.stock_reservations
       set expires_at = null,
           metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('timer_suspended_at', now(), 'timer_suspended_reason', 'payment_confirmed')
     where order_id = v_order.id and status = 'active';

    return jsonb_build_object(
      'ok', true,
      'already_confirmed', true,
      'payment_status', 'paid',
      'cashbook_entry_id', v_existing_entry_id,
      'cashbook_entry_code', v_existing_entry_code
    );
  end if;

  select pm.code, pm.name, coalesce(pm.base_code, pm.code) as base_code,
         pm.preferred_financial_account_id, pm.requires_proof
    into v_method
  from public.store_payment_methods pm
  where pm.store_id = p_store_id
    and pm.code = v_order.payment_method_code
    and pm.active = true
  limit 1;

  if v_method.code is null or v_method.base_code <> 'pix' then
    return jsonb_build_object('ok', false, 'error', 'not_pix_order');
  end if;

  select a.id
    into v_configured_account_id
  from public.store_online_payment_providers provider
  join public.store_financial_accounts a
    on a.id = nullif(provider.public_config->>'settlement_financial_account_id','')::uuid
   and a.store_id = provider.store_id
   and a.active = true
  where provider.store_id = p_store_id
    and provider.provider_code = 'asaas'
    and provider.enabled = true
  limit 1;

  if v_configured_account_id is null and v_method.preferred_financial_account_id is not null then
    select a.id
      into v_configured_account_id
    from public.store_financial_accounts a
    where a.store_id = p_store_id
      and a.active = true
      and a.id = v_method.preferred_financial_account_id
    limit 1;
  end if;

  if v_method.code = 'pix_manual_qr' and v_configured_account_id is not null then
    v_account_id := v_configured_account_id;
  else
    v_account_id := coalesce(p_financial_account_id, v_configured_account_id);
  end if;

  if v_account_id is null then
    select a.id into v_account_id
    from public.store_financial_accounts a
    where a.store_id = p_store_id
      and a.active = true
      and a.is_sales_clearing_default = true
    order by a.sort_order, a.name
    limit 1;
  end if;

  if v_account_id is null then
    return jsonb_build_object('ok', false, 'error', 'financial_account_required');
  end if;

  select a.active into v_account_active
  from public.store_financial_accounts a
  where a.id = v_account_id and a.store_id = p_store_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_financial_account');
  end if;

  if v_account_active is not true then
    return jsonb_build_object('ok', false, 'error', 'financial_account_inactive');
  end if;

  select exists(
    select 1
    from public.store_financial_account_payment_methods ap
    where ap.store_id = p_store_id
      and ap.account_id = v_account_id
      and ap.active = true
  ) into v_account_has_routes;

  if v_account_has_routes then
    select exists(
      select 1
      from public.store_financial_account_payment_methods ap
      where ap.store_id = p_store_id
        and ap.account_id = v_account_id
        and ap.active = true
        and ap.payment_method_code in (v_method.code, v_method.base_code)
    ) into v_account_accepts;

    if not v_account_accepts then
      return jsonb_build_object('ok', false, 'error', 'account_does_not_accept_pix');
    end if;
  end if;

  select ce.id, ce.entry_code
    into v_existing_entry_id, v_existing_entry_code
  from public.cashbook_entries ce
  where ce.store_id = p_store_id
    and ce.order_id = v_order.id
    and ce.type = 'sale'
    and ce.direction = 'in'
    and ce.status = 'confirmed'
    and ce.affects_balance = true
  order by ce.created_at desc
  limit 1;

  if v_existing_entry_id is not null then
    return jsonb_build_object('ok', false, 'error', 'financial_entry_already_exists', 'cashbook_entry_id', v_existing_entry_id, 'cashbook_entry_code', v_existing_entry_code);
  end if;

  v_entry_code := public.generate_cashbook_entry_code();

  insert into public.cashbook_entries (
    store_id, entry_code, entry_date, occurred_at, type, direction, amount,
    description, notes, payment_method, payment_method_code,
    source, source_id, order_id, customer_id, status, affects_balance,
    metadata, created_by, destination_financial_account_id, is_transfer
  ) values (
    p_store_id,
    v_entry_code,
    current_date,
    now(),
    'sale',
    'in',
    v_order.total,
    'Pagamento PIX conferido externamente do pedido ' || v_order.order_code,
    nullif(trim(coalesce(p_notes, '')), ''),
    v_method.name,
    v_method.code,
    'order',
    v_order.id,
    v_order.id,
    v_order.customer_id,
    'confirmed',
    true,
    jsonb_build_object(
      'order_code', v_order.order_code,
      'customer_name', v_order.customer_name,
      'payment_confirmation_source', 'external_proof_review',
      'external_proof_channel', 'whatsapp_email_or_manual_conference',
      'reviewed_by', auth.uid(),
      'reviewed_at', now(),
      'financial_account_id', v_account_id,
      'settlement_route_source', case when v_account_id = v_configured_account_id then 'online_provider_settlement_account' else 'manual_selection' end
    ),
    auth.uid(),
    v_account_id,
    false
  ) returning id into v_entry_id;

  update public.orders
     set status = case when status::text = 'reserved' then 'confirmed'::public.order_status else status end,
         confirmed_at = coalesce(confirmed_at, now()),
         payment_status = 'paid',
         payment_method = 'pix'::public.payment_method,
         payment_method_code = v_method.code,
         expires_at = null,
         available_until = null,
         cancellation_grace_until = null,
         payment_metadata = coalesce(payment_metadata, '{}'::jsonb) || jsonb_build_object(
           'paid_at', now(),
           'paid_by_source', 'external_proof_review',
           'confirmed_at', now(),
           'confirmed_by', auth.uid(),
           'payment_method_code', v_method.code,
           'proof_status', 'external_confirmed',
           'cashbook_entry_id', v_entry_id,
           'cashbook_entry_code', v_entry_code,
           'financial_account_id', v_account_id,
           'settlement_route_source', case when v_account_id = v_configured_account_id then 'online_provider_settlement_account' else 'manual_selection' end
         ),
         commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object(
           'accepted_at', case when v_order.status = 'reserved' then now() else null end,
           'accepted_by', case when v_order.status = 'reserved' then auth.uid() else null end,
           'cashbook_entry_id', v_entry_id,
           'cashbook_entry_code', v_entry_code,
           'financial_posted', true,
           'payment_confirmation_source', 'external_proof_review',
           'timer_suspended_reason', 'payment_confirmed'
         )
   where id = v_order.id and store_id = p_store_id;

  update public.stock_reservations
     set expires_at = null,
         metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('timer_suspended_at', now(), 'timer_suspended_reason', 'payment_confirmed')
   where order_id = v_order.id and status = 'active';

  return jsonb_build_object(
    'ok', true,
    'status', 'confirmed',
    'payment_status', 'paid',
    'order_status', case when v_order.status = 'reserved' then 'confirmed' else v_order.status end,
    'cashbook_entry_id', v_entry_id,
    'cashbook_entry_code', v_entry_code,
    'financial_account_id', v_account_id,
    'payment_method_code', v_method.code,
    'payment_method_name', v_method.name,
    'amount', v_order.total
  );
end;
$function$;

-- review_order_payment_proof_safe(uuid,uuid,text,uuid,text)
CREATE OR REPLACE FUNCTION public.review_order_payment_proof_safe(p_store_id uuid, p_proof_id uuid, p_decision text, p_financial_account_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_proof record;
  v_order record;
  v_method record;
  v_account_id uuid;
  v_configured_account_id uuid;
  v_account_active boolean;
  v_account_has_routes boolean := false;
  v_account_accepts boolean := false;
  v_entry_id uuid;
  v_entry_code text;
  v_existing_entry_id uuid;
  v_existing_entry_code text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'financial.manage') or public.user_has_store_permission_v2(p_store_id,'cashbook.create')) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if p_decision not in ('confirm','reject') then return jsonb_build_object('ok',false,'error','invalid_decision'); end if;

  select p.* into v_proof from public.order_payment_proofs p where p.id=p_proof_id and p.store_id=p_store_id for update;
  if v_proof.id is null then return jsonb_build_object('ok',false,'error','proof_not_found'); end if;

  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total,o.customer_id,o.customer_name
  into v_order from public.orders o where o.id=v_proof.order_id and o.store_id=p_store_id for update;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;

  if v_proof.status='confirmed' then return jsonb_build_object('ok',true,'already_confirmed',true,'proof_id',v_proof.id,'cashbook_entry_id',v_proof.cashbook_entry_id); end if;
  if v_proof.status<>'submitted' then return jsonb_build_object('ok',false,'error','proof_not_submitted','status',v_proof.status); end if;

  if p_decision='reject' then
    if length(trim(coalesce(p_notes,'')))<3 then return jsonb_build_object('ok',false,'error','rejection_reason_required'); end if;
    update public.order_payment_proofs set status='rejected',decided_at=now(),decided_by=auth.uid(),decision_source='manual_proof_review',decision_notes=trim(p_notes),updated_at=now() where id=v_proof.id;
    update public.orders set payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
      'payment_proof_id',v_proof.id,'proof_status','rejected','proof_reviewed_at',now(),'proof_reviewed_by',auth.uid(),'proof_rejection_reason',trim(p_notes)
    ) where id=v_order.id;
    return jsonb_build_object('ok',true,'proof_id',v_proof.id,'status','rejected');
  end if;

  if v_order.status not in ('reserved','confirmed','ready') then return jsonb_build_object('ok',false,'error','order_not_eligible','status',v_order.status); end if;
  if coalesce(v_order.payment_status,'pending')='paid' then return jsonb_build_object('ok',false,'error','payment_already_confirmed'); end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.preferred_financial_account_id,pm.requires_proof
  into v_method from public.store_payment_methods pm
  where pm.store_id=p_store_id and pm.code=v_order.payment_method_code and pm.active=true limit 1;

  if v_method.code is null or v_method.base_code<>'pix' then return jsonb_build_object('ok',false,'error','not_pix_order'); end if;
  if coalesce(v_method.requires_proof,false)=false then return jsonb_build_object('ok',false,'error','proof_not_required'); end if;

  select a.id
    into v_configured_account_id
  from public.store_online_payment_providers provider
  join public.store_financial_accounts a
    on a.id = nullif(provider.public_config->>'settlement_financial_account_id','')::uuid
   and a.store_id = provider.store_id
   and a.active = true
  where provider.store_id = p_store_id
    and provider.provider_code = 'asaas'
    and provider.enabled = true
  limit 1;

  if v_configured_account_id is null and v_method.preferred_financial_account_id is not null then
    select a.id into v_configured_account_id
    from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and a.id=v_method.preferred_financial_account_id
    limit 1;
  end if;

  if v_method.code = 'pix_manual_qr' and v_configured_account_id is not null then
    v_account_id := v_configured_account_id;
  else
    v_account_id := coalesce(p_financial_account_id, v_configured_account_id);
  end if;

  if v_account_id is null then
    select a.id into v_account_id from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and a.id=v_method.preferred_financial_account_id limit 1;
  end if;
  if v_account_id is null then
    select a.id into v_account_id from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and a.is_sales_clearing_default=true order by a.sort_order,a.name limit 1;
  end if;
  if v_account_id is null then
    select a.id into v_account_id from public.store_financial_accounts a
    where a.store_id=p_store_id and a.active=true and (
      not exists(select 1 from public.store_financial_account_payment_methods ap0 where ap0.store_id=p_store_id and ap0.account_id=a.id and ap0.active=true)
      or exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=a.id and ap.active=true and ap.payment_method_code in (v_method.code,v_method.base_code))
    ) order by a.sort_order,a.name limit 1;
  end if;
  if v_account_id is null then return jsonb_build_object('ok',false,'error','financial_account_required'); end if;

  select a.active into v_account_active from public.store_financial_accounts a where a.id=v_account_id and a.store_id=p_store_id;
  if not found then return jsonb_build_object('ok',false,'error','invalid_financial_account'); end if;
  if v_account_active is not true then return jsonb_build_object('ok',false,'error','financial_account_inactive'); end if;

  select exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=v_account_id and ap.active=true) into v_account_has_routes;
  if v_account_has_routes then
    select exists(select 1 from public.store_financial_account_payment_methods ap where ap.store_id=p_store_id and ap.account_id=v_account_id and ap.active=true and ap.payment_method_code in (v_method.code,v_method.base_code)) into v_account_accepts;
    if not v_account_accepts then return jsonb_build_object('ok',false,'error','account_does_not_accept_pix'); end if;
  end if;

  select ce.id,ce.entry_code into v_existing_entry_id,v_existing_entry_code
  from public.cashbook_entries ce where ce.store_id=p_store_id and ce.order_id=v_order.id and ce.type='sale' and ce.direction='in' and ce.status='confirmed' and ce.affects_balance=true
  order by ce.created_at desc limit 1;
  if v_existing_entry_id is not null then return jsonb_build_object('ok',false,'error','financial_entry_already_exists','cashbook_entry_id',v_existing_entry_id,'cashbook_entry_code',v_existing_entry_code); end if;

  v_entry_code := public.generate_cashbook_entry_code();
  insert into public.cashbook_entries (
    store_id,entry_code,entry_date,occurred_at,type,direction,amount,description,notes,payment_method,payment_method_code,
    source,source_id,order_id,customer_id,status,affects_balance,metadata,created_by,destination_financial_account_id,is_transfer
  ) values (
    p_store_id,v_entry_code,current_date,now(),'sale','in',v_order.total,'Pagamento antecipado confirmado do pedido '||v_order.order_code,
    nullif(trim(coalesce(p_notes,'')),''),v_method.name,v_method.code,'order',v_order.id,v_order.id,v_order.customer_id,'confirmed',true,
    jsonb_build_object('order_code',v_order.order_code,'customer_name',v_order.customer_name,'payment_confirmation_source','manual_proof_review',
      'payment_proof_id',v_proof.id,'payment_proof_storage_path',v_proof.storage_path,'declared_amount',v_proof.declared_amount,
      'declared_paid_at',v_proof.declared_paid_at,'reviewed_by',auth.uid(),'reviewed_at',now(),'financial_account_id',v_account_id,
      'settlement_route_source',case when v_account_id = v_configured_account_id then 'online_provider_settlement_account' else 'manual_selection' end),
    auth.uid(),v_account_id,false
  ) returning id into v_entry_id;

  update public.order_payment_proofs set status='confirmed',decided_at=now(),decided_by=auth.uid(),decision_source='manual_proof_review',
    decision_notes=nullif(trim(coalesce(p_notes,'')),''),cashbook_entry_id=v_entry_id,financial_account_id=v_account_id,updated_at=now() where id=v_proof.id;
  update public.order_payment_proofs set status='superseded',decision_source='payment_confirmed_with_other_proof',decision_notes='Outro comprovante deste pedido foi confirmado.',decided_at=now(),updated_at=now()
  where order_id=v_order.id and id<>v_proof.id and status='submitted';

  update public.orders set
    status=case when status::text='reserved' then 'confirmed'::public.order_status else status end,
    confirmed_at=coalesce(confirmed_at,now()),
    payment_status='paid',payment_method='pix'::public.payment_method,payment_method_code=v_method.code,
    proof_url='storage://'||v_proof.storage_bucket||'/'||v_proof.storage_path,
    expires_at=null,
    available_until=null,
    cancellation_grace_until=null,
    payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
      'paid_at',now(),'paid_by_source','manual_proof_review','confirmed_at',now(),'confirmed_by',auth.uid(),
      'payment_method_code',v_method.code,'payment_proof_id',v_proof.id,'proof_status','confirmed','proof_reviewed_at',now(),
      'proof_reviewed_by',auth.uid(),'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_account_id',v_account_id,
      'settlement_route_source',case when v_account_id = v_configured_account_id then 'online_provider_settlement_account' else 'manual_selection' end
    ),
    commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)||jsonb_build_object(
      'accepted_at',case when v_order.status='reserved' then now() else null end,
      'accepted_by',case when v_order.status='reserved' then auth.uid() else null end,
      'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_posted',true,'payment_confirmation_source','manual_proof_review','timer_suspended_reason','payment_confirmed'
    ) where id=v_order.id and store_id=p_store_id;

  update public.stock_reservations
  set expires_at=null,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('timer_suspended_at',now(),'timer_suspended_reason','payment_confirmed')
  where order_id=v_order.id and status='active';

  return jsonb_build_object('ok',true,'proof_id',v_proof.id,'status','confirmed','payment_status','paid',
    'order_status',case when v_order.status='reserved' then 'confirmed' else v_order.status end,
    'cashbook_entry_id',v_entry_id,'cashbook_entry_code',v_entry_code,'financial_account_id',v_account_id,
    'payment_method_code',v_method.code,'payment_method_name',v_method.name,'amount',v_order.total);
end;
$function$;

-- Keep online PIX and manual QR PIX tied to the settlement account configured for the active Asaas provider.
with asaas_routes as (
  select provider.store_id,
         nullif(provider.public_config->>'settlement_financial_account_id','')::uuid as account_id
  from public.store_online_payment_providers provider
  join public.store_financial_accounts account
    on account.id = nullif(provider.public_config->>'settlement_financial_account_id','')::uuid
   and account.store_id = provider.store_id
   and account.active = true
  where provider.provider_code = 'asaas'
    and provider.enabled = true
    and nullif(provider.public_config->>'settlement_financial_account_id','') is not null
)
update public.store_payment_methods method
   set preferred_financial_account_id = route.account_id,
       updated_at = now()
  from asaas_routes route
 where method.store_id = route.store_id
   and method.code in ('pix', 'pix_manual_qr')
   and method.active = true
   and method.preferred_financial_account_id is distinct from route.account_id;

-- Move confirmed PIX entries posted since the online-payment homologation to the configured provider account.
with asaas_routes as (
  select provider.store_id,
         nullif(provider.public_config->>'settlement_financial_account_id','')::uuid as account_id
  from public.store_online_payment_providers provider
  join public.store_financial_accounts account
    on account.id = nullif(provider.public_config->>'settlement_financial_account_id','')::uuid
   and account.store_id = provider.store_id
   and account.active = true
  where provider.provider_code = 'asaas'
    and provider.enabled = true
    and nullif(provider.public_config->>'settlement_financial_account_id','') is not null
)
update public.cashbook_entries entry
   set destination_financial_account_id = route.account_id,
       metadata = coalesce(entry.metadata, '{}'::jsonb)
         || jsonb_build_object(
              'financial_account_id', route.account_id,
              'settlement_route_source', 'online_provider_settlement_account',
              'settlement_rerouted_at', now()
            )
  from public.orders ord
  join asaas_routes route on route.store_id = ord.store_id
 where entry.order_id = ord.id
   and entry.store_id = ord.store_id
   and entry.type = 'sale'
   and entry.direction = 'in'
   and entry.status = 'confirmed'
   and entry.affects_balance = true
   and ord.created_at >= timestamp with time zone '2026-08-24 00:00:00+00'
   and coalesce(ord.payment_method_code, entry.payment_method_code, '') in ('pix', 'pix_manual_qr', 'asaas_pix')
   and entry.destination_financial_account_id is distinct from route.account_id;

-- Paid PIX orders no longer expire automatically; fulfillment controls physical stock movement.
update public.orders
   set expires_at = null,
       available_until = null,
       cancellation_grace_until = null,
       payment_metadata = coalesce(payment_metadata, '{}'::jsonb)
         || jsonb_build_object('timer_suspended_reason', 'payment_confirmed'),
       commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb)
         || jsonb_build_object('timer_suspended_reason', 'payment_confirmed')
 where created_at >= timestamp with time zone '2026-08-24 00:00:00+00'
   and payment_status = 'paid'
   and coalesce(payment_method_code, '') in ('pix', 'pix_manual_qr', 'asaas_pix')
   and (expires_at is not null or available_until is not null or cancellation_grace_until is not null);

update public.stock_reservations reservation
   set expires_at = null,
       metadata = coalesce(reservation.metadata, '{}'::jsonb)
         || jsonb_build_object('timer_suspended_at', now(), 'timer_suspended_reason', 'payment_confirmed')
  from public.orders ord
 where reservation.order_id = ord.id
   and reservation.status = 'active'
   and ord.created_at >= timestamp with time zone '2026-08-24 00:00:00+00'
   and ord.payment_status = 'paid'
   and coalesce(ord.payment_method_code, '') in ('pix', 'pix_manual_qr', 'asaas_pix')
   and reservation.expires_at is not null;

revoke all on function public.confirm_order_external_pix_payment_safe(uuid, uuid, uuid, text) from public;
grant execute on function public.confirm_order_external_pix_payment_safe(uuid, uuid, uuid, text) to authenticated;
