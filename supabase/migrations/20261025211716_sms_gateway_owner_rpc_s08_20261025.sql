-- S08 Step 2: browser may manage or inspect configured state, NEVER read secret.
-- No customer, payment, order or stock data are changed.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_store_sms_gateway_configured_safe(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=''
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
       public.app_is_store_owner(p_store_id)
       OR public.user_has_store_permission(p_store_id,'settings.view')
       OR public.user_has_store_permission(p_store_id,'settings.manage')
       OR public.user_has_store_permission(p_store_id,'settings.messages.manage')
  ) THEN
    RAISE EXCEPTION 'not authorized to view SMS gateway configuration' USING ERRCODE='42501';
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM private.store_sms_gateway_credentials
    WHERE store_id=p_store_id
  );
END $function$;

REVOKE ALL ON FUNCTION public.get_store_sms_gateway_configured_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_sms_gateway_configured_safe(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_store_sms_gateway_credential_safe(
  p_store_id uuid,
  p_token text
)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=''
AS $function$
DECLARE
  v_token text := nullif(btrim(coalesce(p_token,'')),'');
BEGIN
  -- Credential changes are owner-only, not ordinary settings managers.
  IF auth.uid() IS NULL OR NOT public.app_is_store_owner(p_store_id) THEN
    RAISE EXCEPTION 'only the store owner may change SMS gateway credentials' USING ERRCODE='42501';
  END IF;

  IF v_token IS NOT NULL AND v_token !~ '^osg_live_[A-Za-z0-9_-]{24,}$' THEN
    RAISE EXCEPTION 'invalid gateway token format' USING ERRCODE='22023';
  END IF;

  IF v_token IS NULL THEN
    DELETE FROM private.store_sms_gateway_credentials
    WHERE store_id=p_store_id;
    RETURN false;
  END IF;

  INSERT INTO private.store_sms_gateway_credentials (store_id,api_key,updated_at)
  VALUES(p_store_id,v_token,now())
  ON CONFLICT (store_id)
  DO UPDATE SET api_key=excluded.api_key,updated_at=excluded.updated_at;
  RETURN true;
END $function$;

REVOKE ALL ON FUNCTION public.set_store_sms_gateway_credential_safe(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_store_sms_gateway_credential_safe(uuid,text) TO authenticated;

COMMIT;
