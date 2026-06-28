-- Fase 9.14E.8 — Remove authenticated de resumo de inventário sem uso atual
--
-- Objetivo:
-- Reduzir a superfície SECURITY DEFINER autenticada removendo acesso direto
-- de função de leitura agregada sem uso operacional atual identificado.
--
-- Função tratada:
-- - public.get_inventory_criticality_summary(uuid)
--
-- Esta migration não dropa a função.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_inventory_criticality_summary(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_inventory_criticality_summary(uuid)
TO service_role;

COMMIT;
