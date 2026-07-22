begin;

grant execute on function public.get_store_member_access_timeline(uuid, uuid) to authenticated;

create or replace function public.accept_store_member_invite(p_store_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_invite public.store_member_invites%rowtype;
  v_member_id uuid;
  v_invite_alias text;
begin
  if v_user_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select email::text into v_email
  from auth.users
  where id = v_user_id;

  if v_email is null then
    raise exception 'E-mail do usuário autenticado não encontrado.';
  end if;

  select * into v_invite
  from public.store_member_invites
  where store_id = p_store_id
    and normalized_email = lower(btrim(v_email))
    and status = 'pending'
  order by invited_at desc
  limit 1;

  if not found then
    raise exception 'Convite pendente não encontrado para este e-mail.';
  end if;

  if v_invite.expires_at < now() then
    update public.store_member_invites
    set status = 'expired', updated_at = now()
    where id = v_invite.id;
    raise exception 'Convite expirado.';
  end if;

  v_invite_alias := nullif(trim(coalesce(
    v_invite.metadata->>'invite_alias',
    v_invite.metadata->>'invite_name',
    ''
  )), '');

  insert into public.store_members (
    store_id, user_id, role, status, permissions, sensitive_actions,
    internal_alias, member_email, invited_by, invited_at, accepted_at
  ) values (
    v_invite.store_id, v_user_id, v_invite.role, 'active',
    coalesce(v_invite.permissions, '{}'::jsonb),
    coalesce(v_invite.sensitive_actions, '{}'::jsonb),
    v_invite_alias, lower(btrim(v_email)),
    v_invite.invited_by, v_invite.invited_at, now()
  )
  on conflict (store_id, user_id)
  do update set
    role = excluded.role,
    status = 'active',
    permissions = excluded.permissions,
    sensitive_actions = excluded.sensitive_actions,
    internal_alias = coalesce(public.store_members.internal_alias, excluded.internal_alias),
    member_email = coalesce(nullif(trim(public.store_members.member_email), ''), excluded.member_email),
    updated_at = now()
  returning id into v_member_id;

  update public.store_member_invites
  set status = 'accepted', accepted_at = now(), accepted_by = v_user_id, updated_at = now()
  where id = v_invite.id;

  insert into public.store_security_logs (
    store_id, user_id, user_email, action, details, outcome, created_at
  ) values (
    v_invite.store_id,
    v_user_id,
    v_email,
    'store_member_invite_accepted',
    jsonb_build_object('invite_id', v_invite.id, 'member_id', v_member_id, 'role', v_invite.role),
    'success',
    now()
  );

  return jsonb_build_object(
    'mode', 'accepted_invite',
    'invite_id', v_invite.id,
    'member_id', v_member_id,
    'store_id', v_invite.store_id,
    'user_id', v_user_id,
    'email', v_email,
    'role', v_invite.role,
    'status', 'active'
  );
end;
$function$;

grant execute on function public.accept_store_member_invite(uuid) to authenticated;

update public.store_members sm
set member_email = lower(btrim(au.email::text)),
    updated_at = now()
from auth.users au
where au.id = sm.user_id
  and au.email is not null
  and nullif(trim(sm.member_email), '') is null;

notify pgrst, 'reload schema';

commit;
