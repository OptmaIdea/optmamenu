-- POS_9 — Correção /admin/my-profile — restaura leitura de solicitações do meu perfil
--
-- Problema observado:
-- /admin/my-profile carrega dados, mas gera 403 no console ao chamar:
-- public.list_my_profile_change_requests(uuid, integer)
--
-- Causa:
-- A migration 20260628154500_revoke_authenticated_from_legacy_profile_onboarding_helpers.sql
-- removeu authenticated dessa função, mas a tela de Meu Perfil ainda usa a RPC para listar
-- solicitações cadastrais do próprio usuário.
--
-- Correção:
-- Restaurar somente EXECUTE para authenticated nesta função de leitura.
-- Manter PUBLIC e anon sem acesso.

BEGIN;

REVOKE ALL ON FUNCTION public.list_my_profile_change_requests(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_my_profile_change_requests(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_my_profile_change_requests(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_my_profile_change_requests(uuid, integer) TO service_role;

COMMIT;
