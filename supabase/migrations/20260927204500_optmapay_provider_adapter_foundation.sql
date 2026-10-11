-- OptmaPay Sandbox external adapter foundation.
-- Evolui optma_sandbox de simulador local sem credenciais para provider externo seguro,
-- sem armazenar API key ou webhook secret em plaintext no banco.

create or replace function public.save_online_payment_provider_safe(
  p_store_id uuid,
  p_provider_code text,
  p_environment text,
  p_enabled boolean,
  p_is_default boolean default false,
  p_public_config jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_row public.store_online_payment_providers%rowtype;
  v_display_name text;
  v_capabilities jsonb;
  v_credential_status text;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if not (public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.manage')) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if p_provider_code not in ('optma_sandbox','asaas') then return jsonb_build_object('ok',false,'error','invalid_provider'); end if;
  if p_environment not in ('sandbox','production') then return jsonb_build_object('ok',false,'error','invalid_environment'); end if;
  if p_provider_code='optma_sandbox' and p_environment<>'sandbox' then return jsonb_build_object('ok',false,'error','sandbox_only_provider'); end if;

  v_display_name := case when p_provider_code='optma_sandbox' then 'OptmaPay Sandbox' else 'Asaas (legado)' end;
  v_capabilities := case when p_provider_code='optma_sandbox' then
    jsonb_build_object(
      'pix',true,'credit_card',true,'payment_link',false,'webhooks',true,
      'refunds',true,'test_scenarios',true,'external_adapter',true
    )
  else
    jsonb_build_object(
      'pix',true,'credit_card',true,'payment_link',true,'webhooks',true,
      'refunds',true,'test_scenarios',p_environment='sandbox','legacy',true
    )
  end;

  select credential_status into v_credential_status
  from public.store_online_payment_providers
  where store_id=p_store_id and provider_code=p_provider_code and environment=p_environment;

  if v_credential_status is null then
    v_credential_status := 'not_configured';
  end if;

  if p_is_default then
    update public.store_online_payment_providers
    set is_default=false,updated_at=now()
    where store_id=p_store_id and environment=p_environment;
  end if;

  insert into public.store_online_payment_providers(
    store_id,provider_code,environment,display_name,enabled,is_default,credential_status,
    capabilities,public_config,metadata,updated_at
  ) values (
    p_store_id,p_provider_code,p_environment,v_display_name,coalesce(p_enabled,false),
    coalesce(p_is_default,false),v_credential_status,v_capabilities,
    coalesce(p_public_config,'{}'::jsonb),
    jsonb_build_object(
      'configured_from','admin_online_payments',
      'provider_strategy',case when p_provider_code='optma_sandbox' then 'external_optmapay' else 'legacy' end
    ),
    now()
  )
  on conflict (store_id,provider_code,environment) do update set
    display_name=excluded.display_name,
    enabled=excluded.enabled,
    is_default=excluded.is_default,
    capabilities=excluded.capabilities,
    public_config=excluded.public_config,
    metadata=coalesce(public.store_online_payment_providers.metadata,'{}'::jsonb) || excluded.metadata,
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object('ok',true,'provider',jsonb_build_object(
    'id',v_row.id,'provider_code',v_row.provider_code,'environment',v_row.environment,
    'display_name',v_row.display_name,'enabled',v_row.enabled,'is_default',v_row.is_default,
    'credential_status',v_row.credential_status,'capabilities',v_row.capabilities,
    'public_config',v_row.public_config
  ));
end;
$function$;

revoke all on function public.save_online_payment_provider_safe(uuid,text,text,boolean,boolean,jsonb) from public, anon;
grant execute on function public.save_online_payment_provider_safe(uuid,text,text,boolean,boolean,jsonb) to authenticated;

create or replace function public.configure_optmapay_sandbox_provider_safe(
  p_store_id uuid,
  p_account_id uuid,
  p_api_key_secret_ref text,
  p_webhook_secret_ref text,
  p_settlement_financial_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_row public.store_online_payment_providers%rowtype;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id,'payments.online.credentials.manage')
  ) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if p_account_id is null then
    return jsonb_build_object('ok',false,'error','account_id_required');
  end if;

  if coalesce(p_api_key_secret_ref,'') !~ '^[A-Z][A-Z0-9_]{2,127}$' then
    return jsonb_build_object('ok',false,'error','invalid_api_key_secret_ref');
  end if;

  if coalesce(p_webhook_secret_ref,'') !~ '^[A-Z][A-Z0-9_]{2,127}$' then
    return jsonb_build_object('ok',false,'error','invalid_webhook_secret_ref');
  end if;

  if p_settlement_financial_account_id is not null and not exists (
    select 1
    from public.store_financial_accounts account
    where account.id = p_settlement_financial_account_id
      and account.store_id = p_store_id
      and account.active = true
  ) then
    return jsonb_build_object('ok',false,'error','invalid_settlement_account');
  end if;

  insert into public.store_online_payment_providers(
    store_id,provider_code,environment,display_name,enabled,is_default,credential_status,
    capabilities,public_config,secret_ref,metadata,updated_at
  ) values (
    p_store_id,'optma_sandbox','sandbox','OptmaPay Sandbox',false,false,'configured',
    jsonb_build_object(
      'pix',true,'credit_card',true,'payment_link',false,'webhooks',true,
      'refunds',true,'test_scenarios',true,'external_adapter',true
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'optmapay_account_id',p_account_id,
      'settlement_financial_account_id',p_settlement_financial_account_id
    )),
    p_api_key_secret_ref,
    jsonb_build_object(
      'webhook_secret_ref',p_webhook_secret_ref,
      'provider_strategy','external_optmapay',
      'configured_at',now()
    ),
    now()
  )
  on conflict (store_id,provider_code,environment) do update set
    display_name='OptmaPay Sandbox',
    credential_status='configured',
    secret_ref=excluded.secret_ref,
    public_config=coalesce(public.store_online_payment_providers.public_config,'{}'::jsonb)
      || excluded.public_config,
    metadata=coalesce(public.store_online_payment_providers.metadata,'{}'::jsonb)
      || excluded.metadata,
    capabilities=excluded.capabilities,
    updated_at=now()
  returning * into v_row;

  return jsonb_build_object(
    'ok',true,
    'provider',jsonb_build_object(
      'id',v_row.id,
      'provider_code',v_row.provider_code,
      'environment',v_row.environment,
      'credential_status',v_row.credential_status,
      'account_id',v_row.public_config->>'optmapay_account_id',
      'settlement_financial_account_id',v_row.public_config->>'settlement_financial_account_id',
      'api_key_secret_ref',v_row.secret_ref,
      'webhook_secret_ref',v_row.metadata->>'webhook_secret_ref'
    )
  );
end;
$function$;

revoke all on function public.configure_optmapay_sandbox_provider_safe(uuid,uuid,text,text,uuid) from public, anon;
grant execute on function public.configure_optmapay_sandbox_provider_safe(uuid,uuid,text,text,uuid) to authenticated;

update public.store_online_payment_providers
set display_name = 'OptmaPay Sandbox',
    credential_status = case
      when nullif(trim(coalesce(secret_ref,'')),'') is null then 'not_configured'
      else credential_status
    end,
    capabilities = coalesce(capabilities,'{}'::jsonb)
      || jsonb_build_object('external_adapter',true,'payment_link',false),
    metadata = coalesce(metadata,'{}'::jsonb)
      || jsonb_build_object('provider_strategy','external_optmapay'),
    updated_at = now()
where provider_code='optma_sandbox' and environment='sandbox';

update public.store_online_payment_providers
set display_name = 'Asaas (legado)',
    capabilities = coalesce(capabilities,'{}'::jsonb) || jsonb_build_object('legacy',true),
    metadata = coalesce(metadata,'{}'::jsonb)
      || jsonb_build_object('provider_strategy','legacy','new_development',false),
    updated_at = now()
where provider_code='asaas';
