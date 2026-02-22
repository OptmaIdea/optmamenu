do $$
declare
  r record;
begin
  for r in
    select
      p.oid::regprocedure as regproc
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'award_loyalty_points',
        'complete_order',
        'product_has_movements',
        'create_order_with_reservation',
        'send_customer_otp',
        'send_admin_message',
        'get_available_stock',
        'cancel_expired_reservations',
        'confirm_order_payment',
        'verify_customer_otp',
        'register_stock_movement',
        'perform_manual_adjustment',
        'handle_new_customer_loyalty',
        'get_user_store_id',
        'extend_reservation',
        'handle_new_order_points',
        'handle_new_order_points_v2',
        'handle_tier_upgrade',
        'handle_stamp_completion',
        'check_voucher_expiry_notifications',
        'redeem_reward',
        'cancel_order',
        'handle_new_user',
        'cleanup_expired_reservations',
        'cleanup_old_messages',
        'reserve_stock',
        'award_points_on_delivery'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp;', r.regproc);
  end loop;
end $$;