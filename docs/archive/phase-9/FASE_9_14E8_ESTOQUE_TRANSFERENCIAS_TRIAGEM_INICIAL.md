# Fase 9.14E.8 — Estoque e transferências: triagem inicial

## Status

Correção preparada.

Esta frente iniciou a auditoria incremental do grupo `inventory_stock_transfer` dentro dos warnings `authenticated_security_definer_function_executable`.

## Base atual

Após a 9.14E.6, o diagnóstico retornou **164 funções** ainda executáveis por `authenticated`.

A 9.14E.7 documentou o bloco comercial restante como exceção intencional, sem migration.

## Critério desta rodada

Foram buscados usos diretos e indiretos no frontend/admin para funções de estoque, inventário e transferências.

A decisão foi:

- preservar funções usadas em `stockService.ts`, hooks de inventário, ciclo de vida do produto e configurações de estoque;
- não mexer em funções operacionais de ajuste, transferência, leitura de saldo, movimentos ou detalhes;
- tratar somente função sem uso operacional atual identificado.

## Funções preservadas

As funções abaixo possuem uso direto/indireto em frontend/admin e não entram na migration:

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

Locais recorrentes encontrados:

- `src/services/stockService.ts`;
- `src/services/stockSettingsService.ts`;
- hooks em `src/pages/private/admin/products/inventory/hooks`;
- serviços de ciclo de vida em `src/pages/private/admin/products/inventory/services`;
- páginas de produtos/inventário.

## Função candidata tratada

### `get_inventory_criticality_summary(p_store_id uuid)`

Achados:

- não foi encontrado uso operacional atual no frontend/admin;
- busca geral encontrou apenas documentação/Advisors;
- é uma leitura agregada/sumarizada;
- há funções de inventário mais completas em uso, como `get_inventory_management_products` e `get_inventory_position_by_store`.

Decisão:

- revogar `authenticated`;
- revogar `anon` e `PUBLIC` por garantia;
- preservar `service_role`;
- não dropar a função nesta etapa.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628031500_revoke_authenticated_from_unused_inventory_summary.sql`

Escopo:

- `REVOKE EXECUTE` de `PUBLIC`, `anon` e `authenticated` em `get_inventory_criticality_summary(uuid)`;
- `GRANT EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente:

- a contagem deve cair de 164 para 163 funções;
- `get_inventory_criticality_summary` deve sair do diagnóstico `authenticated_can_execute=true`;
- as demais funções operacionais de estoque/transferência devem permanecer.

## Fora do escopo

- alterar telas de estoque;
- alterar `stockService.ts`;
- remover funções operacionais;
- aplicar permissões granulares novas;
- dropar funções antigas;
- tratar todo o grupo de estoque de uma vez.

## Próxima etapa recomendada

### 9.14E.9 — Estoque/transferências operacionais usadas

Documentar exceções intencionais e hardening futuro para funções usadas que hoje validam principalmente `is_store_member`.

Pontos de melhoria futura:

- evoluir ajustes manuais para permissões como `stock.adjust`;
- evoluir transferências para `stock.transfer`;
- evoluir leituras para `stock.view`/`products.view` quando necessário;
- preservar compatibilidade com a UX de leitura/gestão já existente.
