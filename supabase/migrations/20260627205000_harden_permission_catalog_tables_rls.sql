-- Fase 9.14C — Hardening RLS/tabelas apontadas pelo Advisor
--
-- Objetivo:
-- Proteger tabelas públicas de permissões que estavam sem RLS e com grants amplos
-- para anon/authenticated.
--
-- Tabelas tratadas:
-- - public.store_permission_catalog
-- - public.store_role_permission_templates_backup_910c
--
-- Decisão:
-- - habilitar RLS nas duas tabelas;
-- - remover grants diretos amplos de anon/authenticated;
-- - manter acesso via RPCs SECURITY DEFINER já controladas;
-- - preservar service_role;
-- - não remover a tabela backup nesta etapa.

BEGIN;

-- =========================================================
-- store_permission_catalog
-- =========================================================

ALTER TABLE public.store_permission_catalog ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.store_permission_catalog FROM anon;
REVOKE ALL ON TABLE public.store_permission_catalog FROM authenticated;
REVOKE ALL ON TABLE public.store_permission_catalog FROM PUBLIC;

-- A tabela segue acessível por funções SECURITY DEFINER controladas,
-- como get_store_permission_catalog e get_store_permission_matrix_v3.
-- service_role permanece com acesso operacional.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.store_permission_catalog
TO service_role;

-- =========================================================
-- store_role_permission_templates_backup_910c
-- =========================================================

ALTER TABLE public.store_role_permission_templates_backup_910c ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.store_role_permission_templates_backup_910c FROM anon;
REVOKE ALL ON TABLE public.store_role_permission_templates_backup_910c FROM authenticated;
REVOKE ALL ON TABLE public.store_role_permission_templates_backup_910c FROM PUBLIC;

-- Backup/legado: não deve ser acessível por anon/authenticated.
-- Mantém acesso operacional pelo service_role para inspeção/manutenção.
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.store_role_permission_templates_backup_910c
TO service_role;

COMMIT;
