# P02 — Customer and store isolation under current RLS (21 October 2026)

## Baseline
- GitHub shared HEAD: `0fdc121a6c29a20a172e25a8751d29b0d01f580c`, CI success.
- Supabase project: `lgkkfmqzaorrutuoqeax`, PostgreSQL 17.6, 129 public tables all RLS enabled.
- Verified function source and RLS policy expressions from current database on 21 October; copied into
  `supabase/tests/p02_customer_isolation_rls_pg17.sql` for repeatable tests.
- No private customer rows, phones or credentials were extracted; all fixtures are synthetic.

## Test scope (PostgreSQL 17 service on free GitHub Actions)
- Two stores, two customers in store A and one in store B; independent JWT subjects, session IDs and trusted devices.
- Customer A sees its orders and loyalty; store B orders remain hidden even when phone matches or JWT store_id claim is forged.
- A2 sees only A2 orders/loyalty, except documented cross-customer same-phone fallback explained below.
- An authenticated client with a valid customer identity cannot gain the staff branch by setting the role claim to `owner`.
- Revoking trusted device, session or identity results in zero customer rows.
- Sessions older than `sessions_valid_after` no longer see customer rows.
- An anonymous request has no access to these rows.
- Store A owner sees only store A orders (staff loyalty policy explicitly stubbed to deny for this scope).
- The private `customer_auth_identities` table remains inaccessible directly to both browser roles.

**Important limitation:** Real Supabase Auth JWT signature verification is NOT tested here. The test runner sets PostgreSQL request.jwt.claims directly using synthetic values. PostgREST rejects untrusted JWTs before inserting the claims. Supabase end-to-end tests require a separate controlled fixture environment, not real customers.

## Potential privacy risk — same-phone fallback

The current `orders_customer_select_own` policy authorizes an order either by `customer_id` OR by the current verified customer session's `phone`, provided store matches.

This means that *two different customer_id records in the same store sharing the same normalized phone* can expose orders across customer identities. The initial fixture demonstrated this current behavior; the targeted migration now asserts the other linked customer's order is hidden while an unlinked guest order remains visible. This is **evidence of policy behavior**, not proof that a production attacker can obtain a verified account with a victim's phone.

**Recommendation:** Review phone ownership verification, phone-reassignment, deleted-account re-registration, and customer identity linking before eliminating the fallback. Prefer a migration path that binds legacy guest orders to customer_id after proof, rather than exposing all same-phone orders indefinitely. Treat as P1 privacy investigation; preserve current behavior until intent and consequences are confirmed.

## Change on October 30
The official Supabase changelog says that existing grants persist; tables created after the cutoff must be explicitly granted access.
This package does **not** change production default privileges or add broad grants. Use the same PostgreSQL 17 approach to test any targeted future migration and its specific API consumers.

Source: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically


## Targeted fix prepared after the baseline test

A live read-only aggregate on 21/10 found 143 orders:
- 89 have phone but no customer_id (25 share a phone with a registered customer);
- 37 have a linked customer_id and phone;
- 17 have neither;
- zero store+phone groups have multiple distinct linked customer IDs in current data.

The existing policy is permissive for future matching-phone accounts, even without a demonstrated live conflict.
Migration `supabase/migrations/20261021205404_orders_customer_phone_fallback_only_unlinked_20261021.sql` narrows the phone fallback to orders where `customer_id IS NULL`.
It preserves all 89 phone-only legacy records for access by a properly verified customer, but denies linking an already-identified order to a different customer merely because its phone matches.

**Rollback strategy:** keep the previous RLS policy expression on record in the captured P02 test and restore with `ALTER POLICY orders_customer_select_own ON public.orders USING (...)` only if monitored legitimate history retrieval regresses. No order row is updated.

**Release gate:** confirm that the isolated PostgreSQL 17 test passes both negative (other linked customer) and positive (unlinked guest order) cases, and that existing CI stays green before applying to the active Supabase. This migration is not a JWT signature verifier.

No customer account changes, deletion, financial mutation, token exposure or data export.

## Real deployment and read-only verification (21/10)

- PostgreSQL 17 synthetic RLS isolation suite and all package tests passed at commit `bd18cb3` in GitHub Actions run #39696155792.
- Supabase migration applied successfully and recorded as version **20261021205404**, name `orders_customer_phone_fallback_only_unlinked_20261021`.
- Live policy introspection confirmed `orders_customer_select_own` includes `customer_id IS NULL` only in the phone fallback branch, and retains store and identity checks.
- No changes to orders or customer data. Existing RLS policies outside this one remain untouched.
- Security Advisors after the change: 27 no-policy informational, 2 mutable search-path warnings, 43 anon and 319 authenticated SECURITY DEFINER warnings, 1 leaked password protection warning. These need separate classification, not mass revocation.
- Full signed-JWT integration test on real Supabase Auth remains pending. Do not interpret PostgreSQL synthetic role tests as authentication cryptography tests.
