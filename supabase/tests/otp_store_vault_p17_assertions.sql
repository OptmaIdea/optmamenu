-- Check additive vault migration after running it twice, with no secret logs.
DO $assert_vault$
BEGIN
  IF (SELECT count(*) FROM private.store_sms_gateway_credentials) <> 2
     OR (SELECT count(*) FROM public.stores
           WHERE sms_gateway_token LIKE 'osg_live_%') <> 2 THEN
    RAISE EXCEPTION 'V1 must backfill valid keys and preserve legacy values until Edge cutover';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='private' AND c.relname='store_sms_gateway_credentials' AND c.relrowsecurity
  ) THEN RAISE EXCEPTION 'V1 vault RLS missing'; END IF;
  IF has_schema_privilege('authenticated','private','USAGE')
     OR has_schema_privilege('anon','private','USAGE')
     OR has_table_privilege('authenticated','private.store_sms_gateway_credentials','SELECT')
     OR has_table_privilege('anon','private.store_sms_gateway_credentials','SELECT')
     OR has_function_privilege('authenticated',
       'public.get_store_sms_gateway_token_service_safe(uuid)','EXECUTE')
     OR has_function_privilege('anon',
       'public.get_store_sms_gateway_token_service_safe(uuid)','EXECUTE')
     OR NOT has_function_privilege('service_role',
       'public.get_store_sms_gateway_token_service_safe(uuid)','EXECUTE')
  THEN RAISE EXCEPTION 'V1 credential vault grants invalid'; END IF;
  IF public.get_store_sms_gateway_token_service_safe('00000000-0000-4000-8000-000000000001')
     IS DISTINCT FROM 'osg_live_'||repeat('A',32)
     OR public.get_store_sms_gateway_token_service_safe('00000000-0000-4000-8000-000000000002')
     IS DISTINCT FROM 'osg_live_'||repeat('B',32)
     OR public.get_store_sms_gateway_token_service_safe('00000000-0000-4000-8000-000000000003') IS NOT NULL
  THEN RAISE EXCEPTION 'V1 credential lookup/cross-store validation failed'; END IF;
END $assert_vault$;

SET ROLE service_role;
DO $service$
BEGIN
  IF public.get_store_sms_gateway_token_service_safe('00000000-0000-4000-8000-000000000001')
        IS DISTINCT FROM 'osg_live_'||repeat('A',32)
     OR public.get_store_sms_gateway_token_service_safe('00000000-0000-4000-8000-000000000002')
        IS DISTINCT FROM 'osg_live_'||repeat('B',32)
  THEN RAISE EXCEPTION 'V1 service cannot fetch separate store credentials'; END IF;
END $service$;
RESET ROLE;

SET ROLE authenticated;
DO $client$
DECLARE state text;
BEGIN
  state:=NULL;
  BEGIN PERFORM public.get_store_sms_gateway_token_service_safe('00000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE; END;
  IF state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'V1 authenticated could call privileged secret getter: %',state; END IF;
  state:=NULL;
  BEGIN PERFORM api_key FROM private.store_sms_gateway_credentials;
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE; END;
  IF state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'V1 authenticated could query private secret table: %',state; END IF;
END $client$;
RESET ROLE;

SET ROLE anon;
DO $public_client$
DECLARE state text;
BEGIN
  state:=NULL;
  BEGIN PERFORM public.get_store_sms_gateway_token_service_safe('00000000-0000-4000-8000-000000000001');
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS state=RETURNED_SQLSTATE; END;
  IF state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'V1 anonymous could call privileged secret getter: %',state; END IF;
END $public_client$;
RESET ROLE;

SELECT 'PASS: isolated service-only vault, two tenant tokens, invalid excluded, legacy unaffected, repeat-safe' AS verdict;
