create table if not exists public.customer_account_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete restrict,
  customer_id_snapshot uuid not null,
  status text not null default 'processing'
    check (status in ('processing','executed','failed')),
  request_source text not null default 'customer_portal',
  reauth_method text not null default 'password+otp',
  requested_at timestamptz not null default clock_timestamp(),
  executed_at timestamptz,
  retained_legal_evidence jsonb not null default '[]'::jsonb,
  execution_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.customer_account_deletion_audit is
  'Trilha mínima, sem PII direta, de solicitações/execuções de exclusão de conta de cliente.';

create index if not exists idx_customer_account_deletion_audit_store_requested
  on public.customer_account_deletion_audit(store_id, requested_at desc);

alter table public.customer_account_deletion_audit enable row level security;
revoke all on table public.customer_account_deletion_audit from public, anon, authenticated;
grant all on table public.customer_account_deletion_audit to service_role;

create or replace function public.export_customer_self_data_safe()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_customer public.customers%rowtype;
  v_result jsonb;
begin
  if public.app_current_role() <> 'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  select * into v_customer
  from public.customers
  where id = v_customer_id
    and store_id = v_store_id
    and coalesce(status,'active') in ('active','inactive')
    and merged_into_customer_id is null
  limit 1;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'customer_not_found');
  end if;

  select jsonb_build_object(
    'schemaVersion', 1,
    'exportedAt', clock_timestamp(),
    'storeId', v_store_id,
    'customerId', v_customer_id,
    'profile', jsonb_build_object(
      'full_name', v_customer.full_name,
      'nickname', v_customer.nickname,
      'phone', v_customer.phone,
      'phone_e164', v_customer.phone_e164,
      'phone_verified_at', v_customer.phone_verified_at,
      'email', v_customer.email,
      'email_verified', coalesce(v_customer.email_verified,false),
      'cpf', v_customer.cpf,
      'birth_date', v_customer.birth_date,
      'is_whatsapp', coalesce(v_customer.is_whatsapp,false),
      'contact_preference', v_customer.contact_preference,
      'marketing_consent', coalesce(v_customer.marketing_consent,false),
      'loyalty_opt_in', coalesce(v_customer.loyalty_opt_in,false),
      'created_at', v_customer.created_at,
      'last_login', v_customer.last_login,
      'source', v_customer.source,
      'registration_method', v_customer.registration_method,
      'data_ownership', v_customer.data_ownership
    ),
    'addresses', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at, a.id)
      from public.customer_addresses a
      where a.customer_id = v_customer_id
    ), '[]'::jsonb),
    'contacts', coalesce((
      select jsonb_agg(to_jsonb(cc) - 'match_key' order by cc.created_at, cc.id)
      from public.customer_contacts cc
      where cc.customer_id = v_customer_id and cc.store_id = v_store_id
    ), '[]'::jsonb),
    'legalProfile', (
      select to_jsonb(lp)
      from public.customer_legal_profiles lp
      where lp.customer_id = v_customer_id and lp.store_id = v_store_id
      limit 1
    ),
    'consents', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'consent_type', cl.consent_type,
          'action', cl.action,
          'terms_version', cl.terms_version,
          'privacy_version', cl.privacy_version,
          'source', cl.source,
          'created_at', cl.created_at,
          'revoked_at', cl.revoked_at
        )
        order by cl.created_at, cl.id
      )
      from public.customer_consent_logs cl
      where cl.customer_id = v_customer_id and cl.store_id = v_store_id
    ), '[]'::jsonb),
    'orders', coalesce((
      select jsonb_agg(
        (to_jsonb(o) - 'user_id') ||
        jsonb_build_object(
          'items', coalesce((
            select jsonb_agg(to_jsonb(oi) order by oi.id)
            from public.order_items oi
            where oi.order_id = o.id
          ), '[]'::jsonb)
        )
        order by o.created_at, o.id
      )
      from public.orders o
      where o.customer_id = v_customer_id and o.store_id = v_store_id
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.created_at, n.id)
      from public.customer_notifications n
      where n.customer_id = v_customer_id and n.store_id = v_store_id
    ), '[]'::jsonb),
    'cartDraft', (
      select jsonb_build_object('cart',cd.cart,'updated_at',cd.updated_at,'revision',cd.revision)
      from public.customer_cart_drafts cd
      where cd.customer_id = v_customer_id and cd.store_id = v_store_id
      limit 1
    ),
    'security', jsonb_build_object(
      'trustedDevices', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'first_verified_at',td.first_verified_at,
            'last_otp_verified_at',td.last_otp_verified_at,
            'last_seen_at',td.last_seen_at,
            'revoked_at',td.revoked_at
          )
          order by td.created_at, td.id
        )
        from public.customer_auth_trusted_devices td
        where td.customer_id = v_customer_id and td.store_id = v_store_id
      ), '[]'::jsonb),
      'emailVerificationEvents', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'email',ev.email,
            'requested_at',ev.requested_at,
            'expires_at',ev.expires_at,
            'used_at',ev.used_at,
            'delivery_accepted',ev.provider_message_id is not null,
            'confirmed_notification',ev.metadata->'confirmed_notification'
          )
          order by ev.requested_at, ev.id
        )
        from public.customer_email_verification_challenges ev
        where ev.customer_id = v_customer_id and ev.store_id = v_store_id
      ), '[]'::jsonb)
    )
  ) into v_result;

  return jsonb_build_object('ok', true, 'export', v_result);
