-- Fase 9.14F — Policies explícitas de negação para tabelas de permissões
--
-- Objetivo:
-- Tratar o Advisor rls_enabled_no_policy sem abrir acesso direto.
--
-- As tabelas abaixo devem permanecer fechadas para anon/authenticated.
-- A policy USING(false)/WITH CHECK(false) documenta a intenção no banco
-- e mantém bloqueio mesmo se algum grant direto for reintroduzido por engano.
--
-- Tabelas:
-- - public.store_permission_catalog
-- - public.store_role_permission_templates_backup_910c

BEGIN;

-- Garante RLS ligado antes das policies.
ALTER TABLE public.store_permission_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_role_permission_templates_backup_910c ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- public.store_permission_catalog
-- =========================================================

DROP POLICY IF EXISTS deny_direct_client_access_store_permission_catalog
ON public.store_permission_catalog;

CREATE POLICY deny_direct_client_access_store_permission_catalog
ON public.store_permission_catalog
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Mantém ausência de grants diretos para clients.
REVOKE ALL ON TABLE public.store_permission_catalog FROM anon;
REVOKE ALL ON TABLE public.store_permission_catalog FROM authenticated;
REVOKE ALL ON TABLE public.store_permission_catalog FROM PUBLIC;

-- =========================================================
-- public.store_role_permission_templates_backup_910c
-- =========================================================

DROP POLICY IF EXISTS deny_direct_client_access_store_role_permission_templates_backup_910c
ON public.store_role_permission_templates_backup_910c;

CREATE POLICY deny_direct_client_access_store_role_permission_templates_backup_910c
ON public.store_role_permission_templates_backup_910c
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

-- Mantém ausência de grants diretos para clients.
REVOKE ALL ON TABLE public.store_role_permission_templates_backup_910c FROM anon;
REVOKE ALL ON TABLE public.store_role_permission_templates_backup_910c FROM authenticated;
REVOKE ALL ON TABLE public.store_role_permission_templates_backup_910c FROM PUBLIC;

COMMIT;
