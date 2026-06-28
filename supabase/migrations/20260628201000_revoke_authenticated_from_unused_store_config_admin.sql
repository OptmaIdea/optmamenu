-- Fase 9.14E.23 — Remove authenticated de escrita legada de config admin
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de RPC de escrita de configuração sem uso direto atual identificado.
--
-- Esta migration não dropa a função.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.update_store_config_admin(uuid, jsonb)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.update_store_config_admin(uuid, jsonb)
TO service_role;

COMMIT;
