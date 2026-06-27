-- Fase 9.14E.2 — Remove authenticated de funções legadas de pedidos
--
-- Objetivo:
-- Reduzir a superfície SECURITY DEFINER autenticada removendo acesso direto
-- de funções antigas, amplas e sem validação interna adequada.
--
-- Funções tratadas:
-- - public.cancel_order(uuid)
-- - public.complete_order(uuid)
--
-- Critério:
-- - não há uso direto atual por supabase.rpc(...) no frontend;
-- - não validam auth.uid();
-- - não validam vínculo com loja;
-- - não validam permissão granular;
-- - existem alternativas mais seguras para fluxos administrativos.
--
-- Fora do escopo:
-- - public.extend_reservation(uuid, integer), ainda usada no admin;
-- - public.create_order_with_reservation(...), ainda usada em CartDrawer legado.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_order(uuid) FROM authenticated;

GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_order(uuid) TO service_role;

COMMIT;
