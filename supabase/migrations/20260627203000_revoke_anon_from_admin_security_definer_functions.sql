-- Fase 9.14B — Hardening inicial de funções SECURITY DEFINER
--
-- Objetivo:
-- Remover EXECUTE do role anon em funções administrativas, privadas e internas
-- apontadas pelo Advisor como SECURITY DEFINER executáveis publicamente.
--
-- Esta migration NÃO altera funções públicas intencionais da loja pública,
-- pedido público, OTP/login de cliente ou consulta pública por slug.
--
-- Também ajusta validate_store_slug para o uso real atual:
-- admin/configurações via authenticated, não fluxo público anon.

BEGIN;

-- =========================================================
-- Grupo A — funções administrativas/privadas
-- =========================================================

REVOKE EXECUTE ON FUNCTION public.can_access_security_section(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_security_section_v3(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_settings_section(uuid, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_settings_section_v3(uuid, text, boolean) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_default_admin_landing_path_v3(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_effective_store_member_permissions_v2(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_login_store_options() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_visible_activity_logs(uuid, date, date, text, text) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_store_permission_catalog() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_permission_matrix(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_permission_matrix_v3(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_store_security_activity_logs(uuid, date, date, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_security_settings(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_settings_center(uuid) FROM anon;

REVOKE EXECUTE ON FUNCTION public.update_security_log_member_visibility(uuid, boolean, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_store_identity_settings(
    uuid,
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
    jsonb,
    jsonb,
    jsonb,
    text,
    text,
    text,
    text,
    text
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_store_idle_timeout_settings(uuid, boolean, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_store_member_permissions(uuid, jsonb, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_store_role_permission_template(uuid, text, text, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_store_settings_section(uuid, text, jsonb) FROM anon;

-- validate_store_slug é usado atualmente pelo admin/configurações.
-- O diagnóstico confirmou anon=true e authenticated=false.
REVOKE EXECUTE ON FUNCTION public.validate_store_slug(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_store_slug(uuid, text) TO authenticated;

-- Garantia explícita para funções admin que o frontend autenticado usa.
GRANT EXECUTE ON FUNCTION public.can_access_security_section(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_security_section_v3(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_settings_section(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_settings_section_v3(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_admin_landing_path_v3(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_effective_store_member_permissions_v2(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_store_options() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_visible_activity_logs(uuid, date, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_permission_catalog() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_permission_matrix(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_permission_matrix_v3(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_security_activity_logs(uuid, date, date, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_security_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_settings_center(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_security_log_member_visibility(uuid, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_identity_settings(
    uuid,
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
    jsonb,
    jsonb,
    jsonb,
    text,
    text,
    text,
    text,
    text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_idle_timeout_settings(uuid, boolean, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_member_permissions(uuid, jsonb, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_role_permission_template(uuid, text, text, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_settings_section(uuid, text, jsonb) TO authenticated;

-- =========================================================
-- Grupo B — funções internas/técnicas
-- =========================================================

REVOKE EXECUTE ON FUNCTION public.register_store_permission_v3(
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
    jsonb,
    integer,
    boolean
) FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_store_role_permissions_for_new_store_v3() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_store_role_permission_v3(uuid, text, text, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_store_role_permissions_bulk_v3(uuid, text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_permission_catalog_v3() FROM anon;
REVOKE EXECUTE ON FUNCTION public.touch_store_permission_version(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.trg_touch_store_permission_version() FROM anon;

-- Nesta primeira rodada, authenticated é preservado para funções internas/técnicas
-- para evitar regressão caso algum fluxo legado ainda dependa delas.
-- A retirada de authenticated deve ser avaliada em rodada posterior.

COMMIT;
