-- P01 2026-10-21 | Retire Asaas without touching historical financial routing.
-- Legacy asaas_pix routes are grouped under generic online Pix: DO NOT mutate them.
begin;
CREATE OR REPLACE FUNCTION public.save_online_payment_provider_safe(p_store_id uuid, p_provider_code text, p_environment text, p_enabled boolean, p_is_default boolean DEFAULT false, p_public_config jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
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
  -- Retired Asaas: reject any legacy reactivation while preserving OptmaPay.
  if p_provider_code='asaas' then return jsonb_build_object('ok',false,'error','provider_retired'); end if;
  if p_provider_code not in ('optma_sandbox','asaas') then return jsonb_build_object('ok',false,'error','invalid_provider'); end if;
  if p_environment not in ('sandbox','production') then return jsonb_build_object('ok',false,'error','invalid_environment'); end if;
  if p_provider_code='optma_sandbox' and p_environment<>'sandbox' then return jsonb_build_object('ok',false,'error','sandbox_only_provider'); end if;

  v_display_name := case when p_provider_code='optma_sandbox' then 'OptmaPay Sandbox' else 'Asaas (legado)' end;
  v_capabilities := case when p_provider_code='optma_sandbox' then
    jsonb_build_object(
      'pix',true,'credit_card',false,'payment_link',false,'webhooks',true,
      'refunds',false,'test_scenarios',true,'external_adapter',true
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

  if v_credential_status is null then v_credential_status := 'not_configured'; end if;

  if p_is_default then
    update public.store_online_payment_providers set is_default=false,updated_at=now()
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
    ),now()
  )
  on conflict (store_id,provider_code,environment) do update set
    display_name=excluded.display_name,enabled=excluded.enabled,is_default=excluded.is_default,
    capabilities=excluded.capabilities,public_config=excluded.public_config,
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
$function$
;
update public.store_online_payment_providers
set enabled=false, is_default=false, updated_at=now()
where provider_code='asaas' and (coalesce(enabled,false) or coalesce(is_default,false));
do $check$ begin
 if exists (select 1 from public.store_online_payment_providers where provider_code='asaas' and (enabled=true or is_default=true)) then
  raise exception 'P01: Asaas provider must be disabled';
 end if; end; $check$;
commit;
