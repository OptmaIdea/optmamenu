-- Fix get_store_security_activity_logs to display member's internal alias (nickname)
CREATE OR REPLACE FUNCTION public.get_store_security_activity_logs(
  p_store_id uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date,
  p_user_filter text DEFAULT NULL::text,
  p_action_filter text DEFAULT NULL::text,
  p_outcome text DEFAULT NULL::text
)
RETURNS TABLE(
  id uuid,
  store_id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  action text,
  display_action text,
  details jsonb,
  outcome text,
  sensitive boolean,
  visible_to_member boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if p_store_id is null then
    raise exception 'Loja não informada.';
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'security.logs.view')
    or public.user_has_store_permission(p_store_id, 'security.logs.manage')
    or public.user_has_store_permission(p_store_id, 'security.manage')
  ) then
    raise exception 'Acesso não autorizado aos logs da loja.';
  end if;

  return query
  select
    l.id,
    l.store_id,
    l.user_id,
    coalesce(sm.internal_alias, l.user_name, 'Usuário')::text as user_name,
    l.user_email,
    l.action,
    coalesce(l.display_action, public.translate_security_action_ptbr(l.action)) as display_action,
    l.details,
    l.outcome,
    l.sensitive,
    l.visible_to_member,
    l.created_at
  from public.store_security_logs l
  left join public.store_members sm on sm.user_id = l.user_id and sm.store_id = l.store_id
  where l.store_id = p_store_id
    and (p_start_date is null or l.created_at::date >= p_start_date)
    and (p_end_date is null or l.created_at::date <= p_end_date)
    and (
      p_user_filter is null
      or coalesce(sm.internal_alias, l.user_name, 'Usuário') ilike '%' || p_user_filter || '%'
      or l.user_email ilike '%' || p_user_filter || '%'
    )
    and (
      p_action_filter is null
      or l.action ilike '%' || p_action_filter || '%'
      or coalesce(l.display_action, public.translate_security_action_ptbr(l.action)) ilike '%' || p_action_filter || '%'
    )
    and (p_outcome is null or l.outcome = p_outcome)
  order by l.created_at desc;
end;
$$;

REVOKE ALL ON FUNCTION public.get_store_security_activity_logs(uuid, date, date, text, text, text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_store_security_activity_logs(uuid, date, date, text, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.get_store_security_activity_logs(uuid, date, date, text, text, text) TO service_role;

notify pgrst, 'reload schema';
