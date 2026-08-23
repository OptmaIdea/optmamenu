-- Homologação 0D.3 — remover acesso anon de RPCs exclusivas de equipe.
--
-- Também classifica reconcile_inventory_reservations como INTERNAL/service_role.
-- A implementação atual permite p_store_id NULL para manutenção global e,
-- portanto, não deve ficar diretamente exposta a clientes anon/authenticated.

REVOKE EXECUTE ON FUNCTION public.adjust_customer_loyalty_points_safe(uuid, uuid, integer, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_customer_loyalty_points_safe(uuid, uuid, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_my_store_member_onboarding(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_my_store_member_onboarding(uuid, text, text, text, date, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_reward_media_asset_atomic(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_reward_media_asset_atomic(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_active_stock_reservation_origins(uuid, uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_stock_reservation_origins(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_loyalty_customers_safe(uuid, text, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_loyalty_customers_safe(uuid, text, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_store_members_for_permissions(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_store_members_for_permissions(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_cashbook_account_plan_system_protected(text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_cashbook_account_plan_system_protected(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_my_profile_social_links(text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile_social_links(text, text, text) TO authenticated;

-- Maintenance RPC: never directly callable from public/authenticated clients.
REVOKE EXECUTE ON FUNCTION public.reconcile_inventory_reservations(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_inventory_reservations(uuid, boolean) TO service_role;
