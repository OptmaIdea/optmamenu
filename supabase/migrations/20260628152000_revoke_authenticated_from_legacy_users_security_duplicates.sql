-- Fase 9.14E.14 — Remove authenticated de funções legadas/duplicadas de Usuários/Segurança
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções antigas que possuem caminhos v2/v3 ou substitutos operacionais.
--
-- Funções tratadas:
-- - public.get_store_permission_matrix(uuid)
-- - public.update_store_role_permission_template(uuid, text, text, boolean, text)
-- - public.get_store_members(uuid)
-- - public.get_store_members_v2(uuid)
-- - public.update_store_member_role(uuid, text, text)
-- - public.add_store_member_by_email(uuid, text, text, text, jsonb, jsonb)
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_store_permission_matrix(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_store_role_permission_template(uuid, text, text, boolean, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_store_members(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_store_members_v2(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_store_member_role(uuid, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.add_store_member_by_email(uuid, text, text, text, jsonb, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_store_permission_matrix(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.update_store_role_permission_template(uuid, text, text, boolean, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_store_members(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_store_members_v2(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.update_store_member_role(uuid, text, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.add_store_member_by_email(uuid, text, text, text, jsonb, jsonb)
TO service_role;

COMMIT;
