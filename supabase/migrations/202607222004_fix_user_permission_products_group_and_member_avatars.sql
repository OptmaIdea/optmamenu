drop function if exists public.get_store_members_for_permissions(uuid);

create function public.get_store_members_for_permissions(p_store_id uuid)
returns table(
  member_id uuid,
  store_id uuid,
  user_id uuid,
  user_name text,
  user_email text,
  role text,
  status text,
  permissions jsonb,
  sensitive_actions jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  custom_role_id uuid,
  custom_role_name text,
  profile_avatar_url text,
  avatar_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    sm.id as member_id,
    sm.store_id,
    sm.user_id,
    coalesce(p.name, au.raw_user_meta_data->>'display_name', au.raw_user_meta_data->>'name', au.email, sm.user_id::text)::text as user_name,
    au.email::text as user_email,
    sm.role,
    sm.status,
    coalesce(sm.permissions, '{}'::jsonb) as permissions,
    coalesce(sm.sensitive_actions, '{}'::jsonb) as sensitive_actions,
    sm.created_at,
    sm.updated_at,
    sm.custom_role_id,
    scr.name::text as custom_role_name,
    p.avatar_url::text as profile_avatar_url,
    coalesce(sm.member_avatar_url, p.avatar_url)::text as avatar_url
  from public.store_members sm
  left join public.profiles p on p.id = sm.user_id
  left join auth.users au on au.id = sm.user_id
  left join public.store_custom_roles scr
    on scr.id = sm.custom_role_id
   and scr.store_id = sm.store_id
   and scr.active = true
  where sm.store_id = p_store_id
    and sm.status = 'active'
    and sm.role <> 'owner'
    and (
      public.app_is_store_owner(p_store_id)
      or public.user_has_store_permission(p_store_id, 'users.manage')
      or public.user_has_store_permission(p_store_id, 'security.manage')
    )
  order by
    case sm.role
      when 'admin' then 1
      when 'manager' then 2
      when 'stock_operator' then 3
      when 'cashier' then 4
      when 'sales' then 5
      when 'staff' then 6
      when 'viewer' then 7
      else 99
    end,
    coalesce(p.name, au.email, sm.user_id::text);
$$;

revoke all on function public.get_store_members_for_permissions(uuid) from public;
grant execute on function public.get_store_members_for_permissions(uuid) to authenticated;

notify pgrst, 'reload schema';