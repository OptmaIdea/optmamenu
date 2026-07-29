# Fase 9.14E.9 — Estoque e transferências: exceções operacionais

## Status

Concluída como documentação de exceções intencionais.

Esta frente continuou a auditoria incremental dos warnings `authenticated_security_definer_function_executable`, tratando o bloco de estoque e transferências que permaneceu após a 9.14E.8.

## Base atual

Após a 9.14E.8, o diagnóstico retornou **163 funções** ainda executáveis por `authenticated`.

O grupo `inventory_stock_transfer` permaneceu com **28 funções**.

## Decisão da rodada

Não criar migration nesta etapa.

Motivo:

- as funções restantes do bloco são usadas pelo frontend/admin;
- várias aparecem em `stockService.ts`, hooks de inventário, tela de transferências, ciclo de vida do produto e configurações de estoque;
- em geral validam escopo de loja/local/produto por `is_store_member`;
- algumas já usam permissões granulares `stock.view`, `stock.adjust`, `stock.transfer` e `products.view`;
- revogar `authenticated` agora quebraria fluxos ativos.

## Funções operacionais preservadas

### Ajustes e contagem física

Funções:

- `adjust_stock_to_physical_count(p_product_id uuid, p_location_id uuid, p_counted_quantity numeric, p_reason text, p_notes text)`;
- `create_manual_stock_adjustment(p_product_id uuid, p_location_id uuid, p_adjustment_kind text, p_quantity numeric, p_reason text, p_notes text)`.

Uso:

- `src/services/stockService.ts`.

Classificação:

- manter `authenticated`;
- exceção intencional;
- valida produto, loja e local ativo;
- valida vínculo com loja por `is_store_member`;
- recomendação futura: evoluir para permissão granular `stock.adjust` antes de permitir ajustes sensíveis.

---

### Transferências — criação/cancelamento/preenchimento

Funções:

- `cancel_stock_transfer(p_transfer_id uuid, p_cancel_reason text)`;
- `create_stock_transfer_draft_batch(p_source_location_id uuid, p_destination_location_id uuid, p_items jsonb, p_notes text)`;
- `create_stock_transfer_draft_from_suggestion(p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid, p_quantity numeric, p_notes text)`;
- `get_transfer_prefill_preview(p_product_id uuid, p_source_location_id uuid, p_destination_location_id uuid)`.

Uso:

- `src/services/stockService.ts`;
- `src/pages/private/admin/products/inventory/TransfersPage.tsx`.

Classificação:

- manter `authenticated`;
- exceção intencional;
- valida produto/local/loja;
- valida origem/destino pertencentes à mesma loja;
- recomendação futura: evoluir para permissão granular `stock.transfer`.

---

### Leitura de estoque e gestão de inventário

Funções:

- `get_inventory_management_products(p_store_id uuid, p_recommended_action text, p_limit integer)`;
- `get_inventory_position_by_store(p_store_id uuid)`;
- `get_inventory_transit_by_store(p_store_id uuid)`;
- `get_product_stock_management(p_product_id uuid)`;
- `get_product_stock_rules_safe(p_store_id uuid, p_product_id uuid)`;
- `list_product_stock_settings_safe(p_store_id uuid, p_search text, p_limit integer)`.

Uso:

- `src/services/stockService.ts`;
- `src/services/stockSettingsService.ts`;
- hooks de inventário e páginas de produto/estoque.

Classificação:

- manter `authenticated`;
- exceção intencional;
- funções de leitura/gestão operacional;
- recomendação futura: garantir `stock.view`/`products.view` em todas as leituras que hoje usam apenas `is_store_member`.

---

### Vida do produto, movimentos e divergências

Funções:

- `get_product_inventory_lifecycle(p_store_id uuid, p_product_id uuid)`;
- `get_product_stock_movements(p_store_id uuid, p_product_id uuid)`;
- `get_product_transfer_divergences(p_product_id uuid)`;
- `get_stock_movements_safe(p_store_id uuid, p_limit integer, p_offset integer)`.

Uso:

- `src/services/stockService.ts`;
- serviços/hook de vida do produto;
- página de movimentações.

Classificação:

- manter `authenticated`;
- exceção intencional;
- `get_product_stock_movements` e `get_stock_movements_safe` já usam permissões granulares como `stock.view`, `stock.adjust`, `stock.transfer` e `products.view`;
- recomendação futura: alinhar funções de ciclo de vida/divergência ao mesmo padrão granular.

---

### Listagem e detalhe de transferências

Funções:

- `get_stock_transfer_detail(p_transfer_id uuid)`;
- `get_stock_transfer_suggestions_by_store(p_store_id uuid)`;
- `get_stock_transfers_by_store(p_store_id uuid)`.

Uso:

- `src/services/stockService.ts`;
- hooks/telas de transferências.

Classificação:

- manter `authenticated`;
- exceção intencional;
- funções de leitura operacional ativa;
- recomendação futura: aplicar `stock.transfer` ou `stock.view` conforme ação/tela.

## Função já removida na rodada anterior

A 9.14E.8 removeu do acesso `authenticated`:

- `get_inventory_criticality_summary(p_store_id uuid)`.

Motivo:

- sem uso operacional atual identificado;
- substituída na prática por funções de inventário mais completas.

## Hardening futuro recomendado

A evolução ideal do bloco de estoque/transferência é trocar gates genéricos por permissões granulares, respeitando o padrão do projeto.

### `stock.view`

Aplicável a:

- leituras de posição de estoque;
- vida do produto;
- movimentos;
- regras de estoque;
- trânsito;
- detalhes/listagens.

### `stock.adjust`

Aplicável a:

- ajuste manual;
- contagem física;
- baixas por avaria/perda/vencimento.

### `stock.transfer`

Aplicável a:

- criar rascunhos de transferência;
- cancelar transferências;
- sugestões e pré-visualizações operacionais de transferência;
- envio/recebimento/divergências quando auditadas.

### `products.view`

Aplicável como permissão alternativa para:

- vida do produto;
- leituras de produto com saldo;
- histórico de movimentações associado ao produto.

## Regras para evolução futura

Toda permissão nova ou ampliação deve passar por:

1. `store_permission_catalog`;
2. `store_role_permission_templates`;
3. `store_permission_versions`;
4. `PERMISSION_GROUP_DEFINITIONS`;
5. `ROLE_PERMISSION_TREE`;
6. UI/rotas consumidoras;
7. documentação.

## Resultado esperado no Advisor

A contagem não deve cair nesta etapa.

A 9.14E.9 não remove grants. Ela documenta o bloco operacional restante como exceção intencional e prepara os critérios de hardening futuro.

## Próxima etapa recomendada

### 9.14E.10 — Compras, fornecedores e cotações

Continuar a auditoria por subgrupos pequenos no grupo `purchases_suppliers_quotations`, com o mesmo critério:

- buscar uso direto no frontend;
- preservar funções operacionais usadas;
- revogar `authenticated` apenas de auxiliares internas/legadas sem uso direto;
- documentar hardening futuro para funções usadas com gate genérico.
