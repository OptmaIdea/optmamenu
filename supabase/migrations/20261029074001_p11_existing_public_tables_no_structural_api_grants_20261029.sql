-- P11: close high-risk structural table privileges that RLS cannot mediate.
-- Preserve ordinary SELECT/INSERT/UPDATE/DELETE grants and all RLS policies.
BEGIN;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public
  FROM anon, authenticated;
-- Existing function EXECUTE privileges remain under dedicated S09/RPC review.
-- The S10 migration already denies future postgres-created TABLE/SEQUENCE grants.
DO $audit$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
      AND (
        has_table_privilege('anon',c.oid,'TRUNCATE')
        OR has_table_privilege('authenticated',c.oid,'TRUNCATE')
        OR has_table_privilege('anon',c.oid,'TRIGGER')
        OR has_table_privilege('authenticated',c.oid,'TRIGGER')
        OR has_table_privilege('anon',c.oid,'REFERENCES')
        OR has_table_privilege('authenticated',c.oid,'REFERENCES')
      )
  ) THEN
    RAISE EXCEPTION 'Unsafe legacy Data API role structural table privileges remain';
  END IF;
END;
$audit$;
COMMIT;
