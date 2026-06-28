-- Fase 9.14E.11 — Remove authenticated de auxiliares legadas de Configurações
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções antigas/auxiliares sem uso direto atual no frontend/admin.
--
-- Funções tratadas:
-- - public.update_store_identity_settings(uuid, text, text, text)
-- - public.can_access_settings_section(uuid, text, boolean)
-- - public.can_access_settings_section_v3(uuid, text, boolean)
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção e chamadas internas privilegiadas.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.update_store_identity_settings(uuid, text, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_settings_section(uuid, text, boolean)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_settings_section_v3(uuid, text, boolean)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_store_identity_settings(uuid, text, text, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.can_access_settings_section(uuid, text, boolean)
TO service_role;

GRANT EXECUTE ON FUNCTION public.can_access_settings_section_v3(uuid, text, boolean)
TO service_role;

COMMIT;
