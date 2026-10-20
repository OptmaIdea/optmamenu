BEGIN;
-- Existing legacy default remains accept; only explicitly configured 'block' closes checkout.
CREATE OR REPLACE FUNCTION public.store_online_order_hours_status_internal(
  p_store_id uuid,p_at timestamptz DEFAULT clock_timestamp()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $hours$
DECLARE
  v_local timestamp := p_at AT TIME ZONE 'America/Sao_Paulo';
  v_date date := (p_at AT TIME ZONE 'America/Sao_Paulo')::date;
  v_day date;
  v_hour time;
  v_week record;
  v_exception record;
  v_start timestamp;
  v_end timestamp;
  v_next timestamp;
  v_open boolean := false;
  v_can_order boolean;
  v_closed_buffer boolean := false;
  v_mode text;
  v_buffer int := 0;
  v_delta integer;
  v_has_schedule boolean := false;
BEGIN
  SELECT CASE WHEN s.config->>'online_orders_outside_hours'='block' THEN 'block' ELSE 'accept' END,
         LEAST(180,GREATEST(0,CASE WHEN coalesce(s.config->>'closing_buffer_minutes','') ~ '^[0-9]{1,3}$'
          THEN (s.config->>'closing_buffer_minutes')::integer ELSE 0 END))
    INTO v_mode,v_buffer FROM public.stores s
  WHERE s.id=p_store_id AND s.public_store_enabled=true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'can_order',false,'error','store_unavailable');END IF;

  -- Dates are store-local. Yesterday is checked to include overnight shifts.
  FOR v_delta IN -1..7 LOOP
    v_day:=v_date+v_delta;
    v_hour:=null;
    SELECT e.is_closed,e.open_time,e.close_time
      INTO v_exception FROM public.store_schedules_exceptions e
     WHERE e.store_id=p_store_id AND e.exception_date=v_day
     ORDER BY e.created_at DESC LIMIT 1;
    IF FOUND THEN
      IF v_exception.is_closed THEN CONTINUE; END IF;
      IF v_exception.open_time IS NULL OR v_exception.close_time IS NULL THEN CONTINUE; END IF;
      v_hour:=v_exception.open_time;
      v_start:=v_day::timestamp+v_exception.open_time;
      v_end:=v_day::timestamp+v_exception.close_time;
    ELSE
      SELECT h.is_closed,h.open_time,h.close_time
        INTO v_week FROM public.store_hours h
       WHERE h.store_id=p_store_id AND h.day_of_week=EXTRACT(DOW FROM v_day)::int LIMIT 1;
      IF NOT FOUND OR v_week.is_closed OR v_week.open_time IS NULL OR v_week.close_time IS NULL THEN CONTINUE;END IF;
      v_hour:=v_week.open_time;
      v_start:=v_day::timestamp+v_week.open_time;
      v_end:=v_day::timestamp+v_week.close_time;
    END IF;
    v_has_schedule:=true;
    IF v_end<=v_start THEN v_end:=v_end+interval '1 day';END IF;
    IF v_local>=v_start AND v_local<v_end THEN
      v_open:=true;
      IF v_local >= v_end-make_interval(mins=>v_buffer) THEN v_closed_buffer:=true;END IF;
    END IF;
    IF v_start>v_local AND (v_next IS NULL OR v_start<v_next) THEN v_next:=v_start;END IF;
  END LOOP;

  v_can_order := (v_open AND NOT v_closed_buffer) OR v_mode='accept';
  RETURN jsonb_build_object(
    'ok',true,
    'is_open',v_open,
    'can_order',v_can_order,
    'accepting_while_closed',v_can_order AND (NOT v_open OR v_closed_buffer),
    'outside_hours_policy',v_mode,
    'closing_soon',v_open AND v_closed_buffer,
    'next_opening_local',CASE WHEN v_next IS NOT NULL THEN to_char(v_next,'DD/MM/YYYY HH24:MI') ELSE null END,
    'time_zone','America/Sao_Paulo'
  );
