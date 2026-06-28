-- Fase 9.14E.16 — Remove authenticated de logs/helpers legados de Segurança
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções legadas de consulta de logs e helper de tradução sem uso direto atual.
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_store_security_logs(integer)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_store_security_logs(uuid, integer, date, date, text, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.translate_security_action_ptbr(text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_store_security_logs(integer)
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_store_security_logs(uuid, integer, date, date, text, text, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.translate_security_action_ptbr(text)
TO service_role;

COMMIT;
