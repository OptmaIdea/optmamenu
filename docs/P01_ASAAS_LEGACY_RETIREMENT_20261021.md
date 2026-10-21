# Asaas Sandbox — retired integration package

Read-only observation, 21 October 2026:
- Gelinhares: OptmaPay Sandbox is the only registered enabled/ready online provider.
- No Asaas provider, payment intents or processed webhook events.
- Two active route aliases named asaas_pix exist for pickup and delivery. The UI groups these with generic online Pix, therefore the routes and destination account Caixa Loja Centro will NOT be mutated in this package.
- Asaas sandbox adapter (verify_jwt=true) and webhook (verify_jwt=false) are ACTIVE in Supabase.

Implementation:
- Adapter is replaced by an HTTP 410 endpoint without side effects.
- Webhook acknowledges POST with HTTP 200, ignored=true, and never reads events or modifies accounts (prevents unnecessary provider retries).
- A SQL migration rejects saving any Asaas provider and disables hypothetical enabled Asaas rows. OptmaPay RPC branch remains unchanged.
- No secret removal, data deletion, customer mutation, historical journal cleanup or route edits.

Operational safety:
- This is a separate package from draft PR #10.
- Tests must pass before deploying legacy function replacements.
- Production SQL migration needs independent approval/rollout assessment; it is not automatically applied by the GitHub PR.
- Keep verify_jwt=true for adapter and false for webhook during deployment.
- Later revoke any remaining Asaas API keys at provider origin and remove obsolete environment secrets after confirming no residual consumer.

## Real deployment and verification, 21/10/2026

- GitHub Actions Verify #39624361905 SUCCESS: Node endpoint tests, PostgreSQL 17 migration with synthetic Asaas and OptmaPay fixtures, npm tests, build.
- Supabase project lgkkfmqzaorrutuoqeax: Asaas adapter v10 deployed with verify_jwt=true; Asaas webhook v10 deployed with verify_jwt=false.
- Supabase live code re-read after deployment: both v10 handlers return legacy_provider_retired and contain no calls to the Asaas API nor references to Asaas credentials.
- Migration applied successfully, history version **20261021121959**, name `retire_asaas_provider_safe_20261021`.
- Runtime database check: guard in save_online_payment_provider_safe blocks Asaas; Gelinhares OptmaPay remains enabled=true, is_default=true, credential_status=ready.
- Historical asaas_pix routes (2) unchanged, both still active due common online_pix grouping. No historic orders or cashbook entries removed.
- Still required: optional explicit rollback/revocation of old credentials from Asaas account, reconciled cleanup of route aliases, final functional acceptance by user. This does **not** prove live HTTP behavior using a real JWT, only deployed source state + isolated tests.
- PR kept isolated from PR #10. Merge with shared branch only after checking migration ledger/version alignment and workflow conflicts.
