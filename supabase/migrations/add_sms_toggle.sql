-- Initialize use_sms_gateway to false for stores that don't have it set
UPDATE stores
SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{use_sms_gateway}', 'false'::jsonb)
WHERE config->>'use_sms_gateway' IS NULL;
