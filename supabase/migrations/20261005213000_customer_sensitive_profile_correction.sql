begin;

create table if not exists public.customer_profile_sensitive_change_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id_snapshot uuid not null,
  fields_changed text[] not null,
  source text not null default 'customer_portal',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.customer_profile_sensitive_change_audit enable row level security;
revoke all on table public.customer_profile_sensitive_change_audit from public, anon, authenticated;

create or replace function public.change_customer_self_sensitive_profile_safe(
  p_password text,
  p_otp text,
  p_cpf text default null,
  p_birth_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_credential public.customer_credentials%rowtype;
  v_otp_row public.customer_otps%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_attempts integer;
  v_clean_otp text := regexp_replace(coalesce(p_otp, ''), '\D', '', 'g');
  v_clean_cpf text;
  v_current_cpf text;
  v_fields text[] := array[]::text[];
  v_cpf_changed boolean := false;
  v_birth_changed boolean := false;
begin
  if public.app_current_role() <> 'customer'
     or v_customer_id is null
     or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  if length(coalesce(p_password, '')) < 1 or length(v_clean_otp) <> 6 then
    return jsonb_build_object('ok', false, 'error', 'strong_reauth_required');
  end if;

  select *
  into v_customer
  from public.customers
  where id = v_customer_id
    and store_id = v_store_id
    and coalesce(status, 'active') = 'active'
    and merged_into_customer_id is null
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  v_current_cpf := regexp_replace(coalesce(v_customer.cpf, ''), '\D', '', 'g');

  if p_cpf is not null then
    v_clean_cpf := regexp_replace(p_cpf, '\D', '', 'g');
    if length(v_clean_cpf) <> 11 or v_clean_cpf ~ '^([0-9])\1{10}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_cpf');
    end if;

    v_cpf_changed := v_clean_cpf is distinct from v_current_cpf;

    if v_cpf_changed then
      if exists (
        select 1
        from public.customers c
        where c.store_id = v_store_id
          and c.id <> v_customer_id
          and c.cpf is not null
          and public.normalize_customer_cpf(c.cpf) = v_clean_cpf
          and coalesce(c.status, 'active') not in ('merged', 'anonymized')
      ) then
        return jsonb_build_object('ok', false, 'error', 'cpf_already_registered');
      end if;
      v_fields := array_append(v_fields, 'cpf');
    end if;
  end if;

  if p_birth_date is not null then
    if p_birth_date > current_date then
      return jsonb_build_object('ok', false, 'error', 'invalid_birth_date');
    end if;

    v_birth_changed := p_birth_date is distinct from v_customer.birth_date;

    if v_birth_changed then
      if coalesce(v_customer.loyalty_opt_in, false)
         and p_birth_date > (current_date - interval '18 years')::date then
        return jsonb_build_object(
          'ok', false,
          'error', 'loyalty_age_restricted_profile_change',
          'message', 'Saia do programa de fidelidade antes de corrigir a data de nascimento para uma idade inferior a 18 anos.'
        );
      end if;
      v_fields := array_append(v_fields, 'birth_date');
    end if;
  end if;

  if not v_cpf_changed and not v_birth_changed then
    return jsonb_build_object(
      'ok', true,
      'unchanged', true,
      'cpf', v_customer.cpf,
      'birth_date', v_customer.birth_date,
      'fields_changed', '[]'::jsonb
    );
  end if;

  select *
  into v_credential
  from public.customer_credentials
  where customer_id = v_customer_id
  for update;

  if not found or v_credential.password_hash is null then
    return jsonb_build_object('ok', false, 'error', 'password_not_configured');
  end if;

  if v_credential.locked_until is not null and v_credential.locked_until > v_now then
    return jsonb_build_object(
      'ok', false,
      'error', 'locked',
      'retry_after_seconds',
      greatest(1, ceil(extract(epoch from (v_credential.locked_until - v_now)))::int)
    );
  end if;

  if crypt(p_password, v_credential.password_hash) <> v_credential.password_hash then
    v_next_attempts := coalesce(v_credential.failed_attempts, 0) + 1;
    update public.customer_credentials
    set failed_attempts = v_next_attempts,
        locked_until = case when v_next_attempts >= 5 then v_now + interval '15 minutes' else null end,
        updated_at = v_now
    where customer_id = v_customer_id;

    return jsonb_build_object('ok', false, 'error', 'invalid_password');
  end if;

  update public.customer_credentials
  set failed_attempts = 0,
      locked_until = null,
      updated_at = v_now
  where customer_id = v_customer_id;

  select *
  into v_otp_row
  from public.customer_otps
  where store_id = v_store_id
    and phone = coalesce(v_customer.phone_e164, v_customer.phone)
    and purpose = 'profile_change'
    and coalesce(verified, false) = false
    and coalesce(used, false) = false
    and expires_at > v_now
  order by created_at desc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_expired_otp');
  end if;

  if coalesce(v_otp_row.attempts, 0) >= 5 then
    update public.customer_otps
    set used = true,
        consumed_at = coalesce(consumed_at, v_now)
    where id = v_otp_row.id;

    return jsonb_build_object('ok', false, 'error', 'otp_locked');
  end if;

  v_next_attempts := coalesce(v_otp_row.attempts, 0) + 1;

  if coalesce(v_otp_row.otp_hash, v_otp_row.otp_code) is null
     or crypt(v_clean_otp, coalesce(v_otp_row.otp_hash, v_otp_row.otp_code))
        <> coalesce(v_otp_row.otp_hash, v_otp_row.otp_code) then
    update public.customer_otps
    set attempts = v_next_attempts,
        used = case when v_next_attempts >= 5 then true else used end,
        consumed_at = case when v_next_attempts >= 5 then coalesce(consumed_at, v_now) else consumed_at end
    where id = v_otp_row.id;

    return jsonb_build_object(
      'ok', false,
      'error', case when v_next_attempts >= 5 then 'otp_locked' else 'invalid_or_expired_otp' end
    );
  end if;

  update public.customer_otps
  set attempts = v_next_attempts,
      verified = true,
      used = true,
      verified_at = v_now,
      consumed_at = v_now,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'verified_purpose', 'profile_change',
        'strong_reauth', true,
        'verified_at', v_now
      )
  where id = v_otp_row.id;

  update public.customers
  set cpf = case when v_cpf_changed then v_clean_cpf else cpf end,
      birth_date = case when v_birth_changed then p_birth_date else birth_date end,
      updated_at = v_now
  where id = v_customer_id and store_id = v_store_id;

  insert into public.customer_profile_sensitive_change_audit(
    store_id, customer_id_snapshot, fields_changed, source, metadata, created_at
  ) values (
    v_store_id,
    v_customer_id,
    v_fields,
    'customer_portal',
    jsonb_build_object(
      'strong_reauth', 'password+otp',
      'otp_purpose', 'profile_change'
    ),
    v_now
  );

  insert into public.customer_notifications(
    customer_id, store_id, title, message, type, category, read, created_at
  ) values (
    v_customer_id,
    v_store_id,
    'Dados protegidos atualizados',
    'CPF e/ou data de nascimento foram corrigidos após confirmação por senha e SMS.',
    'success',
    'profile',
    false,
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'unchanged', false,
    'cpf', case when v_cpf_changed then v_clean_cpf else v_customer.cpf end,
    'birth_date', case when v_birth_changed then p_birth_date else v_customer.birth_date end,
    'fields_changed', to_jsonb(v_fields)
  );
end;
$function$;

revoke all on function public.change_customer_self_sensitive_profile_safe(text, text, text, date)
from public, anon;
grant execute on function public.change_customer_self_sensitive_profile_safe(text, text, text, date)
to authenticated;

commit;
