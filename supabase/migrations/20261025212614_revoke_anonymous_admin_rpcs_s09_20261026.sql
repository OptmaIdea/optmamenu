-- S09: RPCs for authenticated store administrators must not be anonymous endpoints.
-- Deliberately excluded: public catalog, public checkout, customer payment links,
-- payment-proof uploads and sandbox payment simulation.
-- All functions keep their bodies, owner, SECURITY DEFINER and authenticated/service grants.
BEGIN;
DO $revoke$
DECLARE v_count integer;
  v_func record;
  v_names text[] := ARRAY['adjust_completed_sale_safe','admin_dispatch_public_order_safe','admin_dispatch_public_order_safe_internal_0d','create_purchase_quotation','create_store_financial_account_with_opening_safe','delete_store_financial_calendar_exception_safe','delete_store_financial_holiday_safe','get_sale_adjustments_safe','list_accounts_payable_due_alerts_safe','list_financial_account_statement_safe','list_store_financial_holidays_safe','mark_purchase_quotations_expired_safe','register_accounts_payable_payment_with_charges_safe','save_store_financial_calendar_exception_safe','save_store_financial_holiday_safe','set_order_payment_finalization_account_safe'];
BEGIN
 SELECT COUNT(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname=ANY(v_names) AND p.prosecdef;
 IF v_count<>array_length(v_names,1) THEN
   RAISE EXCEPTION 'S09 abort: expected 16 admin RPC definitions; found %',v_count;
 END IF;
 FOR v_func IN
    SELECT p.oid,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=ANY(v_names) AND p.prosecdef
 LOOP
   EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon',v_func.oid::regprocedure);
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated,service_role',v_func.oid::regprocedure);
   IF has_function_privilege('anon',v_func.oid,'EXECUTE')
    OR NOT has_function_privilege('authenticated',v_func.oid,'EXECUTE')
    OR NOT has_function_privilege('service_role',v_func.oid,'EXECUTE') THEN
       RAISE EXCEPTION 'S09 failed ACL on %',v_func.proname;
   END IF;
 END LOOP;
END $revoke$;
NOTIFY pgrst,'reload schema';
COMMIT;
