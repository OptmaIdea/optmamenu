-- Fase 9.14E.22 — Remove authenticated de helpers sensíveis/legados do grupo uncategorized
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções sensíveis sem uso direto atual identificado no frontend/admin.
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.perform_manual_adjustment(uuid, integer, text, text, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.reset_user_pin_with_password(text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.perform_manual_adjustment(uuid, integer, text, text, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.reset_user_pin_with_password(text, text)
TO service_role;

COMMIT;
