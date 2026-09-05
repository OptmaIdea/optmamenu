create or replace function public.upsert_store_payment_method_variant_safe(
  p_store_id uuid,
  p_method_id uuid default null,
  p_name text default null,
  p_base_code text default null,
  p_code text default null,
  p_description text default null,
  p_preferred_financial_account_id uuid default null,
  p_active boolean default true,
  p_public_enabled boolean default false,
  p_requires_proof boolean default false,
  p_requires_change_for boolean default false,
  p_affects_cashbook boolean default true,
  p_sort_order integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'pg_temp'
as $function$
declare
  v_base_code text := lower(trim(coalesce(p_base_code, '')));
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_code text := lower(trim(coalesce(p_code, '')));
  v_slug text;
  v_method public.store_payment_methods%rowtype;
  v_account_name text;
begin
  if p_store_id is null or v_name is null or v_base_code = '' then
    return jsonb_build_object('ok', false, 'error', 'missing_required_fields');
  end if;

  if coalesce(auth.role(), '') in ('anon', 'authenticated') then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission_v2(p_store_id, 'settings.payment.manage')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied');
    end if;
  end if;

  if v_base_code not in ('cash','pix','debit_card','credit_card','bank_transfer','voucher','other') then
    return jsonb_build_object('ok', false, 'error', 'invalid_base_code');
  end if;

  if p_preferred_financial_account_id is not null then
    select a.name into v_account_name
    from public.store_financial_accounts a
    where a.id = p_preferred_financial_account_id
      and a.store_id = p_store_id
      and a.active = true;

    if v_account_name is null then
      return jsonb_build_object('ok', false, 'error', 'invalid_preferred_financial_account');
    end if;
  end if;

  if p_method_id is null then
    if v_code = '' then
      v_slug := translate(
        lower(v_name),
        'áàãâäéèêëíìîïóòõôöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      );
      v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '_', 'g');
      v_slug := trim(both '_' from v_slug);
      v_code := left(v_base_code || '_' || v_slug, 56);
    end if;

    if v_code = v_base_code then
      v_code := left(v_base_code || '_personalizado', 56);
    end if;

    if v_code !~ '^[a-z0-9][a-z0-9_]{1,63}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_code');
    end if;

    if exists (select 1 from public.store_payment_methods pm where pm.store_id = p_store_id and pm.code = v_code) then
      v_code := left(v_code, 55) || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end if;

    insert into public.store_payment_methods(
      store_id, code, base_code, name, description, active, public_enabled, sort_order,
      requires_proof, requires_change_for, affects_cashbook, preferred_financial_account_id,
      metadata, updated_at
    ) values (
      p_store_id, v_code, v_base_code, v_name, nullif(trim(coalesce(p_description, '')), ''),
      coalesce(p_active, true), coalesce(p_public_enabled, false), coalesce(p_sort_order, 500),
      coalesce(p_requires_proof, false), coalesce(p_requires_change_for, false), coalesce(p_affects_cashbook, true),
      p_preferred_financial_account_id,
      jsonb_build_object('custom_variant', true, 'created_by', auth.uid(), 'created_at', now()), now()
    ) returning * into v_method;
  else
    update public.store_payment_methods pm
    set name = v_name,
        description = nullif(trim(coalesce(p_description, '')), ''),
        active = coalesce(p_active, pm.active),
        public_enabled = coalesce(p_public_enabled, pm.public_enabled),
        sort_order = coalesce(p_sort_order, pm.sort_order),
        requires_proof = coalesce(p_requires_proof, pm.requires_proof),
        requires_change_for = coalesce(p_requires_change_for, pm.requires_change_for),
        affects_cashbook = coalesce(p_affects_cashbook, pm.affects_cashbook),
        preferred_financial_account_id = p_preferred_financial_account_id,
        updated_at = now(),
        metadata = coalesce(pm.metadata, '{}'::jsonb) || jsonb_build_object('updated_by', auth.uid(), 'updated_at', now())
    where pm.id = p_method_id
      and pm.store_id = p_store_id
    returning * into v_method;

    if v_method.id is null then
      return jsonb_build_object('ok', false, 'error', 'payment_method_not_found');
    end if;
  end if;

  if p_preferred_financial_account_id is not null then
    insert into public.store_financial_account_payment_methods(
      store_id, account_id, payment_method_code, active, updated_at, metadata
    ) values (
      p_store_id, p_preferred_financial_account_id, v_method.code, true, now(),
      jsonb_build_object('source', 'payment_method_preferred_account')
    )
    on conflict (account_id, payment_method_code)
    do update set active = true, updated_at = now(), metadata = excluded.metadata;
  end if;

  return jsonb_build_object(
    'ok', true,
    'method', to_jsonb(v_method) || jsonb_build_object(
      'preferred_financial_account_name', v_account_name,
      'is_custom_variant', v_method.code <> v_method.base_code
    )
  );
end;
$function$;

revoke all on function public.upsert_store_payment_method_variant_safe(uuid, uuid, text, text, text, text, uuid, boolean, boolean, boolean, boolean, boolean, integer) from public, anon;
grant execute on function public.upsert_store_payment_method_variant_safe(uuid, uuid, text, text, text, text, uuid, boolean, boolean, boolean, boolean, boolean, integer) to authenticated, service_role;
