-- Fase 9.14E.1 — Hardening de funções técnicas autenticadas
--
-- Objetivo:
-- Remover EXECUTE de authenticated de funções SECURITY DEFINER técnicas,
-- triggers ou rotinas internas que não devem ser chamadas diretamente pelo frontend.
--
-- Não altera funções operacionais/admin usadas pelo frontend.
-- Não remove authenticated de:
-- - set_store_role_permission_v3
-- - set_store_role_permissions_bulk_v3
-- pois são usadas pelo fluxo administrativo de permissões por papel.

BEGIN;

-- Função de trigger de movimento/estoque.
REVOKE EXECUTE ON FUNCTION public.register_stock_movement() FROM authenticated;

-- Funções técnicas de catálogo/permissões.
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
) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_store_role_permissions_for_new_store_v3() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_permission_catalog_v3() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_store_permission_version(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_touch_store_permission_version() FROM authenticated;

-- Rotinas técnicas de sincronização de fornecedor/preço.
REVOKE EXECUTE ON FUNCTION public.sync_supplier_metrics_document(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_supplier_price_history_for_document(uuid) FROM authenticated;

-- Preserva service_role explicitamente para manutenção/execução privilegiada.
GRANT EXECUTE ON FUNCTION public.register_stock_movement() TO service_role;
GRANT EXECUTE ON FUNCTION public.register_store_permission_v3(
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
) TO service_role;
GRANT EXECUTE ON FUNCTION public.seed_store_role_permissions_for_new_store_v3() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_permission_catalog_v3() TO service_role;
GRANT EXECUTE ON FUNCTION public.touch_store_permission_version(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.trg_touch_store_permission_version() TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_supplier_metrics_document(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_supplier_price_history_for_document(uuid) TO service_role;

COMMIT;
