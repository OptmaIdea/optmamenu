-- Fase 9.14E.13 — Remove authenticated de contextos/gates legados de Segurança
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções antigas/helper sem uso direto atual no frontend/admin.
--
-- Funções tratadas:
-- - public.can_access_security_section(uuid, text, boolean)
-- - public.can_access_security_section_v3(uuid, text, boolean)
-- - public.get_current_user_security_context()
-- - public.get_current_user_security_context_v2()
-- - public.get_effective_store_permissions(uuid)
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.can_access_security_section(uuid, text, boolean)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_security_section_v3(uuid, text, boolean)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_current_user_security_context()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_current_user_security_context_v2()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_effective_store_permissions(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_access_security_section(uuid, text, boolean)
TO service_role;

GRANT EXECUTE ON FUNCTION public.can_access_security_section_v3(uuid, text, boolean)
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_current_user_security_context()
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_current_user_security_context_v2()
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_effective_store_permissions(uuid)
TO service_role;

COMMIT;
