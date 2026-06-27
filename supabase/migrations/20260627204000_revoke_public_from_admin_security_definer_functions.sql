-- Fase 9.14B — Complemento de hardening SECURITY DEFINER
--
-- Diagnóstico pós-primeira migration mostrou que revogar apenas de anon
-- não foi suficiente para várias funções, porque EXECUTE pode estar herdado
-- do pseudo-role PUBLIC.
--
-- Objetivo:
-- Revogar EXECUTE de PUBLIC e anon nas funções administrativas/internas,
-- concedendo explicitamente authenticated onde o frontend/admin precisa.
--
-- Não altera funções públicas intencionais de loja pública, pedido público,
-- OTP/login de cliente ou consultas públicas por slug.

BEGIN;

-- =========================================================
-- Grupo A — funções administrativas/privadas
-- =========================================================

REVOKE EXECUTE ON FUNCTION public.can_access_security_section(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_security_section_v3(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_settings_section(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_settings_section_v3(uuid, text, boolean) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.get_default_admin_landing_path_v3(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_effective_store_member_permissions_v2(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_login_store_options() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_visible_activity_logs(uuid, date, date, text, text) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.get_store_permission_catalog() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_store_permission_matrix(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_store_permission_matrix_v3(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.get_store_security_activity_logs(uuid, date, date, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_store_security_settings(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_store_settings_center(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.update_security_log_member_visibility(uuid, boolean, boolean) FROM PUBLIC, anon;
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
) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_store_idle_timeout_settings(uuid, boolean, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_store_member_permissions(uuid, jsonb, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_store_role_permission_template(uuid, text, text, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_store_settings_section(uuid, text, jsonb) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.validate_store_slug(uuid, text) FROM PUBLIC, anon;

-- Grants explícitos para uso autenticado/admin.
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
GRANT EXECUTE ON FUNCTION public.validate_store_slug(uuid, text) TO authenticated;

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
) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_store_role_permissions_for_new_store_v3() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_store_role_permission_v3(uuid, text, text, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_store_role_permissions_bulk_v3(uuid, text, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_permission_catalog_v3() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.touch_store_permission_version(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.trg_touch_store_permission_version() FROM PUBLIC, anon;

-- authenticated fica preservado para funções internas nesta rodada
-- apenas para evitar regressão em fluxos legados. A retirada de
-- authenticated será avaliada em rodada posterior por dependência real.

COMMIT;
