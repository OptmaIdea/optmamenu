-- =========================================================
-- F) FIX: FUNCTION SEARCH_PATH MUTABLE (assinaturas corretas)
-- =========================================================

alter function public.award_loyalty_points() set search_path = public, pg_temp;
alter function public.award_points_on_delivery() set search_path = public, pg_temp;

alter function public.cancel_expired_reservations() set search_path = public, pg_temp;
alter function public.cancel_expired_reservations(uuid) set search_path = public, pg_temp;

alter function public.cancel_order(uuid) set search_path = public, pg_temp;
alter function public.check_voucher_expiry_notifications() set search_path = public, pg_temp;
alter function public.cleanup_expired_reservations() set search_path = public, pg_temp;
alter function public.cleanup_old_messages(uuid) set search_path = public, pg_temp;

alter function public.complete_order(uuid) set search_path = public, pg_temp;
alter function public.confirm_order_payment(uuid) set search_path = public, pg_temp;

alter function public.create_order_with_reservation(uuid,text,text,jsonb,text,numeric,text,jsonb) set search_path = public, pg_temp;
alter function public.extend_reservation(uuid,integer) set search_path = public, pg_temp;
alter function public.get_available_stock(uuid) set search_path = public, pg_temp;
alter function public.get_user_store_id() set search_path = public, pg_temp;

alter function public.handle_new_customer_loyalty() set search_path = public, pg_temp;
alter function public.handle_new_order_points() set search_path = public, pg_temp;
alter function public.handle_new_order_points_v2() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;

alter function public.handle_stamp_completion(uuid,record) set search_path = public, pg_temp;
alter function public.handle_tier_upgrade(uuid,uuid) set search_path = public, pg_temp;

alter function public.perform_manual_adjustment(uuid,integer,text,text,uuid) set search_path = public, pg_temp;
alter function public.product_has_movements(uuid) set search_path = public, pg_temp;
alter function public.redeem_reward(uuid,uuid) set search_path = public, pg_temp;

alter function public.register_stock_movement() set search_path = public, pg_temp;
alter function public.reserve_stock(uuid,uuid,integer) set search_path = public, pg_temp;

alter function public.send_admin_message(uuid,text,text,uuid[],integer) set search_path = public, pg_temp;
alter function public.send_customer_otp(text,uuid) set search_path = public, pg_temp;
alter function public.verify_customer_otp(text,text,uuid) set search_path = public, pg_temp;