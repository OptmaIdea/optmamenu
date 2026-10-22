alter table public.customer_account_deletion_audit
  drop constraint if exists customer_account_deletion_audit_status_check;

alter table public.customer_account_deletion_audit
  add constraint customer_account_deletion_audit_status_check
  check (status in ('pending','processing','executed','failed','cancelled'));

create unique index if not exists uq_customer_account_deletion_pending
  on public.customer_account_deletion_audit(store_id,customer_id_snapshot)
  where status in ('pending','processing');

create or replace function public.create_customer_account_deletion_request_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_source text default 'customer_portal'
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if not exists (
    select 1 from public.customers
    where id=p_customer_id and store_id=p_store_id
      and coalesce(status,'active')='active'
      and merged_into_customer_id is null
  ) then
    return jsonb_build_object('ok',false,'error','customer_not_found');
  end if;

  select id into v_id
  from public.customer_account_deletion_audit
  where store_id=p_store_id and customer_id_snapshot=p_customer_id
    and status in ('pending','processing')
  order by requested_at desc limit 1;

  if v_id is not null then
    return jsonb_build_object('ok',true,'request_id',v_id,'already_pending',true);
  end if;

  insert into public.customer_account_deletion_audit(
    store_id,customer_id_snapshot,status,request_source,reauth_method,requested_at,metadata
  )
  values(
    p_store_id,p_customer_id,'pending',
    coalesce(nullif(trim(p_source),''),'customer_portal'),
    'password+otp',clock_timestamp(),
    jsonb_build_object('requested_by','customer_self_service')
  )
  returning id into v_id;

  return jsonb_build_object('ok',true,'request_id',v_id,'already_pending',false);
end;
$function$;

revoke all on function public.create_customer_account_deletion_request_service_safe(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.create_customer_account_deletion_request_service_safe(uuid,uuid,text)
  to service_role;
