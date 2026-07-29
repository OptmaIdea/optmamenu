-- POS_9 / v0.9.14 — HOTFIX Usuários e Equipe
-- Objetivo:
-- - Corrigir erro 403 na página de Usuários causado por falta de EXECUTE nas RPCs.
-- - Destravar envio de convites em ambiente já publicado na Vercel.
--
-- Erros observados:
-- - permission denied for function get_store_members_v2
-- - permission denied for function list_store_profile_change_requests
--
-- Uso:
-- 1. Rode este arquivo no Supabase SQL Editor.
-- 2. Faça hard refresh na página de Usuários.

DO $$
BEGIN
  IF to_regprocedure('public.get_store_members_v2(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Função public.get_store_members_v2(uuid) não encontrada.';
  END IF;

  IF to_regprocedure('public.list_store_profile_change_requests(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Função public.list_store_profile_change_requests(uuid) não encontrada.';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.get_store_members_v2(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_store_profile_change_requests(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_store_members_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_store_profile_change_requests(uuid) TO authenticated;

-- Pré-libera também as RPCs normalmente usadas na tela para convite/gestão.
-- Caso alguma assinatura varie, o bloco apenas ignora e segue.
DO $$
DECLARE
  fn record;
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
        'create_store_member_invite',
        'add_store_member_by_email',
        'accept_store_member_invite',
        'cancel_store_member_invite',
        'resend_store_member_invite',
        'update_store_member_role',
        'update_store_member_status',
        'remove_store_member'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC', fn.schema_name, fn.function_name, fn.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', fn.schema_name, fn.function_name, fn.args);
  END LOOP;
END $$;

-- Recarrega o cache do PostgREST/Supabase API.
NOTIFY pgrst, 'reload schema';

SELECT
  'users_rpcs_execute_grants' AS section,
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
    'remove_store_member'
  )
ORDER BY p.proname, args;
