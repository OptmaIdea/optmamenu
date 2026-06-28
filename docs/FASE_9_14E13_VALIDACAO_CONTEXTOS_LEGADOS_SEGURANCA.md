# Fase 9.14E.13 — Validação de contextos/gates legados de Segurança

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628145500_revoke_authenticated_from_legacy_security_context_helpers.sql`

## Resultado

O diagnóstico retornou **153 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **158**.

Redução confirmada:

- **5 funções removidas da superfície authenticated**.

## Funções removidas

As funções abaixo não aparecem mais no diagnóstico:

- `can_access_security_section(p_store_id uuid, p_section text, p_manage boolean)`;
- `can_access_security_section_v3(p_store_id uuid, p_section text, p_manage boolean)`;
- `get_current_user_security_context()`;
- `get_current_user_security_context_v2()`;
- `get_effective_store_permissions(p_store_id uuid)`.

## Interpretação

A etapa foi validada porque:

- removeu apenas acesso direto de cliente autenticado a helpers/contextos legados;
- não dropou funções;
- preservou `service_role`;
- manteve funções administrativas ativas no diagnóstico;
- preservou as funções de edição de papéis documentadas na 9.14E.12.

## Observação técnica

A revogação de `can_access_security_section_v3` remove a execução direta pelo cliente autenticado, mas não altera o uso interno por funções `SECURITY DEFINER` que executam sob o contexto do owner/definer.

## Distribuição atual por grupo

Com base no diagnóstico validado:

- `users_security_permissions`: 51;
- `uncategorized_review`: 37;
- `inventory_stock_transfer`: 28;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 7;
- `internal_technical_candidate`: 2.

Total:

- **153 funções**.

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
- 9.14E.11 reduziu de 161 para 158;
- 9.14E.12 documentou permissões técnicas remanescentes, sem alterar contagem;
- 9.14E.13 reduziu de 158 para 153.

## Próxima etapa recomendada

### 9.14E.14 — Usuários/Segurança ativos

Continuar o grupo `users_security_permissions` por subgrupos pequenos:

- funções de membros e convites;
- funções de perfil próprio/meus dados;
- logs e histórico;
- funções de matriz/catálogo de permissões;
- helpers `user_has_store_permission*` e `is_store_member`.

Diretriz:

- preservar funções usadas diretamente por hooks/telas;
- revogar apenas auxiliares legadas sem uso direto;
- documentar exceções intencionais quando forem gates centrais do sistema.
