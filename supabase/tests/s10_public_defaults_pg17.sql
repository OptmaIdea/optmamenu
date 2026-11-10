\set ON_ERROR_STOP on
\echo 'S10 PostgreSQL 17 — reproduce broad Supabase defaults'
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

CREATE TABLE public.s10_existing_catalog(id int primary key, label text not null);
ALTER TABLE public.s10_existing_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY s10_catalog_read ON public.s10_existing_catalog
  FOR SELECT TO anon USING (true);
INSERT INTO public.s10_existing_catalog VALUES(1,'existing live catalogue');

CREATE SEQUENCE public.s10_existing_sequence;
DO $baseline$
BEGIN
  IF NOT has_table_privilege('anon','public.s10_existing_catalog','SELECT')
   OR NOT has_table_privilege('authenticated','public.s10_existing_catalog','UPDATE')
   OR NOT has_sequence_privilege('service_role','public.s10_existing_sequence','USAGE') THEN
    RAISE EXCEPTION 'S10 fixture cannot reproduce old broad grants';
  END IF;
END $baseline$;

\echo 'S10 execute exactly the proposed production migration'
\ir ../migrations/20261029071549_public_future_tables_private_by_default_s10_20261029.sql

CREATE TABLE public.s10_new_private (
  id int primary key,
  synthetic_secret text not null
);
ALTER TABLE public.s10_new_private ENABLE ROW LEVEL SECURITY;
CREATE SEQUENCE public.s10_new_private_sequence;

CREATE TABLE public.s10_new_public_catalog (id int primary key, label text not null);
ALTER TABLE public.s10_new_public_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY s10_new_catalog_read ON public.s10_new_public_catalog
  FOR SELECT TO anon USING (true);

DO $default_checks$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF has_table_privilege(role_name, 'public.s10_new_private', 'SELECT')
       OR has_table_privilege(role_name, 'public.s10_new_private', 'INSERT')
       OR has_table_privilege(role_name, 'public.s10_new_private', 'UPDATE')
       OR has_table_privilege(role_name, 'public.s10_new_private', 'DELETE')
       OR has_table_privilege(role_name, 'public.s10_new_private', 'TRUNCATE')
       OR has_table_privilege(role_name, 'public.s10_new_public_catalog', 'SELECT')
       OR has_sequence_privilege(role_name, 'public.s10_new_private_sequence', 'USAGE')
       OR has_sequence_privilege(role_name, 'public.s10_new_private_sequence', 'SELECT')
       OR has_sequence_privilege(role_name, 'public.s10_new_private_sequence', 'UPDATE') THEN
      RAISE EXCEPTION 'S10 future objects leaked automatic grant to %',role_name;
    END IF;
  END LOOP;
  IF NOT has_table_privilege('anon','public.s10_existing_catalog','SELECT')
     OR NOT has_table_privilege('authenticated','public.s10_existing_catalog','UPDATE')
     OR NOT has_sequence_privilege('service_role','public.s10_existing_sequence','USAGE') THEN
    RAISE EXCEPTION 'S10 accidentally changed access to existing objects';
  END IF;
END $default_checks$;

\echo 'S10 explicit opt-in is still possible with scoped RLS'
GRANT SELECT ON TABLE public.s10_new_public_catalog TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.s10_new_public_catalog TO service_role;
INSERT INTO public.s10_new_public_catalog VALUES(100,'synthetic allowed catalogue');
SET ROLE anon;
SELECT count(*) AS catalog_access_after_explicit_grant
  FROM public.s10_new_public_catalog;
DO $deny$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.s10_new_private;
    RAISE EXCEPTION 'S10 anonymous user read internal table';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $deny$;
RESET ROLE;
SET ROLE authenticated;
DO $deny_authenticated$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.s10_new_private;
    RAISE EXCEPTION 'S10 authenticated user read internal table';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $deny_authenticated$;
RESET ROLE;
\echo 'S10 PASS — old orders/catalog permissions intact; new tables/sequences private; explicit catalog opt-in functional'
