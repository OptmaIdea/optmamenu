create or replace function public.delete_customer_account_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_source text default 'customer_portal'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_customer_ids uuid[];
  v_auth_user_ids uuid[];
  v_audit_id uuid;
  v_legal_evidence jsonb := '[]'::jsonb;
  v_order_count integer := 0;
  v_cashbook_count integer := 0;
  v_active_order_count integer := 0;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;
  if p_customer_id is null or p_store_id is null then
    return jsonb_build_object('ok',false,'error','invalid_request');
  end if;

  perform 1
  from public.customers
  where id=p_customer_id
    and store_id=p_store_id
    and coalesce(status,'active')='active'
    and merged_into_customer_id is null
  for update;

  if not found then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  select array_agg(id order by id)
    into v_customer_ids
  from public.customers
  where store_id=p_store_id
    and (id=p_customer_id or merged_into_customer_id=p_customer_id);

  v_customer_ids:=coalesce(v_customer_ids,array[p_customer_id]::uuid[]);

  select count(*)
    into v_active_order_count
  from public.orders
  where store_id=p_store_id
    and customer_id=any(v_customer_ids)
    and status not in ('completed'::public.order_status,'cancelled'::public.order_status);

  if v_active_order_count>0 then
    return jsonb_build_object(
      'ok',false,
      'error','active_orders_exist',
      'active_order_count',v_active_order_count
    );
  end if;

  select coalesce(array_agg(distinct auth_user_id),'{}'::uuid[])
    into v_auth_user_ids
  from public.customer_auth_identities
  where store_id=p_store_id
    and customer_id=any(v_customer_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'consent_type',consent_type,
    'action',action,
    'terms_version',terms_version,
    'privacy_version',privacy_version,
    'source',source,
    'created_at',created_at,
    'revoked_at',revoked_at
  ) order by created_at,id),'[]'::jsonb)
    into v_legal_evidence
  from public.customer_consent_logs
  where store_id=p_store_id
    and customer_id=any(v_customer_ids)
    and consent_type in (
      'terms_of_use',
      'privacy_policy',
      'loyalty_data_responsibility',
      'loyalty_program',
      'marketing_whatsapp',
      'marketing_email',
      'marketing_sms'
    );

  select count(*)
    into v_order_count
  from public.orders
  where store_id=p_store_id
    and customer_id=any(v_customer_ids);

  select count(*)
    into v_cashbook_count
  from public.cashbook_entries
  where store_id=p_store_id
    and customer_id=any(v_customer_ids);

  select id
    into v_audit_id
  from public.customer_account_deletion_audit
  where store_id=p_store_id
    and customer_id_snapshot=p_customer_id
    and status in ('pending','processing')
  order by requested_at desc
  limit 1
  for update;

  if v_audit_id is null then
    insert into public.customer_account_deletion_audit(
      store_id,
      customer_id_snapshot,
      status,
      request_source,
      reauth_method,
      requested_at,
      retained_legal_evidence,
      execution_summary,
      metadata
    )
    values(
      p_store_id,
      p_customer_id,
      'processing',
      coalesce(nullif(trim(p_source),''),'customer_portal'),
      'password+otp',
      v_now,
      v_legal_evidence,
      jsonb_build_object(
        'orders_retained_anonymized',v_order_count,
        'cashbook_entries_retained_detached',v_cashbook_count
      ),
      jsonb_build_object(
        'related_customer_records',cardinality(v_customer_ids),
        'processor_started_at',v_now
      )
    )
    returning id into v_audit_id;
  else
    update public.customer_account_deletion_audit
    set status='processing',
        retained_legal_evidence=v_legal_evidence,
        execution_summary=coalesce(execution_summary,'{}'::jsonb)||jsonb_build_object(
          'orders_retained_anonymized',v_order_count,
          'cashbook_entries_retained_detached',v_cashbook_count
        ),
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'related_customer_records',cardinality(v_customer_ids),
          'processor_started_at',v_now
        )
    where id=v_audit_id;
  end if;

  update public.orders
  set customer_id=null,
      customer_name='Cliente excluído',
      customer_phone=null,
      delivery_address=null,
      customer_snapshot=jsonb_build_object(
        'account_deleted',true,
        'deleted_at',v_now,
        'retention_basis','commercial_record_without_direct_identifier'
      ),
      delivery_address_snapshot='{}'::jsonb,
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)
        - array['customer_id','customer_display_label']::text[],
      metadata=coalesce(metadata,'{}'::jsonb)
        - array['display_customer_name','effective_customer_id','selected_customer_id']::text[],
      updated_at=v_now
  where store_id=p_store_id
    and customer_id=any(v_customer_ids);

  update public.cashbook_entries
  set customer_id=null,
      metadata=coalesce(metadata,'{}'::jsonb)-'customer_id',
      updated_at=v_now
  where store_id=p_store_id
    and customer_id=any(v_customer_ids);

  update public.customer_benefit_rules
  set target_customer_id=null
  where store_id=p_store_id
    and target_customer_id=any(v_customer_ids);

  update public.promotion_campaigns
  set target_customer_id=null
  where store_id=p_store_id
    and target_customer_id=any(v_customer_ids);

  delete from public.customer_merge_events
  where canonical_customer_id=any(v_customer_ids)
     or duplicate_customer_id=any(v_customer_ids);

  update public.customers
  set merged_into_customer_id=null,
      merged_at=null,
      merged_by=null
  where id=any(v_customer_ids);

  delete from public.fidelity_membership_blocks
  where store_id=p_store_id
    and customer_id=any(v_customer_ids);

  delete from public.customers
  where store_id=p_store_id
    and id=any(v_customer_ids);

  update public.customer_account_deletion_audit
  set status='executed',
      executed_at=clock_timestamp(),
      execution_summary=coalesce(execution_summary,'{}'::jsonb)||jsonb_build_object(
        'customer_records_deleted',cardinality(v_customer_ids),
        'auth_identities_to_revoke',cardinality(v_auth_user_ids)
      ),
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'processor_finished_at',clock_timestamp()
      )
  where id=v_audit_id;

  return jsonb_build_object(
    'ok',true,
    'audit_id',v_audit_id,
    'auth_user_ids',to_jsonb(v_auth_user_ids),
    'executed_at',clock_timestamp()
  );
exception
  when others then
    if v_audit_id is not null then
      update public.customer_account_deletion_audit
      set status='failed',
          metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
            'failure_class',sqlstate,
            'processor_failed_at',clock_timestamp()
          )
      where id=v_audit_id;
    end if;
    raise;
end;
$function$;

revoke all on function public.delete_customer_account_service_safe(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.delete_customer_account_service_safe(uuid,uuid,text)
  to service_role;
