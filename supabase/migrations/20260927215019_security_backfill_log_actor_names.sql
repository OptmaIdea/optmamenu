
with identities as (
  select l.id, identity_row.user_name, identity_row.user_email
  from public.store_security_logs l
  cross join lateral public.get_user_display_identity(l.user_id) as identity_row
  where l.user_id is not null
    and (
      nullif(trim(coalesce(l.user_name,'')),'') is null
      or nullif(trim(coalesce(l.user_email,'')),'') is null
    )
)
update public.store_security_logs l
set
  user_name=coalesce(nullif(trim(l.user_name),''),identities.user_name),
  user_email=coalesce(nullif(trim(l.user_email),''),identities.user_email)
from identities
where l.id=identities.id;

update public.store_security_logs
set display_action=public.translate_security_action_ptbr(action)
where action='session_heartbeat';
