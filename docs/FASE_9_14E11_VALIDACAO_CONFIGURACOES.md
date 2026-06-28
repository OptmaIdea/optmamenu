# Fase 9.14E.11 — Validação de Configurações

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628103500_revoke_authenticated_from_settings_legacy_helpers.sql`

Correção de assinatura aplicada antes da validação:

- commit `f9d1e0b9c2f300541faa5bec897c838ec35cd4a7`

## Resultado

O diagnóstico retornou **158 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **161**.

Redução confirmada:

- **3 funções removidas da superfície authenticated**.

## Funções removidas

As funções abaixo não aparecem mais no diagnóstico:

- `update_store_identity_settings(...)`;
- `can_access_settings_section(p_store_id uuid, p_section text, p_manage boolean)`;
- `can_access_settings_section_v3(p_store_id uuid, p_section text, p_manage boolean)`.

## Funções operacionais preservadas

Permanecem no diagnóstico, conforme esperado:

- `get_store_settings_center(p_store_id uuid)`;
- `update_store_settings_section(p_store_id uuid, p_section text, p_payload jsonb)`;
- `get_store_security_settings(p_store_id uuid)`;
- `update_store_idle_timeout_settings(p_store_id uuid, p_idle_timeout_minutes integer)`;
- `validate_store_slug(p_store_id uuid, p_slug text)`.

## Interpretação

A etapa foi validada porque:

- removeu apenas funções antigas/auxiliares sem uso direto operacional atual identificado;
- preservou o fluxo ativo do Centro de Configurações;
- preservou Segurança/Sessão;
- preservou validação autenticada de slug;
- não alterou telas, serviços ou UX de Configurações.

## Distribuição atual por grupo

Com base no diagnóstico validado:

- `users_security_permissions`: 56;
- `uncategorized_review`: 37;
- `inventory_stock_transfer`: 28;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total:

- **158 funções**.

## Estado acumulado da 9.14E

Até aqui:

- 9.14E.1 reduziu de 184 para 176;
- 9.14E.2 reduziu de 176 para 174;
- 9.14E.3 endureceu `extend_reservation` sem alterar contagem;
- 9.14E.4 reduziu de 174 para 173;
- 9.14E.5 reduziu de 173 para 169;
- 9.14E.6 reduziu de 169 para 164;
- 9.14E.7 documentou comercial restante, sem alterar contagem;
- 9.14E.8 reduziu de 164 para 163;
- 9.14E.9 documentou estoque/transferências restantes, sem alterar contagem;
- 9.14E.10 reduziu de 163 para 161;
- 9.14E.11 reduziu de 161 para 158.

## Próxima etapa recomendada

### 9.14E.12 — Funções técnicas remanescentes de permissões

O diagnóstico ainda possui 2 funções em `internal_technical_candidate`:

- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`.

Elas devem ser auditadas com cuidado porque podem ser usadas diretamente pela tela de Segurança/Papéis.

Diretriz:

- buscar uso real no frontend;
- preservar se forem o caminho ativo de edição de papéis;
- se forem usadas, documentar como exceção intencional e não revogar;
- se não forem usadas, preparar migration pequena.
