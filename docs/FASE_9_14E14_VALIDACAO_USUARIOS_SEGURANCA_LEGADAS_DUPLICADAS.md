# Fase 9.14E.14 — Validação de legadas de Usuários/Segurança

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628152000_revoke_authenticated_from_legacy_users_security_duplicates.sql`

## Resultado

O diagnóstico retornou **147 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **153**.

Redução confirmada: **6 funções**.

## Funções removidas

Saíram do diagnóstico as 6 funções legadas/duplicadas tratadas na migration.

## Funções ativas preservadas

Permaneceram os caminhos atuais esperados:

- `get_store_permission_matrix_v3`;
- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`;
- `get_store_members_for_permissions`;
- `change_store_member_role`;
- `create_store_member_invite`.

## Distribuição atual

- `users_security_permissions`: 45;
- `uncategorized_review`: 37;
- `inventory_stock_transfer`: 28;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **147 funções**.

## Interpretação

A etapa foi validada porque removeu apenas funções antigas/duplicadas sem uso direto atual identificado e preservou os fluxos ativos de Segurança/Usuários.

## Próxima etapa

9.14E.15 — continuar o grupo `users_security_permissions` em subgrupos pequenos, priorizando perfil próprio, convites, logs e helpers centrais.
