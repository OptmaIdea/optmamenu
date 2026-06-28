# Fase 9.14E.8 — Validação da triagem de estoque e transferências

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628031500_revoke_authenticated_from_unused_inventory_summary.sql`

Advisor atualizado informado:

- `docs/ADVISORS.md`
- commit `4d384028e38b27fc9bc624dd4118c8a76e67f7ec`

## Resultado

O diagnóstico retornou **163 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **164**.

Redução confirmada:

- **1 função removida da superfície authenticated**.

## Função removida

A função abaixo não aparece mais no diagnóstico:

- `get_inventory_criticality_summary(p_store_id uuid)`.

## Funções operacionais preservadas

Permanecem no diagnóstico, conforme esperado:

- `adjust_stock_to_physical_count`;
- `create_manual_stock_adjustment`;
- `cancel_stock_transfer`;
- `create_stock_transfer_draft_batch`;
- `create_stock_transfer_draft_from_suggestion`;
- `get_inventory_management_products`;
- `get_inventory_position_by_store`;
- `get_inventory_transit_by_store`;
- `get_product_inventory_lifecycle`;
- `get_product_stock_management`;
- `get_product_stock_movements`;
- `get_product_stock_rules_safe`;
- `get_product_transfer_divergences`;
- `get_stock_movements_safe`;
- `get_stock_transfer_detail`;
- `get_stock_transfer_suggestions_by_store`;
- `get_stock_transfers_by_store`.

## Interpretação

A etapa foi validada porque:

- removeu apenas uma função agregada sem uso operacional atual identificado;
- preservou as funções de estoque/transferência usadas pelo frontend/admin;
- não alterou telas, hooks ou serviços de estoque;
- manteve `service_role` para compatibilidade operacional.

## Advisor atualizado

O arquivo `docs/ADVISORS.md` atualizado no commit informado continua com:

- warnings públicos intencionais da loja pública, OTP e catálogo público já tratados/documentados na 9.14D;
- warnings autenticados ainda em auditoria incremental pela 9.14E;
- o grupo `inventory_stock_transfer` ainda presente para funções operacionais que serão documentadas ou endurecidas em rodadas posteriores.

## Estado acumulado da 9.14E

Até aqui:

- 9.14E.1 reduziu de 184 para 176;
- 9.14E.2 reduziu de 176 para 174;
- 9.14E.3 endureceu `extend_reservation` sem alterar contagem;
- 9.14E.4 reduziu de 174 para 173;
- 9.14E.5 reduziu de 173 para 169;
- 9.14E.6 reduziu de 169 para 164;
- 9.14E.7 documentou comercial restante, sem alterar contagem;
- 9.14E.8 reduziu de 164 para 163.

## Distribuição atual por grupo

Com base no diagnóstico validado:

- `users_security_permissions`: 58;
- `uncategorized_review`: 37;
- `inventory_stock_transfer`: 28;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 14;
- `settings_configuration`: 8;
- `internal_technical_candidate`: 2.

## Próxima etapa recomendada

### 9.14E.9 — Estoque/transferências operacionais usadas

A próxima etapa deve documentar como exceções intencionais as funções de estoque e transferência ainda usadas, separando possíveis hardenings futuros.

Pontos recomendados:

- preservar funções usadas diretamente em `stockService.ts` e hooks de inventário;
- documentar que várias já validam `is_store_member` e escopo de loja/local;
- evoluir futuramente para permissões granulares como `stock.view`, `stock.adjust` e `stock.transfer` onde ainda houver apenas vínculo com loja;
- evitar revogação de funções operacionais ativas sem refatoração de frontend.
