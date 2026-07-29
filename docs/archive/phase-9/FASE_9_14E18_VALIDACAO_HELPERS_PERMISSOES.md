# Fase 9.14E.18 — Validação de helpers e permissões remanescentes

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628185000_revoke_authenticated_from_unused_permission_helpers.sql`

## Resultado

O diagnóstico retornou **125 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **128**.

Redução confirmada: **3 funções**.

## Funções removidas

Saíram do diagnóstico as 3 funções tratadas na migration:

- `get_effective_store_member_permissions_v2`;
- `get_store_permission_catalog`;
- `update_security_log_member_visibility`.

## Funções preservadas

Permaneceram no diagnóstico, conforme esperado, os helpers centrais e fluxos ativos:

- `is_store_member`;
- `user_has_store_permission`;
- `user_has_store_permission_v2`;
- `get_current_user_store_permissions_v2`;
- `get_store_permission_matrix_v3`;
- `get_store_member_permission_detail`;
- `get_store_members_for_permissions`;
- `assign_store_custom_role_to_member`;
- `change_store_member_role`;
- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`;
- funções ativas de convites, logs, membros e avatar.

## Distribuição atual

- `uncategorized_review`: 37;
- `inventory_stock_transfer`: 28;
- `users_security_permissions`: 23;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **125 funções**.

## Interpretação

A etapa foi validada porque removeu apenas helpers sem chamada operacional atual identificada e preservou os fluxos centrais de autenticação, permissões, Segurança e Usuários.

O grupo `users_security_permissions` agora possui **23 funções** remanescentes, que devem ser tratadas como exceções intencionais salvo descoberta pontual posterior.

## Próxima etapa

9.14E.19 — fechamento documental do bloco Usuários/Segurança.

Critério recomendado:

- documentar as 23 funções remanescentes como necessárias;
- separar helpers centrais de fluxos de tela;
- registrar hardening futuro onde ainda houver apenas `is_store_member` como gate;
- não criar nova migration agressiva para este grupo sem evidência de função legada/inativa.
