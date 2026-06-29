# POS_9 — Venda direta, descontos e atacado — 1 Diagnóstico

## Status

Preparado para execução.

Esta etapa abre o diagnóstico técnico/funcional para desconto manual, preço diferenciado e venda direta para cliente de atacado.

## Contexto

A venda direta mínima já foi validada:

- salva venda;
- gera pedido;
- permanece na tela `/admin/direct-sales`;
- alimenta o dashboard comercial;
- console limpo.

Agora existem dois cenários funcionais:

1. PDV / venda balcão;
2. venda direta para cliente de atacado.

## Objetivo

Mapear a estrutura atual antes de implementar regras comerciais.

A intenção é decidir com segurança se descontos/atacado podem usar campos existentes ou se precisam de nova modelagem.

## SQL diagnóstico criado

Arquivo:

- `docs/sql_diagnostics/diagnose_pos9_direct_sales_discounts_wholesale.sql`

O script é somente leitura.

## O que será diagnosticado

### Tabelas

- `products`;
- `categories`;
- `customers`;
- `orders`;
- `order_items`;
- `customer_benefit_rules`;
- `loyalty_point_rules`;
- `loyalty_transactions`;
- `customer_segments`;
- `customer_segment_members`;
- `promotion_campaigns`;
- `promotion_campaign_recipients`;
- `store_settings`;
- `store_permission_catalog`.

### Itens coletados

- colunas;
- tipos;
- defaults;
- constraints;
- índices;
- funções relacionadas a preço/desconto/benefício/fidelidade/segmentos/clientes/venda direta;
- grants das funções;
- permissões relevantes;
- amostra de campos comerciais de produtos;
- amostra de campos comerciais de categorias.

## Questões que o diagnóstico deve responder

### Produtos

- Existe campo de preço promocional?
- Existe campo de preço de atacado?
- Existe configuração por quantidade?
- Existe metadata comercial reaproveitável?
- `products.price` é o único preço base?

### Categorias

- Categoria tem regra comercial própria?
- Categoria tem metadata que permita guardar desconto por quantidade?
- Existem regras já cadastradas por categoria?

### Clientes

- Existe marcação de cliente atacado?
- Tags podem identificar atacado inicialmente?
- `customer_metadata` pode guardar perfil comercial?
- Segmentos podem representar clientes de atacado?

### Pedidos e itens

- `order_items.discount` é suficiente para desconto manual inicial?
- `order_items.commercial_metadata` pode guardar regra aplicada?
- `orders.commercial_metadata` pode guardar totais bruto/desconto/final?
- É necessário criar colunas explícitas para subtotal bruto e desconto total?

### Benefícios/fidelidade/marketing

- `customer_benefit_rules` pode ser reaproveitada para desconto comercial?
- Regras de fidelidade são separadas de preço ou podem conflitar?
- Segmentos/campanhas podem servir só para seleção, não para preço?

## Decisões pendentes

Aguardam resultado do SQL:

- desconto manual apenas na UI/RPC atual;
- desconto automático por produto;
- desconto automático por categoria;
- regra de atacado por cliente;
- regra de atacado por segmento;
- regra de atacado por quantidade;
- necessidade de tabela nova de regras comerciais;
- necessidade de permissão nova para conceder desconto manual.

## Diretriz inicial recomendada

Não misturar PDV simples com atacado avançado.

### PDV simples

Primeira evolução provável:

- adicionar desconto manual por item;
- enviar `discount` no payload;
- exibir subtotal bruto, desconto e total;
- guardar motivo do desconto em `commercial_metadata`.

### Atacado

Evolução separada:

- identificar cliente atacado;
- calcular preço/regra antes de fechar item;
- destacar regra aplicada;
- preservar preço original e preço aplicado;
- armazenar regra em `order_items.commercial_metadata`.

## Próximo passo

Executar:

- `docs/sql_diagnostics/diagnose_pos9_direct_sales_discounts_wholesale.sql`

Depois enviar o resultado para análise.

## Resultado esperado da próxima análise

Com o resultado em mãos, produzir:

- matriz de campos comerciais atuais;
- decisão se precisa migration;
- proposta de desconto manual no PDV;
- proposta de regra inicial de atacado;
- proposta de payload para `create_admin_direct_sale_order_safe`;
- próximos refinamentos de UI.
