-- Testa o controle de horários da slug, sem pedidos e sem alterações persistentes.
-- Use somente em homologação, SQL Editor. Todos os UPDATE/INSERT são revertidos.
BEGIN;
DO $verify$
DECLARE
 v_store uuid; v_status jsonb; v_result jsonb;
 v_today date := (clock_timestamp() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 SELECT id INTO v_store FROM public.stores WHERE slug='gelinharessjn';
 IF v_store IS NULL THEN RAISE EXCEPTION 'Fixture Gelinhares not found'; END IF;

 -- Não alterar padrão de loja atual; testar política explicitamente em rollback.
 UPDATE public.stores SET config=jsonb_set(coalesce(config,'{}'::jsonb),
  '{online_orders_outside_hours}','"block"'::jsonb,true)
 WHERE id=v_store;

 v_status:=public.store_online_order_hours_status_internal(v_store,'2026-10-19 03:00:00-03');
 IF v_status->>'can_order'<>'false' THEN RAISE EXCEPTION 'FAIL: after hours accepted';END IF;
 v_status:=public.store_online_order_hours_status_internal(v_store,'2026-10-19 13:00:00-03');
 IF v_status->>'can_order'<>'true' THEN RAISE EXCEPTION 'FAIL: during hours rejected';END IF;
 v_status:=public.store_online_order_hours_status_internal(v_store,'2026-10-19 19:45:00-03');
 IF v_status->>'closing_soon'<>'true' OR v_status->>'can_order'<>'false' THEN
  RAISE EXCEPTION 'FAIL: closing buffer';
 END IF;

 INSERT INTO public.store_schedules_exceptions(store_id,exception_date,is_closed,reason)
 VALUES(v_store,'2027-02-01',true,'regression-test-rollback');
 v_status:=public.store_online_order_hours_status_internal(v_store,'2027-02-01 13:00:00-03');
 IF v_status->>'can_order'<>'false' THEN RAISE EXCEPTION 'FAIL: holiday';END IF;

 UPDATE public.store_hours SET open_time='22:00',close_time='02:00',is_closed=false
 WHERE store_id=v_store AND day_of_week=1;
 v_status:=public.store_online_order_hours_status_internal(v_store,'2026-11-03 01:15:00-03');
 IF v_status->>'can_order'<>'true' THEN RAISE EXCEPTION 'FAIL: overnight';END IF;
 INSERT INTO public.store_schedules_exceptions(store_id,exception_date,is_closed,reason)
 VALUES(v_store,'2026-11-03',true,'regression-test-rollback');
 v_status:=public.store_online_order_hours_status_internal(v_store,'2026-11-03 01:15:00-03');
 IF v_status->>'can_order'<>'false' THEN RAISE EXCEPTION 'FAIL: holiday must override overnight';END IF;

 INSERT INTO public.store_schedules_exceptions(store_id,exception_date,is_closed,reason)
 VALUES(v_store,v_today,true,'regression-test-rollback');
 EXECUTE 'SET LOCAL ROLE anon';
 v_result:=public.create_public_order_by_slug_v3('gelinharessjn','Teste','62999999999','pickup',
 'public_store','[]'::jsonb,'{}',null,null,'{"timing":"pay_on_fulfillment"}'::jsonb,'pickup');
 IF v_result->>'error'<>'store_closed' THEN RAISE EXCEPTION 'FAIL: v3 %',v_result;END IF;
 v_result:=public.create_public_order_by_slug_v2('gelinharessjn','Teste','62999999999','pickup',
 'public_store','[]'::jsonb,'{}',null,null,'pending','pickup');
 IF v_result->>'error'<>'store_closed' THEN RAISE EXCEPTION 'FAIL: v2 %',v_result;END IF;
 v_result:=public.create_public_order_by_slug('gelinharessjn','Teste','62999999999','pickup',
 'public_store','[]'::jsonb,'{}',null,null,'pending','pickup');
 IF v_result->>'error'<>'store_closed' THEN RAISE EXCEPTION 'FAIL: legacy %',v_result;END IF;
 EXECUTE 'RESET ROLE';
END;
$verify$;
SELECT 'PASS: hours, closing buffer, special dates, overnight, public RPC v1-v3' AS result;
ROLLBACK;