END;
$hours$;
REVOKE ALL ON FUNCTION public.store_online_order_hours_status_internal(uuid,timestamptz)
  FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.store_online_order_hours_status_internal(uuid,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.get_public_store_order_hours_by_slug(p_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $status$
DECLARE v_store_id uuid;
BEGIN
 v_store_id:=public.resolve_public_store_id_by_slug(p_slug);
 IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','store_not_found_or_disabled');END IF;
 RETURN public.store_online_order_hours_status_internal(v_store_id);
END;
$status$;
REVOKE ALL ON FUNCTION public.get_public_store_order_hours_by_slug(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_store_order_hours_by_slug(text)
 TO anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.create_public_order_by_slug(p_slug text, p_customer_name text, p_customer_phone text, p_fulfillment_type text, p_sales_channel text, p_items jsonb, p_delivery_address jsonb DEFAULT '{}'::jsonb, p_table_code text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_payment_method_code text DEFAULT 'pending'::text, p_delivery_method_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store_id uuid;
  v_canonical_slug text;
  v_identity_source text;
  v_norm jsonb;
  v_input_phone text;
  v_match_key text;
  v_existing_customer_id uuid;
  v_existing_phone text;
  v_internal_phone text;
  v_result jsonb;
  v_order_id uuid;
  v_transient_customer_id uuid;
  v_display_name text;
  v_eventual_label text;
begin
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);
  if v_store_id is null then
    return jsonb_build_object('ok',false,'error','store_not_found_or_disabled');
  end if;

  -- Applied before any reservation, even on v2/v3 RPC paths.
  if coalesce((public.store_online_order_hours_status_internal(v_store_id)->>'can_order')::boolean,false) is false then
    return jsonb_build_object('ok',false,'error','store_closed');
  end if;

  -- Public checkout may be used without login ONLY for pickup paid at collection.
  -- Authenticated customers must have an active, unrevoked, bound session in this store.
  if (coalesce(p_payment_method_code,'pending') <> 'pending'
      or coalesce(p_fulfillment_type,'pickup') not in ('pickup')) and not (
     public.app_current_role()='customer'
     and public.app_current_customer_id() is not null
     and public.app_current_store_id()=v_store_id
  ) then
    return jsonb_build_object('ok',false,'error','customer_auth_required_for_checkout');
  end if;

  select s.slug into v_canonical_slug
  from public.stores s
  where s.id=v_store_id and s.public_store_enabled=true;
  if v_canonical_slug is null then
    return jsonb_build_object('ok',false,'error','store_not_found_or_disabled');
  end if;

  v_norm := public.normalize_br_customer_phone(p_customer_phone);
  v_input_phone := coalesce(v_norm->>'digits',regexp_replace(coalesce(p_customer_phone,''),'\D','','g'));
  v_match_key := nullif(v_norm->>'match_key','');
  v_display_name := coalesce(nullif(trim(coalesce(p_customer_name,'')),''),'Cliente via site');
  v_identity_source := case when p_sales_channel in ('public_store','whatsapp','qr_table') then p_sales_channel else 'public_store' end;
  v_eventual_label := case
    when v_identity_source='whatsapp' then v_display_name||' (WhatsApp eventual)'
    when v_identity_source='qr_table' then v_display_name||' (QR eventual)'
    else v_display_name||' (site eventual)'
  end;

  if v_match_key is not null then
    select c.id,c.phone into v_existing_customer_id,v_existing_phone
    from public.customers c
    where c.store_id=v_store_id and c.phone_match_key=v_match_key
      and c.status not in ('merged','anonymized','deleted_requested')
    order by c.created_at asc
    limit 1;
  end if;
  v_internal_phone := coalesce(v_existing_phone,v_input_phone);

  perform set_config('app.customer_identity_source',v_identity_source,true);
  v_result := public.create_public_order_by_slug_legacy_internal(
    v_canonical_slug,p_customer_name,v_internal_phone,p_fulfillment_type,p_sales_channel,p_items,
    p_delivery_address,p_table_code,p_notes,p_payment_method_code,p_delivery_method_code
  );

  if coalesce((v_result->>'ok')::boolean,false)=false then
    return v_result;
  end if;

  v_order_id := nullif(v_result->'order'->>'id','')::uuid;
  if v_order_id is null then
    return jsonb_build_object('ok',false,'error','order_result_missing_id');
  end if;

  select o.customer_id into v_transient_customer_id
  from public.orders o where o.id=v_order_id for update;

  update public.orders o
  set customer_id=null,
      customer_name=v_display_name,
      customer_phone=nullif(v_input_phone,''),
      customer_snapshot=jsonb_build_object(
        'name',v_display_name,
        'phone',nullif(v_input_phone,''),
        'display_label',v_eventual_label,
        'source',v_identity_source,
        'customer_mode','eventual',
        'registered_customer',false,
        'identity_verified',false,
        'retention_basis','order_operation',
        'captured_at',now()
      ),
      commercial_metadata=coalesce(o.commercial_metadata,'{}'::jsonb)||jsonb_build_object(
        'customer_mode','eventual',
        'customer_registered',false,
        'customer_display_label',v_eventual_label,
        'provided_phone_unverified',true
      ),
      metadata=coalesce(o.metadata,'{}'::jsonb)||jsonb_build_object(
        'customer_mode','eventual',
        'no_customer_profile_created',true
      )
  where o.id=v_order_id;

  if v_existing_customer_id is null and v_transient_customer_id is not null then
    delete from public.customers c
    where c.id=v_transient_customer_id
      and not exists(select 1 from public.orders o where o.customer_id=c.id);
  end if;

  v_result := jsonb_set(
    v_result,
    '{order}',
    coalesce(v_result->'order','{}'::jsonb)||jsonb_build_object(
      'customer_id',null,
      'customer_name',v_display_name,
      'customer_phone',nullif(v_input_phone,''),
      'customer_display_label',v_eventual_label,
      'customer_mode','eventual',
      'customer_registered',false
    ),
    true
  );
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_public_storefront_by_slug(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_store record;
  v_hours jsonb;
  v_messages jsonb;
  v_whatsapp_digits text;
  v_resolved_store_id uuid;
begin
  v_resolved_store_id := public.resolve_public_store_id_by_slug(p_slug);

  select s.id, s.slug, s.name, s.description, s.logo_url, s.phone_number,
         s.theme_config, s.config, s.minimum_order_value, s.reservation_time_minutes,
         s.privacy_policy_text, s.terms_of_use_text, s.cookie_policy_text,
         s.public_store_enabled, s.public_catalog_enabled, s.contacts
  into v_store
  from public.stores s
  where s.id = v_resolved_store_id
  limit 1;

  if v_store.id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  v_whatsapp_digits := regexp_replace(coalesce(v_store.contacts->>'whatsapp_business', v_store.contacts->>'whatsapp', v_store.phone_number, ''), '\D', '', 'g');

  select coalesce(jsonb_agg(jsonb_build_object('day_of_week', sh.day_of_week, 'open_time', sh.open_time, 'close_time', sh.close_time, 'is_closed', sh.is_closed) order by sh.day_of_week), '[]'::jsonb)
  into v_hours from public.store_hours sh where sh.store_id = v_store.id;

  select coalesce(jsonb_agg(jsonb_build_object('title', sm.title, 'message', sm.message, 'expires_at', sm.expires_at) order by sm.created_at desc), '[]'::jsonb)
  into v_messages from public.store_messages sm
  where sm.store_id = v_store.id and (sm.expires_at is null or sm.expires_at > now());

  return jsonb_build_object('ok', true, 'store', jsonb_build_object(
    'id', v_store.id, 'slug', v_store.slug, 'requested_slug', lower(trim(p_slug)),
    'is_slug_alias', lower(trim(p_slug)) <> lower(v_store.slug),
    'name', v_store.name, 'description', v_store.description, 'logo_url', v_store.logo_url,
    'phone_number', v_store.phone_number, 'theme_config', coalesce(v_store.theme_config, '{}'::jsonb),
    'visual_config', coalesce(v_store.config, '{}'::jsonb), 'minimum_order_value', v_store.minimum_order_value,
    'reservation_time_minutes', v_store.reservation_time_minutes, 'public_catalog_enabled', v_store.public_catalog_enabled,
    'privacy_policy_text', v_store.privacy_policy_text, 'terms_of_use_text', v_store.terms_of_use_text,
    'cookie_policy_text', v_store.cookie_policy_text,
    'whatsapp', jsonb_build_object('raw', coalesce(v_store.contacts->>'whatsapp_business', v_store.contacts->>'whatsapp', v_store.phone_number, ''), 'digits', v_whatsapp_digits, 'enabled', length(v_whatsapp_digits) >= 10),
    'hours', v_hours, 'messages', v_messages,
    'order_hours', public.store_online_order_hours_status_internal(v_store.id)
  ));
end;
$function$
;
COMMIT;