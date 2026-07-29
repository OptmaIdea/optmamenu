# Fase 9.14E.16 — Validação de logs de Segurança

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628181000_revoke_authenticated_from_legacy_security_log_helpers.sql`

## Resultado

O diagnóstico retornou **136 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **138**.

Redução observada: **2 funções**.

## Funções tratadas

As funções abaixo não aparecem mais no diagnóstico:

- `get_store_security_logs(...)`;
- `translate_security_action_ptbr(p_action text)`.

Observação: havia duas assinaturas previstas para `get_store_security_logs`, mas no diagnóstico validado a remoção efetiva reduziu o total geral em 2 funções.

## Funções preservadas

Permanecem no diagnóstico, conforme esperado:

- `get_store_security_activity_logs(...)`;
- `get_my_visible_activity_logs(...)`;
- `insert_security_log(...)`.

## Distribuição atual

- `uncategorized_review`: 37;
- `users_security_permissions`: 34;
- `inventory_stock_transfer`: 28;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **136 funções**.

## Interpretação

A etapa foi validada porque removeu as funções legadas de logs/helper previstas no diagnóstico atual e preservou os fluxos ativos de Histórico de atividades, Meu Histórico e registro de logs.

A diferença entre o esperado inicial e o total final foi documentada: o resultado real validado é 138 → 136.

## Próxima etapa

9.14E.17 — continuar `users_security_permissions`, priorizando convites, membros ativos, histórico administrativo e helpers centrais de permissão.
