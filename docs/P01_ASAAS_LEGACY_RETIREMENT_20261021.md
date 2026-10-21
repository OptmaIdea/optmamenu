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
