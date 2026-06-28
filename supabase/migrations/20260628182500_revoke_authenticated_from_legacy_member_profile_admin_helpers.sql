-- Fase 9.14E.17 — Remove authenticated de membros/perfil administrativo legados
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções sem uso direto atual identificado no frontend/admin.
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_my_store_memberships()
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_store_member_access_timeline(uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_user_avatar(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.list_store_profile_change_requests(uuid, text, text, integer, integer)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.propose_store_profile_change_request(uuid, jsonb, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.review_store_profile_change_request(uuid, text, text)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_store_member_profile_details(
  uuid,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.update_store_member_status(uuid, text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_store_memberships()
TO service_role;

GRANT EXECUTE ON FUNCTION public.get_store_member_access_timeline(uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.can_manage_user_avatar(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.list_store_profile_change_requests(uuid, text, text, integer, integer)
TO service_role;

GRANT EXECUTE ON FUNCTION public.propose_store_profile_change_request(uuid, jsonb, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.review_store_profile_change_request(uuid, text, text)
TO service_role;

GRANT EXECUTE ON FUNCTION public.update_store_member_profile_details(
  uuid,
  text,
  text,
  text,
  text,
  text,
  date,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
TO service_role;

GRANT EXECUTE ON FUNCTION public.update_store_member_status(uuid, text, text)
TO service_role;

COMMIT;
