\set ON_ERROR_STOP on
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $f$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
CREATE TABLE public.stores(id uuid primary key,user_id uuid,sms_gateway_token text,config jsonb default '{}'::jsonb);
CREATE TABLE public.store_members(store_id uuid,user_id uuid,status text,permission text);
INSERT INTO public.stores VALUES
 ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','osg_live_'||repeat('A',32),'{}'),
 ('20000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','osg_live_'||repeat('B',32),'{}'),
 ('30000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000003',NULL,'{}');
INSERT INTO public.store_members VALUES
 ('10000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001','active','settings.messages.manage'),
 ('10000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','active','products.view');
CREATE FUNCTION public.app_is_store_owner(p_store_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$ SELECT EXISTS(SELECT 1 FROM public.stores WHERE id=p_store_id AND user_id=auth.uid()) $f$;
CREATE FUNCTION public.user_has_store_permission(p_store_id uuid,p_permission_code text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $f$ SELECT EXISTS(SELECT 1 FROM public.store_members
 WHERE store_id=p_store_id AND user_id=auth.uid() AND status='active' AND permission=p_permission_code) $f$;
GRANT SELECT,UPDATE ON public.stores TO authenticated;
\echo 'S08: deploy vault and owner-only RPCs'
\ir ../migrations/20261025211710_sms_gateway_private_vault_s08_20261025.sql
\ir ../migrations/20261025211716_sms_gateway_owner_rpc_s08_20261025.sql
DO $checks$
BEGIN
 IF (SELECT COUNT(*) FROM private.store_sms_gateway_credentials)<>2 THEN RAISE EXCEPTION 'Vault backfill failed'; END IF;
 IF has_schema_privilege('authenticated','private','USAGE')
 OR has_table_privilege('authenticated','private.store_sms_gateway_credentials','SELECT')
 OR has_function_privilege('authenticated','public.get_store_sms_gateway_token_service_safe(uuid)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.get_store_sms_gateway_token_service_safe(uuid)','EXECUTE')
 OR has_function_privilege('anon','public.set_store_sms_gateway_credential_safe(uuid,text)','EXECUTE') THEN
 RAISE EXCEPTION 'Vault privilege matrix failed'; END IF;
END $checks$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',false);
DO $viewer$
DECLARE v_state text;
BEGIN
 IF NOT public.get_store_sms_gateway_configured_safe('10000000-0000-4000-8000-000000000001') THEN
 RAISE EXCEPTION 'SMS manager cannot see configured status'; END IF;
 BEGIN
 PERFORM public.set_store_sms_gateway_credential_safe('10000000-0000-4000-8000-000000000001','osg_live_'||repeat('D',32));
 RAISE EXCEPTION 'Manager could overwrite owner-only key';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $viewer$;
SELECT set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',false);
DO $readonly$
BEGIN
 BEGIN
 PERFORM public.get_store_sms_gateway_configured_safe('10000000-0000-4000-8000-000000000001');
 RAISE EXCEPTION 'Product viewer sees protected status';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 PERFORM api_key FROM private.store_sms_gateway_credentials LIMIT 1;
 RAISE EXCEPTION 'Product viewer retrieved credential';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $readonly$;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',false);
DO $owner$
BEGIN
 IF NOT public.get_store_sms_gateway_configured_safe('10000000-0000-4000-8000-000000000001') THEN
 RAISE EXCEPTION 'Owner could not see configured status'; END IF;
 IF NOT public.set_store_sms_gateway_credential_safe('10000000-0000-4000-8000-000000000001','osg_live_'||repeat('C',32)) THEN
 RAISE EXCEPTION 'Owner could not rotate key'; END IF;
 BEGIN
 PERFORM public.set_store_sms_gateway_credential_safe('20000000-0000-4000-8000-000000000002','osg_live_'||repeat('C',32));
 RAISE EXCEPTION 'Owner modified other store';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
 PERFORM public.set_store_sms_gateway_credential_safe('10000000-0000-4000-8000-000000000001','invalid');
 RAISE EXCEPTION 'Owner could store invalid credential';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $owner$;
RESET ROLE;

-- Keep production-like legacy column matching the securely rotated key,
-- otherwise the cutover MUST abort to prevent losing an unbacked token.
UPDATE public.stores SET sms_gateway_token='osg_live_'||repeat('C',32)
 WHERE id='10000000-0000-4000-8000-000000000001';

\echo 'S08: apply guarded final plaintext cleanup'
\ir ../migrations/20261025211720_sms_gateway_legacy_plaintext_cutover.sql

DO $final$
BEGIN
 IF EXISTS(SELECT 1 FROM public.stores WHERE sms_gateway_token IS NOT NULL) THEN
 RAISE EXCEPTION 'Public store still holds plaintext SMS token'; END IF;
 IF public.get_store_sms_gateway_token_service_safe('10000000-0000-4000-8000-000000000001')
 IS DISTINCT FROM 'osg_live_'||repeat('C',32) THEN
 RAISE EXCEPTION 'Rotated owner key lost from vault'; END IF;
 IF public.get_store_sms_gateway_token_service_safe('20000000-0000-4000-8000-000000000002')
 IS DISTINCT FROM 'osg_live_'||repeat('B',32) THEN
 RAISE EXCEPTION 'Other tenant key changed unexpectedly'; END IF;
END $final$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',false);
UPDATE public.stores SET sms_gateway_token='osg_live_'||repeat('X',32)
 WHERE id='10000000-0000-4000-8000-000000000001';
RESET ROLE;
DO $reinsert$
BEGIN IF EXISTS(SELECT 1 FROM public.stores WHERE sms_gateway_token IS NOT NULL)
 THEN RAISE EXCEPTION 'Old client reintroduced token into public table'; END IF;
END $reinsert$;
\echo 'S08 PASS: owner/manager/reader matrix, two tenants, vault, legacy wiped and re-write neutralized'
