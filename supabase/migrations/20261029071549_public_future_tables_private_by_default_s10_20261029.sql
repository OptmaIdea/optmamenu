-- S10: adopt the 30 October 2026 Data API default-grant change now.
-- Existing public tables, views, sequences, functions, RLS policies and data
-- remain byte-for-byte unchanged. This controls objects created in the future.
-- Source: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
BEGIN;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated, service_role;

-- Fail rather than silently leaving any automatic table or sequence grant.
DO $s10_acl_assert$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_default_acl d
      CROSS JOIN LATERAL aclexplode(d.defaclacl) a
     WHERE d.defaclrole = 'postgres'::regrole
       AND d.defaclnamespace = 'public'::regnamespace
       AND d.defaclobjtype IN ('r', 'S')
       AND a.grantee IN ('anon'::regrole, 'authenticated'::regrole, 'service_role'::regrole)
  ) THEN
    RAISE EXCEPTION 'S10: automatic Data API grants still present for new public tables/sequences';
  END IF;
END $s10_acl_assert$;

-- Deliberately do not alter function defaults here: caller permissions
-- for new RPCs must be reviewed individually, to preserve existing auth,
-- checkout, payment and internal SECURITY DEFINER paths.
-- New table migrations must explicitly GRANT only required operations,
-- enable RLS, and supply scoped policies (P03 CI guard).
COMMIT;
