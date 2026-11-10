create or replace function public.get_customer_self_account_deletion_request_safe()
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_customer_id uuid:=public.app_current_customer_id();
  v_store_id uuid:=public.app_current_store_id();
  v_row record;
begin
  if public.app_current_role()<>'customer' or v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  select id,status,requested_at,executed_at into v_row
  from public.customer_account_deletion_audit
  where store_id=v_store_id and customer_id_snapshot=v_customer_id
    and status in ('pending','processing','executed')
  order by requested_at desc limit 1;

  if not found then return jsonb_build_object('ok',true,'request',null); end if;

  return jsonb_build_object(
    'ok',true,
    'request',jsonb_build_object(
      'id',v_row.id,'status',v_row.status,
      'requested_at',v_row.requested_at,'executed_at',v_row.executed_at
    )
  );
end;
$function$;

revoke all on function public.get_customer_self_account_deletion_request_safe()
  from public,anon;
grant execute on function public.get_customer_self_account_deletion_request_safe()
  to authenticated;
