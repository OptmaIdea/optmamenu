-- POS_9 — Correção pós-hardening
--
-- Motivo:
-- `get_current_user_security_context_v2()` foi classificada como legado na 9.14E13,
-- mas ainda é usada pelo frontend em `src/services/securityService.ts` logo após o login.
--
-- Correção:
-- Restaurar execução para `authenticated`, mantendo `anon` e `PUBLIC` bloqueados.

REVOKE ALL ON FUNCTION public.get_current_user_security_context_v2() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_user_security_context_v2() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_current_user_security_context_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_security_context_v2() TO service_role;
