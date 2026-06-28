-- Fase 9.14E.6 — Remove authenticated de auxiliares comerciais internas
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções comerciais auxiliares sem uso direto no frontend atual.
--
-- Funções tratadas:
-- - public.create_cashbook_entry_from_order(uuid)
-- - public.apply_order_loyalty_points_advanced(uuid)
-- - public.calculate_order_loyalty_points_advanced(uuid)
-- - public.complete_confirmed_public_order(uuid)
-- - public.confirm_reserved_public_order(uuid)
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção e chamadas internas privilegiadas.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_cashbook_entry_from_order(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_order_loyalty_points_advanced(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.calculate_order_loyalty_points_advanced(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_confirmed_public_order(uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_reserved_public_order(uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_cashbook_entry_from_order(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.apply_order_loyalty_points_advanced(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.calculate_order_loyalty_points_advanced(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.complete_confirmed_public_order(uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.confirm_reserved_public_order(uuid)
TO service_role;

COMMIT;
