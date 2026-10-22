# P07 — Granular inventory-location write privileges (22/10/2026)

## Production baseline / evidence
- Table `public.inventory_location_balances`: RLS enabled; seven policies.
- Three legacy policies `inventory_location_balances_insert`, `inventory_location_balances_update` and `inventory_location_balances_delete` accepted *any active store member* via `is_store_member(store_id)`.
- Specific INSERT/UPDATE policies already required the more appropriate `stock.adjust`, `stock.transfer` or store ownership. Because PostgreSQL permissive policies compose with OR, the legacy ones overrode the narrower permissions.
- Security helper `is_store_member` recognizes any active `store_members` record; `user_has_store_permission` delegates to `_v2` permission templates and overrides.

## Change
- Only `ALTER POLICY` on three legacy write policies, changing TO authenticated and replacing the member-only condition with owner/stock.adjust/stock.transfer.
- Preserve all SELECT policies and their existing behavior, as well as named permission-specific INSERT/UPDATE policies.
- Do not modify stored balances, stocks, invoices, payments or customer records.
- Preflight aborts on unexpected existing policy expression or RLS drift.

## Regression
GitHub Actions PostgreSQL 17 reproduces seven current policies (with synthetic user-store entitlement data). It proves the original vulnerability (a read-only store member could UPDATE a stock row) then applies the **same migration** and checks: owner, stock.adjust, stock.transfer, read-only employee, member of another store, INSERT/UPDATE/DELETE, and stock SELECT. No actual production stock mutated.

**Limit:** This does not yet exercise real checkout/PDV/transfer SQL against the full production schema. Historical SECURITY DEFINER callers may bypass RLS intentionally; preserve their guarded operations. Perform controlled browser acceptance before full customer-facing rollout.

## Operation
This closes a genuine authorization weakness, not merely an adaptation to Supabase 2026 grants. Release only after CI fully passes and SQL checks confirm RLS write policies remain narrow. Expected cost R$ 0.

## Verificação no banco ativo e no CI — 22/10

- GitHub Actions #39756817389 **SUCCESS** (P07 PostgreSQL 17, regressões anteriores, suíte da aplicação e build).
- Migration efetivamente aplicada no Supabase sob versão **20261022063929**, nome `inventory_location_balances_write_policy_hardening_20261022`.
- `pg_policies`: três policies de escrita legadas agora têm `roles={authenticated}` e cláusulas de permissão owner / `stock.adjust` / `stock.transfer`. As duas policies SELECT e os nomes das policies permanecem intactos.
- Não foi executada nenhuma atualização direta em registros de estoque, pedido ou cliente no projeto ativo.
- Próximo aceite humano: perfil read-only da loja deve consultar estoque sem poder ajustar, operador autorizado deve movimentar, e tentativa em loja alheia deve ser negada.
