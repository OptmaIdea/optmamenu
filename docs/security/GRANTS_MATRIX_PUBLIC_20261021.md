# Inventory of public table privileges — read-only snapshot, 2026-10-21

Obtained directly from PostgreSQL catalogs in Supabase project `lgkkfmqzaorrutuoqeax` while on plan Free. Snapshot only; no modifications.

- 129 user tables in `public`, RLS enabled on all 129.
- Matrix records table, RLS status, policy count, and effective PostgreSQL table privileges (SELECT, INSERT, UPDATE, DELETE) for each of `anon`, `authenticated` and `service_role`.
- Privileges alone **do not** imply access to rows: RLS and `SECURITY DEFINER` function contracts are distinct.
- This inventory is **not** approval to grant permissions, and does not classify intent. Table-specific decisions require source-code caller tracing and negative HTTP/JWT tests.
- Important exceptions: `customer_sms_otp_issue_ledger` and `customer_sms_otp_rate_secret` have no direct service_role table privileges. Do not change without verifying the intended SECURITY DEFINER model.
- Only database catalog metadata was exported; **no row data, customer identifiers, tokens, emails or phone numbers**.

See [CSV](./GRANTS_MATRIX_PUBLIC_20261021.csv).
