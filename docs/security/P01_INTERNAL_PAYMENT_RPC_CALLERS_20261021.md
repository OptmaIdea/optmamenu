# P01 — Internal payment credential status RPC: caller contract

Date: 2026-10-21. Scope: isolated security PR, no production changes.

## Verified source dependency

The Edge Function supabase/functions/optmapay-sandbox-adapter/index.ts calls
mark_online_payment_provider_credential_status_internal.

1. It initializes userClient with the anon key and caller Authorization header.
2. It calls get_online_payments_workspace_safe with storeId, rejecting failed access with HTTP 403.
3. It initializes service using the server-only SUPABASE_SERVICE_ROLE_KEY.
4. It calls the internal credential-status RPC via service.rpc with the requested storeId.

Restricting direct EXECUTE to service_role is therefore compatible with this known caller.

## CI regression

The file supabase/tests/p01_internal_payment_rpc_callers.test.mjs scans frontend and
Supabase Edge Function sources for calls to this internal RPC. New call sites
or changes to the known authorization/service-role call path fail the CI job.

This is a static test, not an HTTP/JWT end-to-end test. It does not validate
the permission helper itself or execute any actual payment.

## Pending

- Do not merge or apply the migration to the active Supabase until all caller checks and negative HTTP tests are reviewed.
- Active database still exposes the internal RPC until the migration is applied.
- Grants compatibility requires continued classification of table callers and recorded migration differences.
- No additional paid infrastructure is required for these checks.
