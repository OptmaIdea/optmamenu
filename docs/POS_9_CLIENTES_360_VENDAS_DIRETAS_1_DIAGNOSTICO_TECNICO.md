# POS_9 — Clientes 360º e vendas diretas — 1 Diagnóstico técnico

## Status

Preparado para execução.

Esta etapa abre o diagnóstico técnico antes de implementar alterações em Clientes 360º, vendas online e vendas diretas.

## Objetivo

Confirmar o estado real de banco, RPCs, RLS, grants e permissões antes de alterar a experiência de clientes e vendas.

## Por que diagnosticar antes

Clientes e vendas online/diretas envolvem dados sensíveis e fluxo comercial central.

A implementação precisa evitar:

- duplicar estruturas já existentes;
- quebrar pedidos públicos;
- expor dados pessoais além do necessário;
- permitir edição indevida de cliente vindo da loja pública/WhatsApp;
- criar venda direta sem vínculo correto com `orders.customer_id`;
- criar permissões fora do padrão da Fase 9;
- perder histórico, fidelidade ou consentimentos.

## Diagnóstico SQL criado

Arquivo:

- `docs/sql_diagnostics/diagnose_pos9_customers_direct_sales.sql`

O script é somente leitura.

## O que o diagnóstico mapeia

### Tabelas

- `customers`;
- `customer_addresses`;
- `customer_consents`;
- `customer_segments`;
- `customer_segment_members`;
- `customer_benefit_rules`;
- `loyalty_point_rules`;
- `loyalty_transactions`;
- `promotion_campaigns`;
- `promotion_campaign_recipients`;
- `orders`;
- `order_items`;
- `store_permission_catalog`;
- `store_role_permission_templates`.

### Itens coletados

- colunas;
- tipos;
- defaults;
- nullable;
- policies RLS;
- grants de tabela;
- funções/RPCs relacionadas a clientes, pedidos, fidelidade, campanhas, segmentos e vendas;
- grants das funções para `anon`, `authenticated` e `service_role`;
- definição parcial das funções;
- permissões existentes no catálogo para clientes, pedidos, vendas, marketing e fidelidade.

## Base funcional já identificada

### Serviço

Arquivo:

- `src/services/customers360Service.ts`.

RPCs já usadas:

- `get_admin_customers_safe`;
- `get_customer_360_safe`;
- `create_admin_customer_safe`;
- `update_admin_customer_safe`.

### Origens de cliente já previstas

- `admin`;
- `public_store`;
- `whatsapp`;
- `qr_table`;
- `direct_sale`;
- `import`;
- `other`.

### Propriedade de dados já prevista

- `store_managed`;
- `customer_owned`;
- `mixed`.

### Pedidos

A tabela `orders` já possui base para vínculo com cliente:

- `customer_id`;
- `customer_name`;
- `customer_phone`;
- `customer_snapshot`;
- `sales_channel`;
- `fulfillment_type`;
- `order_code`;
- `delivery_address_snapshot`;
- `commercial_metadata`.

## Hipóteses a validar com o resultado

1. Se `customers` já possui todos os campos necessários para separar cliente público, WhatsApp, QR, venda direta e admin.
2. Se `editable_by_store` e `data_ownership` já estão persistidos e protegidos nas RPCs.
3. Se `get_customer_360_safe` retorna pedidos, pontos, endereços e consentimentos de forma suficiente.
4. Se `create_admin_customer_safe` pode ser reaproveitada para criação rápida em venda direta.
5. Se há ou não RPC própria para venda direta com cliente.
6. Se pedidos públicos sempre gravam `customer_id` e `customer_snapshot` corretamente.
7. Se as permissões `customers.*`, `orders.*`, `marketing.*`, `loyalty.*` e `sales.*` já existem no catálogo.
8. Se será necessário criar permissões novas como `customers.sensitive.view` ou `sales.direct.manage`.

## Decisões pendentes

Aguardam resultado do SQL:

- modelagem final de cliente administrado vs cliente público;
- permissões necessárias;
- fluxo de criação rápida de cliente;
- vínculo de venda direta com cliente;
- UX final da tela Clientes 360º;
- regra visual de dados sensíveis;
- necessidade de migration ou apenas frontend.

## Próximo passo

Executar:

- `docs/sql_diagnostics/diagnose_pos9_customers_direct_sales.sql`

Depois enviar o resultado para análise.

## Resultado esperado da próxima análise

Com o resultado em mãos, a próxima etapa deve produzir:

- matriz de schema atual;
- matriz de permissões necessárias;
- classificação das RPCs existentes;
- proposta de implementação da tela Clientes 360º;
- proposta de fluxo de venda direta com cliente;
- lista objetiva de migrations necessárias, se houver.
