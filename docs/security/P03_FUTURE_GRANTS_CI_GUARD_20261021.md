# P03 — Enforce explicit grants on newly created public tables

Date: 2026-10-21. GitHub Actions only; no paid Supabase branches, no production DDL.

Supabase breaking-change deadline for existing projects: October 30, 2026.
Existing tables preserve grants; newly created public tables need deliberate opt-in.
Source: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically

## Enforced starting with migrations dated 20261022000000

Any CREATE TABLE in public must have in the same SQL migration:
1. ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY.
2. An explicit minimal GRANT on that named table to anon/authenticated/service_role, OR
   -- optmamenu:data-api-private <name> when intentionally not reachable through Data API.

The private marker does not waive RLS. An explicit direct grant conflicts with the private marker and fails CI.

## Verification

- node --test scripts/security/audit-future-table-grants.test.mjs
- node scripts/security/audit-future-table-grants.mjs

Fixtures exercise positive least-privilege grants, private internal tables, negative missing grants,
negative missing RLS, mislabelled private tables and ignored non-public schemas.

The existing P01 PostgreSQL 17 regression tests separately simulate the future grant defaults.
The checker does not retroactively reject previously approved migrations; historical objects keep grants.
The October 18 internal OTP ledger and secret tables have RLS and are intentionally not granted direct browser access.

## Limits

Static guard only, not full SQL parser or real PostgREST/JWT security test. Reviewers must inspect
dynamic SQL, grant scopes, explicit column privileges, SECURITY DEFINER functions and new API consumers.
No live table grants or default ACL settings were changed by this package.
