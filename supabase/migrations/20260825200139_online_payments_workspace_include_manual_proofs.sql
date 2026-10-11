create or replace function public.get_online_payments_workspace_safe(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth','pg_temp'
as $function$
declare
  v_can_view boolean := false;
  v_can_manage boolean := false;
  v_can_credentials boolean := false;
  v_can_proofs boolean := false;
  v_can_refund boolean := false;
  v_can_events boolean := false;
  v_providers jsonb := '[]'::jsonb;
  v_intents jsonb := '[]'::jsonb;
  v_events jsonb := '[]'::jsonb;
  v_proofs jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  v_can_view := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.view');
  if not v_can_view then return jsonb_build_object('ok',false,'error','access_denied'); end if;

  v_can_manage := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.manage');
  v_can_credentials := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.credentials.manage');
  v_can_proofs := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.proofs.review');
  v_can_refund := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.refund');
  v_can_events := public.app_is_store_owner(p_store_id) or public.user_has_store_permission_v2(p_store_id,'payments.online.events.view');

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'provider_code',p.provider_code,'environment',p.environment,'display_name',p.display_name,
    'enabled',p.enabled,'is_default',p.is_default,'credential_status',p.credential_status,
    'capabilities',p.capabilities,'public_config',p.public_config,'metadata',p.metadata,
    'created_at',p.created_at,'updated_at',p.updated_at
  ) order by p.provider_code,p.environment),'[]'::jsonb)
  into v_providers from public.store_online_payment_providers p where p.store_id=p_store_id;

  select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_intents from (
    select jsonb_build_object(
      'id',i.id,'order_id',i.order_id,'order_code',o.order_code,'provider_id',i.provider_id,'provider_code',p.provider_code,
      'provider_name',p.display_name,'environment',p.environment,'method_code',i.method_code,'amount',i.amount,
      'currency',i.currency,'status',i.status,'external_payment_id',i.external_payment_id,
      'external_reference',i.external_reference,'checkout_url',i.checkout_url,'expires_at',i.expires_at,
      'paid_at',i.paid_at,'created_at',i.created_at,'metadata',i.metadata
    ) as row
    from public.online_payment_intents i
    join public.store_online_payment_providers p on p.id=i.provider_id
    left join public.orders o on o.id=i.order_id
    where i.store_id=p_store_id
    order by i.created_at desc limit 50
  ) x;

  if v_can_events then
    select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_events from (
      select jsonb_build_object(
        'id',e.id,'intent_id',e.intent_id,'provider_id',e.provider_id,'provider_code',p.provider_code,
        'event_type',e.event_type,'event_status',e.event_status,'signature_valid',e.signature_valid,
        'processed',e.processed,'external_event_id',e.external_event_id,'idempotency_key',e.idempotency_key,
        'error_message',e.error_message,'received_at',e.received_at,'processed_at',e.processed_at
      ) as row
      from public.online_payment_events e
      join public.store_online_payment_providers p on p.id=e.provider_id
      where e.store_id=p_store_id
      order by e.received_at desc limit 100
    ) x;
  end if;

  if v_can_proofs then
    select coalesce(jsonb_agg(x.row),'[]'::jsonb) into v_proofs from (
      select jsonb_build_object(
        'id',pr.id,'order_id',pr.order_id,'order_code',o.order_code,'status',pr.status,
        'original_file_name',pr.original_file_name,'content_type',pr.content_type,
        'declared_amount',pr.declared_amount,'declared_paid_at',pr.declared_paid_at,
        'submitted_at',pr.submitted_at,'decided_at',pr.decided_at,'decision_source',pr.decision_source,
        'decision_notes',pr.decision_notes,'cashbook_entry_id',pr.cashbook_entry_id,
        'financial_account_id',pr.financial_account_id,'created_at',pr.created_at
      ) as row
      from public.order_payment_proofs pr
      join public.orders o on o.id=pr.order_id
      where pr.store_id=p_store_id and pr.status<>'upload_pending'
      order by pr.created_at desc limit 50
    ) x;
  end if;

  return jsonb_build_object(
    'ok',true,
    'permissions',jsonb_build_object('view',v_can_view,'manage',v_can_manage,'credentials',v_can_credentials,'proofs',v_can_proofs,'refund',v_can_refund,'events',v_can_events),
    'providers',v_providers,'transactions',v_intents,'events',v_events,'proofs',v_proofs,
    'counts',jsonb_build_object(
      'pending',(select count(*) from public.online_payment_intents where store_id=p_store_id and status in ('created','pending','authorized')),
      'paid',(select count(*) from public.online_payment_intents where store_id=p_store_id and status='paid'),
      'failed',(select count(*) from public.online_payment_intents where store_id=p_store_id and status in ('failed','expired','cancelled')),
      'proofs_pending',(select count(*) from public.order_payment_proofs where store_id=p_store_id and status='submitted')
    )
  );
end;
$function$;

revoke all on function public.get_online_payments_workspace_safe(uuid) from public;
grant execute on function public.get_online_payments_workspace_safe(uuid) to authenticated, service_role;
