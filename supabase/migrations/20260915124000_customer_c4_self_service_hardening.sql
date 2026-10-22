-- C4 — customer self-service hardening.
--
-- Rules preserved from the customer portal UX/documentation:
-- - profile edits are patch-like and cannot change phone identity;
-- - CPF and birth date become immutable to self-service once populated;
-- - saved delivery addresses are limited to 3 per customer;
-- - self-service RPCs require a real authenticated customer session.

create or replace function public.update_customer_self_profile_safe(
  p_full_name text default null,
  p_nickname text default null,
  p_email text default null,
  p_cpf text default null,
  p_birth_date date default null,
  p_is_whatsapp boolean default null,
  p_contact_preference text default null,
  p_loyalty_opt_in boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_current public.customers%rowtype;
  v_email text;
  v_cpf text;
  v_next_loyalty boolean;
  v_contact_preference text;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  select * into v_current
  from public.customers
  where id = v_customer_id and store_id = v_store_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  if v_current.status not in ('active', 'inactive') then
    return jsonb_build_object('ok', false, 'error', 'customer_not_editable');
  end if;

  v_email := case
    when p_email is null then v_current.email
    else nullif(lower(trim(p_email)), '')
  end;

  v_cpf := case
    when p_cpf is null then v_current.cpf
    else nullif(regexp_replace(p_cpf, '\D', '', 'g'), '')
  end;

  if v_current.cpf is not null and p_cpf is not null and v_cpf is distinct from regexp_replace(v_current.cpf, '\D', '', 'g') then
    return jsonb_build_object('ok', false, 'error', 'cpf_locked');
  end if;

  if v_cpf is not null and length(v_cpf) <> 11 then
    return jsonb_build_object('ok', false, 'error', 'invalid_cpf');
  end if;

  if v_current.birth_date is not null and p_birth_date is not null and p_birth_date is distinct from v_current.birth_date then
    return jsonb_build_object('ok', false, 'error', 'birth_date_locked');
  end if;

  v_contact_preference := coalesce(nullif(trim(p_contact_preference), ''), v_current.contact_preference, 'whatsapp');
  if v_contact_preference not in ('whatsapp', 'sms', 'both') then
    return jsonb_build_object('ok', false, 'error', 'invalid_contact_preference');
  end if;

  v_next_loyalty := coalesce(p_loyalty_opt_in, v_current.loyalty_opt_in, false);

  update public.customers
  set full_name = case when p_full_name is null then v_current.full_name else nullif(trim(p_full_name), '') end,
      nickname = case when p_nickname is null then v_current.nickname else nullif(trim(p_nickname), '') end,
      email = v_email,
      cpf = case when v_current.cpf is not null then v_current.cpf else v_cpf end,
      birth_date = case when v_current.birth_date is not null then v_current.birth_date else p_birth_date end,
      is_whatsapp = coalesce(p_is_whatsapp, v_current.is_whatsapp, true),
      contact_preference = v_contact_preference,
      loyalty_opt_in = v_next_loyalty,
      data_ownership = 'customer_owned',
      editable_by_store = false,
      updated_at = clock_timestamp()
  where id = v_customer_id and store_id = v_store_id;

  if p_loyalty_opt_in is not null
     and v_next_loyalty is distinct from coalesce(v_current.loyalty_opt_in, false) then
    insert into public.customer_consent_logs(
      customer_id, store_id, consent_type, action, source, revoked_at, metadata
    ) values (
      v_customer_id,
      v_store_id,
      'loyalty_program',
      case when v_next_loyalty then 'granted' else 'revoked' end,
      'customer_portal_profile',
      case when v_next_loyalty then null else clock_timestamp() end,
      jsonb_build_object(
        'evidence', 'customer_self_service',
        'previous', v_current.loyalty_opt_in,
        'current', v_next_loyalty
      )
    );
  end if;

  return jsonb_build_object('ok', true, 'customer_id', v_customer_id);
end;
$function$;

create or replace function public.upsert_customer_self_address_safe(
  p_address_id uuid default null,
  p_zip_code text default null,
  p_street text default null,
  p_number text default null,
  p_complement text default null,
  p_district text default null,
  p_city text default null,
  p_state text default null,
  p_is_default boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_id uuid;
  v_zip text := regexp_replace(coalesce(p_zip_code, ''), '\D', '', 'g');
  v_state text := upper(trim(coalesce(p_state, '')));
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = v_customer_id
      and c.store_id = v_store_id
      and c.status in ('active', 'inactive')
  ) then
    return jsonb_build_object('ok', false, 'error', 'customer_not_editable');
  end if;

  if length(v_zip) <> 8
     or length(trim(coalesce(p_street, ''))) < 2
     or length(trim(coalesce(p_number, ''))) < 1
     or length(trim(coalesce(p_district, ''))) < 2
     or length(trim(coalesce(p_city, ''))) < 2
     or v_state !~ '^[A-Z]{2}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_address');
  end if;

  if p_address_id is null
     and (select count(*) from public.customer_addresses where customer_id = v_customer_id) >= 3 then
    return jsonb_build_object('ok', false, 'error', 'address_limit_reached');
  end if;

  if coalesce(p_is_default, false) then
    update public.customer_addresses
    set is_default = false
    where customer_id = v_customer_id;
  end if;

  if p_address_id is null then
    insert into public.customer_addresses(
      customer_id, zip_code, street, number, complement, district, city, state, is_default, created_at
    ) values (
      v_customer_id,
      v_zip,
      trim(p_street),
      trim(p_number),
      nullif(trim(coalesce(p_complement, '')), ''),
      trim(p_district),
      trim(p_city),
      v_state,
      coalesce(p_is_default, false),
      clock_timestamp()
    ) returning id into v_id;
  else
    update public.customer_addresses ca
    set zip_code = v_zip,
        street = trim(p_street),
        number = trim(p_number),
        complement = nullif(trim(coalesce(p_complement, '')), ''),
        district = trim(p_district),
        city = trim(p_city),
        state = v_state,
        is_default = coalesce(p_is_default, false)
    where ca.id = p_address_id
      and ca.customer_id = v_customer_id
    returning ca.id into v_id;

    if v_id is null then
      return jsonb_build_object('ok', false, 'error', 'address_not_found');
    end if;
  end if;

  if not exists (
    select 1 from public.customer_addresses
    where customer_id = v_customer_id and is_default = true
  ) then
    update public.customer_addresses set is_default = true where id = v_id;
  end if;

  return jsonb_build_object('ok', true, 'address_id', v_id);
