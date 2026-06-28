-- Fase 9.14E.5 — Remove authenticated de auxiliares antigas de reserva/estoque
--
-- Objetivo:
-- Reduzir a superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções auxiliares antigas/legadas que não são chamadas pelo frontend atual.
--
-- Funções tratadas:
-- - public.cancel_order_reservations(uuid, uuid, uuid)
-- - public.cancel_reservation_only(uuid, uuid, uuid)
-- - public.confirm_order_stock(uuid, uuid, uuid)
-- - public.confirm_reserved_stock(uuid, uuid, uuid)
--
-- Esta migration não dropa funções.
-- Preserva service_role para manutenção/compatibilidade operacional.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.cancel_order_reservations(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.cancel_reservation_only(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_order_stock(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.confirm_reserved_stock(uuid, uuid, uuid)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_order_reservations(uuid, uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.cancel_reservation_only(uuid, uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.confirm_order_stock(uuid, uuid, uuid)
TO service_role;

GRANT EXECUTE ON FUNCTION public.confirm_reserved_stock(uuid, uuid, uuid)
TO service_role;

COMMIT;
