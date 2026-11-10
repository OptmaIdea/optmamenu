\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
DO $build$
DECLARE v_name text;
BEGIN
 FOREACH v_name IN ARRAY ARRAY['adjust_completed_sale_safe','admin_dispatch_public_order_safe','admin_dispatch_public_order_safe_internal_0d','create_purchase_quotation','create_store_financial_account_with_opening_safe','delete_store_financial_calendar_exception_safe','delete_store_financial_holiday_safe','get_sale_adjustments_safe','list_accounts_payable_due_alerts_safe','list_financial_account_statement_safe','list_store_financial_holidays_safe','mark_purchase_quotations_expired_safe','register_accounts_payable_payment_with_charges_safe','save_store_financial_calendar_exception_safe','save_store_financial_holiday_safe','set_order_payment_finalization_account_safe'] LOOP
  EXECUTE format('CREATE FUNCTION public.%I() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $fn$ BEGIN NULL; END $fn$',v_name);
 END LOOP;
END $build$;

CREATE FUNCTION public.get_public_catalog_by_slug() RETURNS void LANGUAGE plpgsql SECURITY DEFINER
AS $f$ BEGIN NULL; END $f$;
DO $before$
BEGIN
 IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE'))<>17 THEN
 RAISE EXCEPTION 'S09 synthetic broad grants not reproduced'; END IF;
END $before$;
\echo 'S09 apply REAL permissions migration'
\ir ../migrations/20261025212614_revoke_anonymous_admin_rpcs_s09_20261026.sql
DO $assert$
DECLARE v_count integer;
BEGIN
 SELECT count(*) INTO v_count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon',p.oid,'EXECUTE');
 IF v_count<>1 THEN RAISE EXCEPTION 'S09 anonymous privileged functions remain: %',v_count; END IF;
 IF NOT has_function_privilege('anon','public.get_public_catalog_by_slug()','EXECUTE') THEN
 RAISE EXCEPTION 'S09 accidentally disabled anonymous public catalog'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname<>'get_public_catalog_by_slug'
 AND (has_function_privilege('anon',p.oid,'EXECUTE')
 OR NOT has_function_privilege('authenticated',p.oid,'EXECUTE')
 OR NOT has_function_privilege('service_role',p.oid,'EXECUTE'))) THEN
 RAISE EXCEPTION 'S09 matrix failed for admin RPCs'; END IF;
END $assert$;
\echo 'S09 PASS: 16 admin RPCs no longer anon, public catalog still anon'
