# Fase 9.14E.7 — Comercial seguro restante

## Status

Concluída como documentação de exceções intencionais.

Esta frente continuou a auditoria incremental dos warnings `authenticated_security_definer_function_executable`, agora sobre o bloco comercial restante após a 9.14E.6.

## Base atual

Após a 9.14E.6, o diagnóstico retornou **164 funções** ainda executáveis por `authenticated`.

O bloco comercial restante no diagnóstico é composto principalmente por funções administrativas ativas, dashboards e operações `*_safe`.

## Decisão da rodada

Não criar migration nesta etapa.

Motivo:

- as funções comerciais restantes possuem uso direto no frontend/admin ou são leituras administrativas necessárias;
- em geral validam `auth.uid()` e vínculo com loja;
- algumas já validam permissão granular;
- remover `authenticated` agora quebraria fluxos ativos.

## Funções com uso direto confirmado

### Clientes 360º

Arquivos/serviços relacionados:

- `src/services/customers360Service.ts`;
- `src/pages/private/admin/commercial/customers/Customers.tsx`.

Funções:

- `create_admin_customer_safe`;
- `get_admin_customers_safe`;
- `update_admin_customer_safe`;
- `get_customer_360_safe`.

Classificação:

- manter `authenticated`;
- exceção intencional;
- funções possuem validação de loja e permissões de cliente (`customers.view`/`customers.manage`) em pontos críticos.

### Fidelidade / benefícios

Arquivos/serviços relacionados:

- `src/pages/private/admin/commercial/loyalty/LoyaltyConfig.tsx`;
- `src/services/loyaltyAdvancedService.ts`.

Funções:

- `get_admin_loyalty_safe`;
- `get_loyalty_advanced_settings_safe`;
- `upsert_customer_benefit_rule_safe`;
- `upsert_loyalty_point_rule_safe`.

Classificação:

- manter `authenticated`;
- exceção intencional;
- recomendação futura: evoluir validação de algumas funções de `is_store_member` para permissões granulares de fidelidade/benefícios quando o catálogo de permissões estiver consolidado.

### Segmentos / marketing

Arquivo/serviço relacionado:

- `src/services/marketingCenterService.ts`.

Função:

- `upsert_customer_segment_safe`.

Classificação:

- manter `authenticated`;
- exceção intencional;
- recomendação futura: validar permissão granular de marketing/segmentos quando a árvore de permissões desse módulo for consolidada.

### Dashboard e monitor de pedidos

Arquivos relacionados:

- `src/pages/private/admin/dashboard/Dashboard.tsx`;
- `src/hooks/useOrderMonitor.ts`.

Funções:

- `get_dashboard_orders_summary`;
- `get_dashboard_recent_orders`;
- `get_order_monitor_pending_orders`.

Classificação:

- manter `authenticated`;
- exceção intencional;
- funções de leitura administrativa com validação de vínculo com loja;
- recomendação futura: avaliar permissão granular de dashboard/pedidos se necessário.

### Operações administrativas de pedido

Funções preservadas:

- `admin_cancel_public_order_safe`;
- `admin_complete_public_order_safe`;
- `confirm_order_payment`;
- `extend_reservation`.

Classificação:

- manter `authenticated`;
- usadas diretamente no admin;
- `extend_reservation` já foi endurecida na 9.14E.3;
- `admin_cancel_public_order_safe`, `admin_complete_public_order_safe` e `confirm_order_payment` validam pedido, loja e vínculo antes de executar alteração.

## Pontos de melhoria futura

A rodada identificou funções que hoje usam `is_store_member` como gate suficiente, mas que poderiam evoluir para permissões granulares:

- fidelidade avançada;
- benefícios por cliente/nível/tag;
- segmentos/marketing;
- dashboard comercial/pedidos;
- monitor de pedidos.

Essa evolução deve ser feita depois, respeitando a regra do projeto:

1. `store_permission_catalog`;
2. `store_role_permission_templates`;
3. `store_permission_versions`;
4. `PERMISSION_GROUP_DEFINITIONS`;
5. `ROLE_PERMISSION_TREE`;
6. UI/rotas consumidoras.

## Resultado esperado no Advisor

A contagem não deve cair nesta etapa.

A 9.14E.7 não remove grants; apenas documenta o bloco comercial restante como exceção intencional e preserva fluxos ativos.

## Próxima etapa recomendada

### 9.14E.8 — Estoque e transferências

Continuar a auditoria por subgrupos pequenos, agora no bloco `inventory_stock_transfer`.

Diretriz:

- buscar uso direto no frontend para cada função;
- preservar funções operacionais usadas;
- revogar `authenticated` apenas de auxiliares internas/legadas sem uso direto;
- aplicar hardening pontual quando uma função usada não validar loja/local/permissão adequadamente.

Candidatas para primeira triagem:

- `adjust_stock_to_physical_count`;
- `create_manual_stock_adjustment`;
- `cancel_stock_transfer`;
- `create_stock_transfer_draft_batch`;
- `create_stock_transfer_draft_from_suggestion`;
- funções de leitura `get_inventory_*`, `get_stock_transfer_*`, `get_product_stock_*`.
