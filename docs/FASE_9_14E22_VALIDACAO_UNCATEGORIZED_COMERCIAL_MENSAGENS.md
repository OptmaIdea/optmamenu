# Fase 9.14E.22 — Validação de Uncategorized: comercial, mensagens e helpers sensíveis

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628193500_revoke_authenticated_from_legacy_sensitive_uncategorized_helpers.sql`

## Resultado

O diagnóstico retornou **121 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **123**.

Redução confirmada: **2 funções**.

## Funções removidas

Saíram do diagnóstico as 2 funções tratadas na migration:

- `perform_manual_adjustment`;
- `reset_user_pin_with_password`.

## Funções preservadas

Permaneceram no diagnóstico, conforme esperado:

- `get_marketing_center_safe`;
- `upsert_promotion_campaign_safe`;
- `build_campaign_recipients_preview_safe`;
- `prepare_campaign_recipients_safe`;
- `get_campaign_recipients_safe`;
- `mark_campaign_recipient_manual_sent_safe`;
- `create_cashbook_entry`;
- `get_cashbook_entries_safe`;
- `get_cashbook_summary`;
- `get_commercial_dashboard_safe`;
- `send_admin_message`;
- `cleanup_old_messages`.

## Distribuição atual

- `uncategorized_review`: 33;
- `inventory_stock_transfer`: 28;
- `users_security_permissions`: 23;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total: **121 funções**.

## Interpretação

A etapa foi validada porque removeu apenas helpers sensíveis/legados sem uso direto operacional atual e preservou os fluxos ativos de marketing, campanhas, caixa, dashboard comercial e mensagens administrativas.

## Próxima etapa

9.14E.23 — continuar `uncategorized_review` em novo recorte.

Sugestão de recorte:

- custom roles;
- ações sensíveis;
- store config admin;
- helpers de produto/trânsito;
- recompensas/fidelidade legada.
