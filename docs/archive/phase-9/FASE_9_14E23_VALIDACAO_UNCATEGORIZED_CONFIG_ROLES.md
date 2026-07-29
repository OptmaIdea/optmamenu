# Fase 9.14E.23 — Validação de Uncategorized: custom roles, ações sensíveis e config admin

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628201000_revoke_authenticated_from_unused_store_config_admin.sql`

## Resultado

O diagnóstico retornou **120 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **121**.

Redução confirmada: **1 função**.

## Função removida

Saiu do diagnóstico a função tratada na migration:

- `update_store_config_admin`.

## Funções preservadas

Permaneceram no diagnóstico, conforme esperado:

- `list_store_custom_roles`;
- `create_store_custom_role`;
- `update_store_custom_role`;
- `get_sensitive_action_requirement`;
- `get_store_sensitive_action_matrix`;
- `update_store_sensitive_action_rule`;
- `get_store_config_admin`;
- `get_product_transit_summary`;
- `product_has_movements`;
- `redeem_reward`;
- `reset_store_master_password`;
- `log_user_session_event`.

## Distribuição atual

- `uncategorized_review`: 32;
- `inventory_stock_transfer`: 28;
- `users_security_permissions`: 23;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **120 funções**.

## Interpretação

A etapa foi validada porque removeu apenas a RPC de escrita administrativa de configuração sem uso operacional atual e preservou os fluxos ativos de custom roles, ações sensíveis, leitura de configuração, produto/trânsito, sessão e senha master.

## Próxima etapa

9.14E.24 — fechamento ou nova rodada pontual do grupo `uncategorized_review`.

Recomendação:

- reavaliar as 32 funções remanescentes;
- documentar exceções intencionais quando forem fluxos ativos;
- criar nova migration apenas se ainda houver função claramente legada/inativa.
