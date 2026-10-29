-- Homologação 0D.1 — hardening de funções trigger SECURITY DEFINER.
--
-- Estas funções existem para execução indireta por triggers já instalados.
-- Elas não constituem RPC pública/autenticada e não devem ser invocáveis
-- diretamente por anon/authenticated/PUBLIC.
--
-- PostgreSQL exige EXECUTE na função no momento de CREATE TRIGGER, mas a
-- execução de triggers já existentes não depende destes grants de RPC.

REVOKE EXECUTE ON FUNCTION public.capture_store_slug_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_public_customer_identity_context() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_reward_media_asset_delete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_reward_media_asset_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enrich_stock_movement_order_metadata() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_customer_primary_contacts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_pdv_stock_exception_occurrence() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_sync_cashbook_closing_occurrence() FROM PUBLIC, anon, authenticated;
