# Fase 9.14E.17 — Validação de membros e perfil administrativo

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628182500_revoke_authenticated_from_legacy_member_profile_admin_helpers.sql`

## Resultado

O diagnóstico retornou **128 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **136**.

Redução confirmada: **8 funções**.

## Funções removidas

Saíram do diagnóstico as 8 funções de membros/perfil administrativo tratadas na migration:

- `get_my_store_memberships`;
- `get_store_member_access_timeline`;
- `can_manage_user_avatar`;
- `list_store_profile_change_requests`;
- `propose_store_profile_change_request`;
- `review_store_profile_change_request`;
- `update_store_member_profile_details`;
- `update_store_member_status`.

## Funções preservadas

Permaneceram no diagnóstico, conforme esperado:

- `accept_store_member_invite`;
- `decline_my_store_member_invite`;
- `get_my_pending_store_invites`;
- `get_store_member_invites`;
- `cancel_store_member_invite`;
- `create_store_member_invite`;
- `get_store_member_session_summary`;
- `get_store_member_full_history`;
- `create_store_member_occurrence_v2`;
- `update_store_member_avatar_url`;
- `update_store_member_permissions`;
- `change_store_member_role`.

## Distribuição atual

- `uncategorized_review`: 37;
- `inventory_stock_transfer`: 28;
- `users_security_permissions`: 26;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **128 funções**.

## Interpretação

A etapa foi validada porque removeu apenas funções sem uso direto operacional atual identificado e preservou os fluxos ativos de convites, membros, histórico, avatar, permissões e papéis.

## Próxima etapa

9.14E.18 — helpers centrais e permissões remanescentes.

Diretriz:

- preservar helpers centrais usados por todo o sistema;
- documentar exceções intencionais;
- evitar revogar `is_store_member` e `user_has_store_permission*` sem análise ampla;
- concluir o grupo `users_security_permissions` por classificação, não apenas por redução de contagem.