end;
$function$;

-- These RPCs are post-authentication self-service surfaces. Anon callers do not
-- need EXECUTE anymore; the logical customer identity is resolved from auth.uid().
revoke all on function public.get_customer_self_profile_safe() from public, anon;
revoke all on function public.update_customer_self_profile_safe(text, text, text, text, date, boolean, text, boolean) from public, anon;
revoke all on function public.get_customer_self_addresses_safe() from public, anon;
revoke all on function public.upsert_customer_self_address_safe(uuid, text, text, text, text, text, text, text, boolean) from public, anon;
revoke all on function public.delete_customer_self_address_safe(uuid) from public, anon;
revoke all on function public.get_customer_self_notifications_safe(integer) from public, anon;
revoke all on function public.mark_customer_self_notification_read_safe(uuid, boolean) from public, anon;

grant execute on function public.get_customer_self_profile_safe() to authenticated, service_role;
grant execute on function public.update_customer_self_profile_safe(text, text, text, text, date, boolean, text, boolean) to authenticated, service_role;
grant execute on function public.get_customer_self_addresses_safe() to authenticated, service_role;
grant execute on function public.upsert_customer_self_address_safe(uuid, text, text, text, text, text, text, text, boolean) to authenticated, service_role;
grant execute on function public.delete_customer_self_address_safe(uuid) to authenticated, service_role;
grant execute on function public.get_customer_self_notifications_safe(integer) to authenticated, service_role;
grant execute on function public.mark_customer_self_notification_read_safe(uuid, boolean) to authenticated, service_role;