end;
$function$;

revoke all on function public.export_customer_self_data_safe() from public, anon;
grant execute on function public.export_customer_self_data_safe() to authenticated;

create or replace function public.verify_customer_sensitive_action_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_password text,
  p_otp text,
  p_purpose text default 'account_delete'
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_customer public.customers%rowtype;
  v_credential public.customer_credentials%rowtype;
  v_otp_row public.customer_otps%rowtype;
  v_now timestamptz := clock_timestamp();
  v_next_attempts integer;
  v_clean_otp text := regexp_replace(coalesce(p_otp,''), '\D', '', 'g');
  v_purpose text := lower(trim(coalesce(p_purpose,'')));
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;
  if p_customer_id is null or p_store_id is null or v_purpose <> 'account_delete' then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;
  if length(coalesce(p_password,'')) < 1 or length(v_clean_otp) <> 6 then
    return jsonb_build_object('ok', false, 'error', 'strong_reauth_required');
  end if;

  select * into v_customer
  from public.customers
  where id=p_customer_id and store_id=p_store_id
    and coalesce(status,'active')='active' and merged_into_customer_id is null
  for update;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;

  select * into v_credential from public.customer_credentials
  where customer_id=p_customer_id for update;
  if not found or v_credential.password_hash is null then
    return jsonb_build_object('ok',false,'error','password_not_configured');
  end if;
  if v_credential.locked_until is not null and v_credential.locked_until>v_now then
    return jsonb_build_object('ok',false,'error','locked','retry_after_seconds',
      greatest(1,ceil(extract(epoch from (v_credential.locked_until-v_now)))::int));
  end if;
  if crypt(p_password,v_credential.password_hash)<>v_credential.password_hash then
    v_next_attempts:=coalesce(v_credential.failed_attempts,0)+1;
    update public.customer_credentials
      set failed_attempts=v_next_attempts,
          locked_until=case when v_next_attempts>=5 then v_now+interval '15 minutes' else null end,
          updated_at=v_now
    where customer_id=p_customer_id;
    return jsonb_build_object('ok',false,'error','invalid_password');
  end if;
  update public.customer_credentials set failed_attempts=0,locked_until=null,updated_at=v_now
  where customer_id=p_customer_id;

  select * into v_otp_row
  from public.customer_otps
  where store_id=p_store_id and phone=v_customer.phone_e164 and purpose=v_purpose
    and coalesce(verified,false)=false and coalesce(used,false)=false and expires_at>v_now
  order by created_at desc limit 1 for update;
  if not found then return jsonb_build_object('ok',false,'error','invalid_or_expired_otp'); end if;
  if v_otp_row.attempts>=5 then
    update public.customer_otps set used=true,consumed_at=coalesce(consumed_at,v_now)
    where id=v_otp_row.id;
    return jsonb_build_object('ok',false,'error','otp_locked');
  end if;

  v_next_attempts:=coalesce(v_otp_row.attempts,0)+1;
  if coalesce(v_otp_row.otp_hash,v_otp_row.otp_code) is null
     or crypt(v_clean_otp,coalesce(v_otp_row.otp_hash,v_otp_row.otp_code))
        <>coalesce(v_otp_row.otp_hash,v_otp_row.otp_code) then
    update public.customer_otps
      set attempts=v_next_attempts,
          used=case when v_next_attempts>=5 then true else used end,
          consumed_at=case when v_next_attempts>=5 then coalesce(consumed_at,v_now) else consumed_at end
    where id=v_otp_row.id;
    return jsonb_build_object('ok',false,'error',
      case when v_next_attempts>=5 then 'otp_locked' else 'invalid_or_expired_otp' end);
  end if;

  update public.customer_otps
    set attempts=v_next_attempts,verified=true,used=true,verified_at=v_now,consumed_at=v_now,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'verified_purpose',v_purpose,'strong_reauth',true,'verified_at',v_now)
  where id=v_otp_row.id;

  return jsonb_build_object('ok',true,'verified_at',v_now);
end;
$function$;

revoke all on function public.verify_customer_sensitive_action_service_safe(uuid,uuid,text,text,text)
  from public, anon, authenticated;
