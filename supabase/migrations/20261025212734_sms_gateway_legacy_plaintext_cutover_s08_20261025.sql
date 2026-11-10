-- S08 Step 3: final cutover AFTER the new Edge Function and UI are deployed.
-- Abort if a legacy token is not preserved byte-for-byte in the private vault.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('private.store_sms_gateway_credentials') IS NULL
     OR to_regprocedure('public.get_store_sms_gateway_token_service_safe(uuid)') IS NULL THEN
    RAISE EXCEPTION 'S08 cutover aborted: private credential vault not installed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.stores s
    WHERE nullif(btrim(s.sms_gateway_token),'') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM private.store_sms_gateway_credentials v
        WHERE v.store_id = s.id AND v.api_key = btrim(s.sms_gateway_token)
      )
  ) THEN
    RAISE EXCEPTION 'S08 cutover aborted: unbacked public credential exists';
  END IF;
END $preflight$;

-- Data API can still update this legacy column; refuse to persist tokens,
-- including requests from old browser bundles and old SECURITY DEFINER RPCs.
CREATE OR REPLACE FUNCTION private.strip_legacy_sms_gateway_token()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path=''
AS $function$
BEGIN
  NEW.sms_gateway_token := NULL;
  RETURN NEW;
END $function$;

REVOKE ALL ON FUNCTION private.strip_legacy_sms_gateway_token() FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS stores_sms_gateway_token_no_plaintext ON public.stores;
CREATE TRIGGER stores_sms_gateway_token_no_plaintext
BEFORE INSERT OR UPDATE ON public.stores
FOR EACH ROW EXECUTE FUNCTION private.strip_legacy_sms_gateway_token();

-- Tokens have been backfilled and verified above. Clear exposed values.
UPDATE public.stores
SET sms_gateway_token = NULL
WHERE sms_gateway_token IS NOT NULL;

DO $assert$
BEGIN
  IF EXISTS(SELECT 1 FROM public.stores WHERE sms_gateway_token IS NOT NULL) THEN
    RAISE EXCEPTION 'S08 exposed token remains after cutover';
  END IF;
  IF has_function_privilege('authenticated','public.get_store_sms_gateway_token_service_safe(uuid)','EXECUTE')
     OR has_table_privilege('authenticated','private.store_sms_gateway_credentials','SELECT')
     OR has_schema_privilege('authenticated','private','USAGE') THEN
    RAISE EXCEPTION 'S08 vault privilege leak';
  END IF;
END $assert$;
COMMIT;
