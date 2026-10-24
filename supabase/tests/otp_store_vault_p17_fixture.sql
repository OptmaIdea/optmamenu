-- Self-contained synthetic PostgreSQL 17 test of Phase V1 private vault.
-- No Auth service, customers, real keys, or external calls.
DO $roles$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $roles$;

CREATE TABLE public.stores (
  id uuid PRIMARY KEY,
  sms_gateway_token text
);
INSERT INTO public.stores VALUES
  ('00000000-0000-4000-8000-000000000001', 'osg_live_'||repeat('A',32)),
  ('00000000-0000-4000-8000-000000000002', 'osg_live_'||repeat('B',32)),
  ('00000000-0000-4000-8000-000000000003', 'invalid-token');

-- Reproduce legacy broad table read grants; vault must remain invisible.
GRANT SELECT ON TABLE public.stores TO authenticated;

CREATE TABLE public.ci_otp_vault_probe (name text);
