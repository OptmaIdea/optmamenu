-- Add metadata column to orders table for storing notification flags and other data
ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
