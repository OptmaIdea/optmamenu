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

This means that *two different customer_id records in the same store sharing the same normalized phone* can expose orders across customer identities. The fixture deliberately includes one such order and asserts current behavior. This is **evidence of policy behavior**, not proof that a production attacker can obtain a verified account with a victim's phone.

**Recommendation:** Review phone ownership verification, phone-reassignment, deleted-account re-registration, and customer identity linking before eliminating the fallback. Prefer a migration path that binds legacy guest orders to customer_id after proof, rather than exposing all same-phone orders indefinitely. Treat as P1 privacy investigation; preserve current behavior until intent and consequences are confirmed.

## Change on October 30
The official Supabase changelog says that existing grants persist; tables created after the cutoff must be explicitly granted access.
This package does **not** change production default privileges or add broad grants. Use the same PostgreSQL 17 approach to test any targeted future migration and its specific API consumers.

Source: https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
