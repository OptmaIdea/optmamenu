-- POS_9 / v0.9.14 — HOTFIX V2 Usuários e Equipe
-- Objetivo:
-- - Corrigir erro 403 na página de Usuários por falta de EXECUTE em RPCs.
-- - Não falhar quando alguma RPC opcional não existir ou tiver assinatura diferente.
--
-- Erros observados no console:
-- - permission denied for function get_store_members_v2
-- - permission denied for function list_store_profile_change_requests
--
-- Uso:
-- 1. Rode este arquivo no Supabase SQL Editor.
-- 2. Confira se authenticated_can_execute = true para get_store_members_v2.
-- 3. Faça hard refresh na página de Usuários.

DO $$
DECLARE
  fn record;
  v_found_get_members boolean := false;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_store_members_v2',
        'list_store_profile_change_requests',
        'create_store_member_invite',
        'add_store_member_by_email',
        'accept_store_member_invite',
        'cancel_store_member_invite',
        'resend_store_member_invite',
        'update_store_member_role',
        'update_store_member_status',
        'remove_store_member',
        'invite_store_member',
        'create_user_invite',
        'list_store_invites',
        'get_store_invites'
      )
  LOOP
    IF fn.function_name = 'get_store_members_v2' THEN
      v_found_get_members := true;
    END IF;

    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', fn.schema_name, fn.function_name, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', fn.schema_name, fn.function_name, fn.args);
  END LOOP;

  IF NOT v_found_get_members THEN
    RAISE EXCEPTION 'Função public.get_store_members_v2 não encontrada em nenhuma assinatura.';
  END IF;
END $$;

-- Recarrega o cache do PostgREST/Supabase API.
NOTIFY pgrst, 'reload schema';

SELECT
  'users_rpcs_execute_grants_v2' AS section,
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'get_store_members_v2',
    'list_store_profile_change_requests',
    'create_store_member_invite',
    'add_store_member_by_email',
    'accept_store_member_invite',
    'cancel_store_member_invite',
    'resend_store_member_invite',
    'update_store_member_role',
    'update_store_member_status',
    'remove_store_member',
    'invite_store_member',
    'create_user_invite',
    'list_store_invites',
    'get_store_invites'
  )
ORDER BY p.proname, args;
