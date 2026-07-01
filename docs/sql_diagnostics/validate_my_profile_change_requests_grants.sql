-- POS_9 — Validação /admin/my-profile — grants de list_my_profile_change_requests
--
-- Execute após aplicar:
-- supabase/migrations/20260701125500_restore_authenticated_my_profile_change_requests.sql

select
  'function_grants' as section,
  grantee,
  privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'list_my_profile_change_requests'
order by grantee, privilege_type;

select
  'expected' as section,
  exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'list_my_profile_change_requests'
      and grantee = 'authenticated'
      and privilege_type = 'EXECUTE'
  ) as authenticated_can_execute,
  exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'list_my_profile_change_requests'
      and grantee = 'anon'
      and privilege_type = 'EXECUTE'
  ) as anon_can_execute,
  exists (
    select 1
    from information_schema.routine_privileges
    where routine_schema = 'public'
      and routine_name = 'list_my_profile_change_requests'
      and grantee = 'PUBLIC'
      and privilege_type = 'EXECUTE'
  ) as public_can_execute;
