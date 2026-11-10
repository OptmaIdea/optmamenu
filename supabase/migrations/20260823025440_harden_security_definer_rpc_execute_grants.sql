-- Homologação 0D.2 — remover EXECUTE herdado de PUBLIC em RPCs SECURITY DEFINER.
--
-- Política adotada daqui em diante:
-- - nenhuma RPC SECURITY DEFINER deve depender de EXECUTE para PUBLIC;
-- - RPCs administrativas ficam explícitas para authenticated;
-- - RPC pública de cotação fica explícita para anon/authenticated;
-- - service_role mantém seus privilégios próprios do ambiente Supabase.

-- RPC pública intencional.
REVOKE EXECUTE ON FUNCTION public.quote_public_order_by_slug(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quote_public_order_by_slug(text, jsonb) TO anon, authenticated;

-- RPCs administrativas/autenticadas.
REVOKE EXECUTE ON FUNCTION public.admin_accept_public_order_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_accept_public_order_safe(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_finalize_public_order_with_payment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_finalize_public_order_with_payment(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_mark_public_order_ready_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_public_order_ready_safe(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_set_public_order_payment_status_safe(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_public_order_payment_status_safe(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_manage_cashbook_account_plan_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_cashbook_account_plan_safe() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.create_pos_sale_safe(uuid, jsonb, uuid, text, text, text, text, uuid, text, text, boolean, boolean, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pos_sale_safe(uuid, jsonb, uuid, text, text, text, text, uuid, text, text, boolean, boolean, boolean, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_active_order_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_order_count(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_cashbook_account_plan_admin_store_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_cashbook_account_plan_admin_store_id() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_order_message_events(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_message_events(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_pos_bootstrap_v2(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_bootstrap_v2(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.insert_cashbook_account_plan_audit(text, text, jsonb, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_cashbook_account_plan_audit(text, text, jsonb, jsonb, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.log_order_message_event(uuid, text, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_order_message_event(uuid, text, text, text, text, text, text, text, jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reverse_received_stock_transfer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_received_stock_transfer(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_cashbook_account_plan_active_safe(text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_cashbook_account_plan_active_safe(text, boolean) TO authenticated;
