-- Fase 9.14E.18 — Remove authenticated de helpers de permissões sem uso direto atual
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de helpers remanescentes sem chamada operacional atual identificada.
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_effective_store_member_permissions_v2(uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_store_permission_catalog()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_security_log_member_visibility(uuid, boolean, boolean)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_effective_store_member_permissions_v2(uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_store_permission_catalog()
TO service_role;

GRANT EXECUTE ON FUNCTION public.update_security_log_member_visibility(uuid, boolean, boolean)
TO service_role;

COMMIT;
