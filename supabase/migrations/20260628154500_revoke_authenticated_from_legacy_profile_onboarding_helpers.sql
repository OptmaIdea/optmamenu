-- Fase 9.14E.15 — Remove authenticated de perfil próprio/onboarding legados
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções de perfil próprio/onboarding/solicitações sem uso direto atual.
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.complete_my_store_member_onboarding(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_my_store_member_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_my_store_member_alias(uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_my_profile_change_request(
  uuid, text, jsonb, text, boolean, jsonb
)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_my_profile_change_request_v2(
  uuid, text, jsonb, text, boolean, jsonb
)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.list_my_profile_change_requests(uuid, integer)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.respond_my_profile_change_request(uuid, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_my_profile_change_request(uuid, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_visible_store_member_history(uuid, integer)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_my_store_member_onboarding(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
)
TO service_role;

GRANT EXECUTE ON FUNCTION public.update_my_store_member_profile(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text
)
TO service_role;

GRANT EXECUTE ON FUNCTION public.update_my_store_member_alias(uuid, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.create_my_profile_change_request(
  uuid, text, jsonb, text, boolean, jsonb
)
TO service_role;

GRANT EXECUTE ON FUNCTION public.create_my_profile_change_request_v2(
  uuid, text, jsonb, text, boolean, jsonb
)
TO service_role;

GRANT EXECUTE ON FUNCTION public.list_my_profile_change_requests(uuid, integer)
TO service_role;

GRANT EXECUTE ON FUNCTION public.respond_my_profile_change_request(uuid, text, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.cancel_my_profile_change_request(uuid, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_my_visible_store_member_history(uuid, integer)
TO service_role;

COMMIT;