grant execute on function public.verify_customer_sensitive_action_service_safe(uuid,uuid,text,text,text)
  to service_role;

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

  perform 1 from public.customers
  where id=p_customer_id and store_id=p_store_id
    and coalesce(status,'active')='active' and merged_into_customer_id is null
  for update;
  if not found then return jsonb_build_object('ok',false,'error','customer_not_found'); end if;

  select array_agg(id order by id) into v_customer_ids
  from public.customers
  where store_id=p_store_id and (id=p_customer_id or merged_into_customer_id=p_customer_id);
  v_customer_ids:=coalesce(v_customer_ids,array[p_customer_id]::uuid[]);

  select count(*) into v_active_order_count
  from public.orders
  where store_id=p_store_id and customer_id=any(v_customer_ids)
    and status not in ('completed'::public.order_status,'cancelled'::public.order_status);
  if v_active_order_count>0 then
    return jsonb_build_object('ok',false,'error','active_orders_exist','active_order_count',v_active_order_count);
  end if;

  select coalesce(array_agg(distinct auth_user_id),'{}'::uuid[]) into v_auth_user_ids
  from public.customer_auth_identities
  where store_id=p_store_id and customer_id=any(v_customer_ids);

  select coalesce(jsonb_agg(jsonb_build_object(
    'consent_type',consent_type,'action',action,'terms_version',terms_version,
    'privacy_version',privacy_version,'source',source,'created_at',created_at,'revoked_at',revoked_at
  ) order by created_at,id),'[]'::jsonb)
  into v_legal_evidence
  from public.customer_consent_logs
  where store_id=p_store_id and customer_id=any(v_customer_ids)
    and consent_type in ('terms_of_use','privacy_policy','loyalty_data_responsibility',
      'loyalty_program','marketing_whatsapp','marketing_email','marketing_sms');

  select count(*) into v_order_count from public.orders
  where store_id=p_store_id and customer_id=any(v_customer_ids);
  select count(*) into v_cashbook_count from public.cashbook_entries
  where store_id=p_store_id and customer_id=any(v_customer_ids);

  insert into public.customer_account_deletion_audit(
    store_id,customer_id_snapshot,status,request_source,reauth_method,requested_at,
    retained_legal_evidence,execution_summary,metadata
  )
  values(
    p_store_id,p_customer_id,'processing',
    coalesce(nullif(trim(p_source),''),'customer_portal'),'password+otp',v_now,
    v_legal_evidence,
    jsonb_build_object('orders_retained_anonymized',v_order_count,'cashbook_entries_retained_detached',v_cashbook_count),
    jsonb_build_object('related_customer_records',cardinality(v_customer_ids))
  )
  returning id into v_audit_id;

  update public.orders
  set customer_id=null,customer_name='Cliente excluído',customer_phone=null,delivery_address=null,
      customer_snapshot=jsonb_build_object(
        'account_deleted',true,'deleted_at',v_now,'retention_basis','commercial_record_without_direct_identifier'),
      delivery_address_snapshot='{}'::jsonb,
      commercial_metadata=coalesce(commercial_metadata,'{}'::jsonb)
        - array['customer_id','customer_display_label']::text[],
      metadata=coalesce(metadata,'{}'::jsonb)
        - array['display_customer_name','effective_customer_id','selected_customer_id']::text[],
      updated_at=v_now
  where store_id=p_store_id and customer_id=any(v_customer_ids);

  update public.cashbook_entries
  set customer_id=null,metadata=coalesce(metadata,'{}'::jsonb)-'customer_id',updated_at=v_now
  where store_id=p_store_id and customer_id=any(v_customer_ids);

  update public.customer_benefit_rules set target_customer_id=null
  where store_id=p_store_id and target_customer_id=any(v_customer_ids);
  update public.promotion_campaigns set target_customer_id=null
  where store_id=p_store_id and target_customer_id=any(v_customer_ids);

  delete from public.customer_merge_events
  where canonical_customer_id=any(v_customer_ids) or duplicate_customer_id=any(v_customer_ids);

  update public.customers
  set merged_into_customer_id=null,merged_at=null,merged_by=null
  where id=any(v_customer_ids);

  delete from public.fidelity_membership_blocks
  where store_id=p_store_id and customer_id=any(v_customer_ids);

  delete from public.customers
  where store_id=p_store_id and id=any(v_customer_ids);

  update public.customer_account_deletion_audit
  set status='executed',executed_at=clock_timestamp(),
      execution_summary=execution_summary||jsonb_build_object(
        'customer_records_deleted',cardinality(v_customer_ids),
        'auth_identities_to_revoke',cardinality(v_auth_user_ids))
  where id=v_audit_id;

  return jsonb_build_object(
    'ok',true,'audit_id',v_audit_id,'auth_user_ids',to_jsonb(v_auth_user_ids),'executed_at',clock_timestamp());
exception
  when others then
    if v_audit_id is not null then
      update public.customer_account_deletion_audit
      set status='failed',metadata=metadata||jsonb_build_object('failure_class',sqlstate)
      where id=v_audit_id;
    end if;
    raise;
end;
$function$;

revoke all on function public.delete_customer_account_service_safe(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.delete_customer_account_service_safe(uuid,uuid,text)
  to service_role;
