-- OptmaPay Sandbox credential vault.
-- Segredos são persistidos somente no Supabase Vault e referenciados por nome no provider.
-- Nenhuma API key ou webhook secret deve ser armazenada em public_config, metadata ou frontend.

create or replace function public.get_online_payment_vault_secret_internal(
  p_secret_name text
)
returns text
language plpgsql
security definer
set search_path to 'public','vault','auth','pg_temp'
as $function$
declare
  v_role text;
  v_secret text;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), ''),
    current_user
  );

  if v_role not in ('service_role','postgres','supabase_admin') then
    raise exception 'service_role_required';
  end if;

  if coalesce(p_secret_name,'') !~ '^OPTMAPAY_[A-Z0-9_]{3,119}$' then
    raise exception 'invalid_secret_ref';
  end if;

  select decrypted_secret
    into v_secret
  from vault.decrypted_secrets
  where name = p_secret_name
  order by updated_at desc nulls last, created_at desc
  limit 1;

  return v_secret;
end;
$function$;

revoke all on function public.get_online_payment_vault_secret_internal(text) from public, anon, authenticated;
grant execute on function public.get_online_payment_vault_secret_internal(text) to service_role;

create or replace function public.upsert_online_payment_vault_secret_internal(
  p_secret_name text,
  p_secret_value text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public','vault','auth','pg_temp'
as $function$
declare
  v_role text;
  v_secret_id uuid;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), ''),
    current_user
  );

  if v_role not in ('service_role','postgres','supabase_admin') then
    raise exception 'service_role_required';
  end if;

  if coalesce(p_secret_name,'') !~ '^OPTMAPAY_[A-Z0-9_]{3,119}$' then
    raise exception 'invalid_secret_ref';
  end if;

  if p_secret_value is null or length(trim(p_secret_value)) < 16 then
    raise exception 'invalid_secret_value';
  end if;

  select id
    into v_secret_id
  from vault.secrets
  where name = p_secret_name
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if v_secret_id is null then
    select vault.create_secret(
      p_secret_value,
      p_secret_name,
      coalesce(p_description,'Credencial OptmaPay Sandbox do OptmaMenu'),
      null
    ) into v_secret_id;
  else
    perform vault.update_secret(
      v_secret_id,
      p_secret_value,
      p_secret_name,
      coalesce(p_description,'Credencial OptmaPay Sandbox do OptmaMenu'),
      null
    );
  end if;

  return v_secret_id;
end;
$function$;

revoke all on function public.upsert_online_payment_vault_secret_internal(text,text,text) from public, anon, authenticated;
grant execute on function public.upsert_online_payment_vault_secret_internal(text,text,text) to service_role;

create or replace function public.configure_optmapay_sandbox_credentials_internal(
  p_store_id uuid,
  p_account_id uuid,
  p_api_key text default null,
  p_webhook_secret text default null,
  p_settlement_financial_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','vault','auth','pg_temp'
as $function$
declare
  v_role text;
  v_api_ref text;
  v_webhook_ref text;
  v_provider public.store_online_payment_providers%rowtype;
  v_api_configured boolean := false;
  v_webhook_configured boolean := false;
begin
  v_role := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(auth.role(), ''),
    current_user
  );

  if v_role not in ('service_role','postgres','supabase_admin') then
    return jsonb_build_object('ok',false,'error','service_role_required');
  end if;

  if p_store_id is null or p_account_id is null then
    return jsonb_build_object('ok',false,'error','store_and_account_required');
  end if;

  if p_settlement_financial_account_id is not null and not exists (
    select 1
    from public.store_financial_accounts a
    where a.id=p_settlement_financial_account_id
      and a.store_id=p_store_id
      and a.active=true
  ) then
    return jsonb_build_object('ok',false,'error','invalid_settlement_account');
  end if;

  v_api_ref := 'OPTMAPAY_SANDBOX_API_KEY_' || upper(replace(p_store_id::text,'-',''));
  v_webhook_ref := 'OPTMAPAY_SANDBOX_WEBHOOK_SECRET_' || upper(replace(p_store_id::text,'-',''));

  if p_api_key is not null and trim(p_api_key) <> '' then
    if p_api_key !~ '^sk_test_optmapay_[0-9a-fA-F]{16}_[A-Za-z0-9_-]{32,}$' then
      return jsonb_build_object('ok',false,'error','invalid_optmapay_api_key');
    end if;
    perform public.upsert_online_payment_vault_secret_internal(
      v_api_ref,
      trim(p_api_key),
      'OptmaPay Sandbox API key da loja ' || p_store_id::text
    );
  end if;

  if p_webhook_secret is not null and trim(p_webhook_secret) <> '' then
    if p_webhook_secret !~ '^whsec_optmapay_[A-Za-z0-9_-]{32,}$' then
      return jsonb_build_object('ok',false,'error','invalid_optmapay_webhook_secret');
    end if;
    perform public.upsert_online_payment_vault_secret_internal(
      v_webhook_ref,
      trim(p_webhook_secret),
      'OptmaPay Sandbox webhook secret da loja ' || p_store_id::text
    );
  end if;

  v_api_configured := public.get_online_payment_vault_secret_internal(v_api_ref) is not null;
  v_webhook_configured := public.get_online_payment_vault_secret_internal(v_webhook_ref) is not null;

  insert into public.store_online_payment_providers(
    store_id,provider_code,environment,display_name,enabled,is_default,credential_status,
    capabilities,public_config,secret_ref,metadata,updated_at
  ) values (
    p_store_id,'optma_sandbox','sandbox','OptmaPay Sandbox',
    false,false,
    case when v_api_configured and v_webhook_configured then 'configured' else 'not_configured' end,
    jsonb_build_object(
      'pix',true,'credit_card',false,'payment_link',false,'webhooks',true,
      'refunds',false,'test_scenarios',true,'external_adapter',true
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'optmapay_account_id',p_account_id,
      'settlement_financial_account_id',p_settlement_financial_account_id
    )),
    case when v_api_configured then v_api_ref else null end,
    jsonb_build_object(
      'webhook_secret_ref',case when v_webhook_configured then v_webhook_ref else null end,
      'provider_strategy','external_optmapay',
      'credential_storage','supabase_vault',
      'configured_at',now()
    ),
    now()
  )
  on conflict (store_id,provider_code,environment) do update set
    display_name='OptmaPay Sandbox',
    credential_status=excluded.credential_status,
    secret_ref=case
      when excluded.secret_ref is not null then excluded.secret_ref
      else public.store_online_payment_providers.secret_ref
    end,
    public_config=coalesce(public.store_online_payment_providers.public_config,'{}'::jsonb)
      || excluded.public_config,
    metadata=coalesce(public.store_online_payment_providers.metadata,'{}'::jsonb)
      || excluded.metadata,
    capabilities=excluded.capabilities,
    updated_at=now()
  returning * into v_provider;

  return jsonb_build_object(
    'ok',true,
    'provider_id',v_provider.id,
    'account_id',v_provider.public_config->>'optmapay_account_id',
    'settlement_financial_account_id',v_provider.public_config->>'settlement_financial_account_id',
    'api_key_configured',v_api_configured,
    'webhook_secret_configured',v_webhook_configured,
    'credential_status',v_provider.credential_status
  );
end;
$function$;

revoke all on function public.configure_optmapay_sandbox_credentials_internal(uuid,uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.configure_optmapay_sandbox_credentials_internal(uuid,uuid,text,text,uuid) to service_role;
