-- Fase 9.14E.21 — Remove authenticated de helpers legados de loja/identidade
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de helpers sem uso direto atual identificado no frontend/admin.
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_user_store_id()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_display_identity(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_store_id()
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_display_identity(uuid)
TO service_role;

COMMIT;
