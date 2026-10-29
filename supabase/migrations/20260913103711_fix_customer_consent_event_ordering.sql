create or replace function public.set_customer_self_consent_safe(
  p_consent_type text,
  p_granted boolean,
  p_terms_version text default null::text,
  p_privacy_version text default null::text,
  p_source text default 'customer_portal'::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_action text := case when coalesce(p_granted,false) then 'granted' else 'revoked' end;
  v_event_at timestamptz := clock_timestamp();
  v_marketing_consent boolean := false;
  v_loyalty_opt_in boolean := false;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_consent_type not in ('loyalty_program','marketing_whatsapp','marketing_email','marketing_sms') then
    return jsonb_build_object('ok',false,'error','invalid_consent_type');
  end if;

  insert into public.customer_consent_logs(
    customer_id, store_id, consent_type, action,
    terms_version, privacy_version, source, revoked_at, metadata, created_at
  )
  values(
    v_customer_id, v_store_id, p_consent_type, v_action,
    p_terms_version, p_privacy_version,
    coalesce(nullif(trim(p_source), ''), 'customer_portal'),
    case when v_action='revoked' then v_event_at else null end,
    jsonb_build_object('recorded_by','customer_self_service'),
    v_event_at
  );

  select exists (
    select 1
    from (
      select distinct on (consent_type)
        consent_type,
        action
      from public.customer_consent_logs
      where customer_id = v_customer_id
        and store_id = v_store_id
        and consent_type in ('marketing_whatsapp','marketing_email','marketing_sms')
      order by consent_type, created_at desc, id desc
    ) latest
    where latest.action = 'granted'
  )
  into v_marketing_consent;

  select coalesce((
    select action = 'granted'
    from public.customer_consent_logs
    where customer_id = v_customer_id
      and store_id = v_store_id
      and consent_type = 'loyalty_program'
    order by created_at desc, id desc
    limit 1
  ), false)
  into v_loyalty_opt_in;

  update public.customers
  set
    marketing_consent = v_marketing_consent,
    loyalty_opt_in = v_loyalty_opt_in,
    updated_at = clock_timestamp()
  where id = v_customer_id
    and store_id = v_store_id;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  return jsonb_build_object(
    'ok',true,
    'consent_type',p_consent_type,
    'action',v_action,
    'marketing_consent',v_marketing_consent,
    'loyalty_opt_in',v_loyalty_opt_in,
    'recorded_at',v_event_at
  );
end;
$function$;

revoke all on function public.set_customer_self_consent_safe(text, boolean, text, text, text) from public;
grant execute on function public.set_customer_self_consent_safe(text, boolean, text, text, text) to authenticated;
