# Fase 9.14E.15 — Validação de perfil próprio e onboarding

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628154500_revoke_authenticated_from_legacy_profile_onboarding_helpers.sql`

## Resultado

O diagnóstico retornou **138 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **147**.

Redução confirmada: **9 funções**.

## Funções removidas

Saíram do diagnóstico as 9 funções de perfil próprio, onboarding, solicitações e histórico visível tratadas na migration.

## Distribuição atual

- `uncategorized_review`: 37;
- `users_security_permissions`: 36;
- `inventory_stock_transfer`: 28;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **138 funções**.

## Interpretação

A etapa foi validada porque removeu apenas funções sem uso direto operacional atual identificado e preservou os fluxos ativos de usuários, convites, papéis, permissões, logs e helpers centrais.

## Próxima etapa

9.14E.16 — continuar o grupo `users_security_permissions` em subgrupos pequenos, priorizando convites, membros, logs e helpers centrais.
