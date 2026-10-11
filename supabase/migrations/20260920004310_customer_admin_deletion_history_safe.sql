create or replace function public.get_customer_account_deletion_history_safe(
  p_store_id uuid,
  p_customer_id uuid default null,
  p_limit integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_events jsonb := '[]'::jsonb;
  v_role text := coalesce(auth.role(), '');
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id', 'events', '[]'::jsonb);
  end if;

  if v_role <> 'service_role' then
    if auth.uid() is null or not (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission(p_store_id, 'customers.view')
      or public.user_has_store_permission(p_store_id, 'customers.manage')
    ) then
      return jsonb_build_object('ok', false, 'error', 'access_denied', 'events', '[]'::jsonb);
    end if;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'customer_id_snapshot', a.customer_id_snapshot,
        'status', a.status,
        'request_source', a.request_source,
        'reauth_method', a.reauth_method,
        'requested_at', a.requested_at,
        'executed_at', a.executed_at,
        'execution_summary', coalesce(a.execution_summary, '{}'::jsonb)
      )
      order by a.requested_at desc, a.id desc
    ),
    '[]'::jsonb
  )
  into v_events
  from (
    select
      id,
      customer_id_snapshot,
      status,
      request_source,
      reauth_method,
      requested_at,
      executed_at,
      execution_summary
    from public.customer_account_deletion_audit
    where store_id = p_store_id
      and (p_customer_id is null or customer_id_snapshot = p_customer_id)
    order by requested_at desc, id desc
    limit greatest(1, least(coalesce(p_limit, 100), 500))
  ) a;

  return jsonb_build_object('ok', true, 'events', v_events);
end;
$function$;

revoke all on function public.get_customer_account_deletion_history_safe(uuid, uuid, integer)
  from public, anon;
grant execute on function public.get_customer_account_deletion_history_safe(uuid, uuid, integer)
  to authenticated, service_role;

comment on function public.get_customer_account_deletion_history_safe(uuid, uuid, integer)
is 'Lista histórico administrativo sanitizado de solicitações/exclusões de contas de clientes por loja, sem expor evidência legal ou PII retida.';
