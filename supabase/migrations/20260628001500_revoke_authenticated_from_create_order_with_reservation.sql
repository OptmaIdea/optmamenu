-- Fase 9.14E.4 — Remove authenticated de create_order_with_reservation
--
-- Objetivo:
-- Reduzir superfície SECURITY DEFINER autenticada removendo acesso direto
-- da RPC legada de criação de pedido/reserva.
--
-- Contexto:
-- - O fluxo público atual usa create_public_order_by_slug.
-- - O único uso direto encontrado no frontend estava no CartDrawer legado.
-- - O CartDrawer foi desacoplado do StoreLayout antes desta revogação.
--
-- Esta migration não dropa a função.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.create_order_with_reservation(
    uuid,
    text,
    text,
    jsonb,
    text,
    numeric,
    text,
    jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_order_with_reservation(
    uuid,
    text,
    text,
    jsonb,
    text,
    numeric,
    text,
    jsonb
) TO service_role;

COMMIT;
