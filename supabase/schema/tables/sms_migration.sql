-- Add sms_gateway_token to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS sms_gateway_token TEXT;
