# Fase 9.14E.21 — Validação de Uncategorized: loja, owner e identidade

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628192000_revoke_authenticated_from_legacy_user_identity_helpers.sql`

## Resultado

O diagnóstico retornou **123 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **125**.

Redução confirmada: **2 funções**.

## Funções removidas

Saíram do diagnóstico as 2 funções tratadas na migration:

- `get_user_store_id()`;
- `get_user_display_identity(p_user_id uuid)`.

## Funções preservadas

Permaneceram no diagnóstico, conforme esperado:

- `get_login_store_options()`;
- `get_user_store_by_id(p_user_id uuid)`;
- `validate_store_slug(p_store_id uuid, p_slug text)`;
- `app_is_store_owner(p_store_id uuid)`;
- `is_store_owner(p_store_id uuid)`;
- `user_owns_store(p_store_id uuid)`;
- `app_current_store_role(p_store_id uuid)`.

## Distribuição atual

- `uncategorized_review`: 35;
- `inventory_stock_transfer`: 28;
- `users_security_permissions`: 23;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **123 funções**.

## Interpretação

A etapa foi validada porque removeu apenas helpers legados/sensíveis sem uso direto operacional atual e preservou os fluxos ativos de login, layout privado, slug e helpers centrais de owner/role.

## Próxima etapa

9.14E.22 — continuar `uncategorized_review` em novo recorte.

Sugestão de recorte:

- caixa/livro diário;
- marketing/campanhas;
- mensagens administrativas;
- promoções;
- helpers comerciais diversos.
