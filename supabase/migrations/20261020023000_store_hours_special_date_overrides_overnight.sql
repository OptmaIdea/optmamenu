BEGIN;
CREATE OR REPLACE FUNCTION public.store_online_order_hours_status_internal(p_store_id uuid, p_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_local timestamp := p_at AT TIME ZONE 'America/Sao_Paulo';
  v_date date := (p_at AT TIME ZONE 'America/Sao_Paulo')::date;
  v_day date;
  v_hour time;
  v_week record;
  v_exception record;
  v_start timestamp;
  v_end timestamp;
  v_next timestamp;
  v_open boolean := false;
  v_can_order boolean;
  v_closed_buffer boolean := false;
  v_mode text;
  v_buffer int := 0;
  v_delta integer;
  v_has_schedule boolean := false;
  v_today_exception boolean := false;
BEGIN
  SELECT CASE WHEN s.config->>'online_orders_outside_hours'='block' THEN 'block' ELSE 'accept' END,
         LEAST(180,GREATEST(0,CASE WHEN coalesce(s.config->>'closing_buffer_minutes','') ~ '^[0-9]{1,3}$'
          THEN (s.config->>'closing_buffer_minutes')::integer ELSE 0 END))
    INTO v_mode,v_buffer FROM public.stores s
  WHERE s.id=p_store_id AND s.public_store_enabled=true;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'can_order',false,'error','store_unavailable');END IF;

  -- A special-date exception overrides any overnight shift from the prior day.
  SELECT EXISTS(
    SELECT 1 FROM public.store_schedules_exceptions e
    WHERE e.store_id=p_store_id AND e.exception_date=v_date
  ) INTO v_today_exception;

  -- Dates are store-local. Yesterday is checked to include overnight shifts.
  FOR v_delta IN -1..7 LOOP
    IF v_delta=-1 AND v_today_exception THEN CONTINUE;END IF;
    v_day:=v_date+v_delta;
    v_hour:=null;
    SELECT e.is_closed,e.open_time,e.close_time
      INTO v_exception FROM public.store_schedules_exceptions e
     WHERE e.store_id=p_store_id AND e.exception_date=v_day
     ORDER BY e.created_at DESC LIMIT 1;
    IF FOUND THEN
      IF v_exception.is_closed THEN CONTINUE; END IF;
      IF v_exception.open_time IS NULL OR v_exception.close_time IS NULL THEN CONTINUE; END IF;
      v_hour:=v_exception.open_time;
      v_start:=v_day::timestamp+v_exception.open_time;
      v_end:=v_day::timestamp+v_exception.close_time;
    ELSE
      SELECT h.is_closed,h.open_time,h.close_time
        INTO v_week FROM public.store_hours h
       WHERE h.store_id=p_store_id AND h.day_of_week=EXTRACT(DOW FROM v_day)::int LIMIT 1;
      IF NOT FOUND OR v_week.is_closed OR v_week.open_time IS NULL OR v_week.close_time IS NULL THEN CONTINUE;END IF;
      v_hour:=v_week.open_time;
      v_start:=v_day::timestamp+v_week.open_time;
      v_end:=v_day::timestamp+v_week.close_time;
    END IF;
    v_has_schedule:=true;
    IF v_end<=v_start THEN v_end:=v_end+interval '1 day';END IF;
    IF v_local>=v_start AND v_local<v_end THEN
      v_open:=true;
      IF v_local >= v_end-make_interval(mins=>v_buffer) THEN v_closed_buffer:=true;END IF;
    END IF;
    IF v_start>v_local AND (v_next IS NULL OR v_start<v_next) THEN v_next:=v_start;END IF;
  END LOOP;

  v_can_order := (v_open AND NOT v_closed_buffer) OR v_mode='accept';
  RETURN jsonb_build_object(
    'ok',true,
    'is_open',v_open,
    'can_order',v_can_order,
    'accepting_while_closed',v_can_order AND (NOT v_open OR v_closed_buffer),
    'outside_hours_policy',v_mode,
    'closing_soon',v_open AND v_closed_buffer,
    'next_opening_local',CASE WHEN v_next IS NOT NULL THEN to_char(v_next,'DD/MM/YYYY HH24:MI') ELSE null END,
    'time_zone','America/Sao_Paulo'
  );
END;
$function$
;
COMMIT;