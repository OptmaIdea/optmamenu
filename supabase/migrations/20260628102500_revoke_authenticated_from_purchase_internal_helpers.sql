-- Fase 9.14E.10 — Remove authenticated de auxiliares internas de compras
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções de compras/fornecedores sem uso direto atual no frontend/admin.
--
-- Funções tratadas:
-- - public.apply_purchase_document_to_default_location(uuid, uuid)
-- - public.is_supplier_purchase_eligible(uuid)
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção e chamadas internas privilegiadas.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.apply_purchase_document_to_default_location(uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_supplier_purchase_eligible(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_purchase_document_to_default_location(uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.is_supplier_purchase_eligible(uuid)
TO service_role;

COMMIT;
