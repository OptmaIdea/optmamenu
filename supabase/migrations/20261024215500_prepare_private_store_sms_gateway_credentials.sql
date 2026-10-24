-- Stage V1: pre-provision a backend-only gateway credential vault.
-- DO NOT APPLY AS A STANDALONE SECURITY FIX: stores.sms_gateway_token remains
-- live until Edge/UI dual-read and cutover are tested and approved.
-- This phase introduces no externally callable credential access for users.
BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.store_sms_gateway_credentials (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  api_key text NOT NULL
    CHECK (api_key ~ '^osg_live_[A-Za-z0-9_-]{24,}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.store_sms_gateway_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.store_sms_gateway_credentials
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE private.store_sms_gateway_credentials TO service_role;

-- Snapshot only valid, already configured tokens. Do not erase the legacy
-- column until the receiving Edge Function and UI have been safely promoted.
INSERT INTO private.store_sms_gateway_credentials (store_id, api_key)
SELECT id, btrim(sms_gateway_token)
FROM public.stores
WHERE sms_gateway_token IS NOT NULL
  AND btrim(sms_gateway_token) ~ '^osg_live_[A-Za-z0-9_-]{24,}$'
ON CONFLICT (store_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_store_sms_gateway_token_service_safe(
  p_store_id uuid
) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.api_key
  FROM private.store_sms_gateway_credentials v
  WHERE v.store_id = p_store_id;
$$;

REVOKE ALL ON FUNCTION public.get_store_sms_gateway_token_service_safe(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_sms_gateway_token_service_safe(uuid)
  TO service_role;

COMMIT;
