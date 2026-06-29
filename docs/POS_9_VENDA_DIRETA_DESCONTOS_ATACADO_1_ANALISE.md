# POS_9 — Venda direta, descontos e atacado — 1 Análise

## Status

Diagnóstico analisado.

O usuário executou o diagnóstico com remoção manual das ordenações por `updated_at` em `products` e `categories`, pois essas colunas não existem no schema atual dessas tabelas.

O SQL diagnóstico foi corrigido para usar ordenação por `name`.

Commit da correção:

- `f8b81dc25788dad62b95b259bc4cb6941265b5da`

## Resultado recebido

O arquivo enviado retornou:

- 710 linhas;
- 258 colunas de tabelas;
- 212 constraints;
- 67 índices;
- 102 grants de função;
- 34 definições de funções;
- 13 permissões relevantes no catálogo;
- 20 amostras de produtos;
- 4 amostras de categorias.

## Estrutura de produtos

A tabela `products` já possui campos relevantes para preço e regra comercial:

- `price`;
- `use_category_pricing`;
- `price_logic_type`;
- `price_rules`;
- `category_id`.

Pontos importantes:

- `price` é obrigatório;
- `price_rules` já existe como `jsonb` com default `[]`;
- `use_category_pricing` existe;
- nas amostras analisadas, os produtos estão com `price_rules=[]`;
- vários produtos estão com `use_category_pricing=true`, indicando que a regra da categoria pode ser reaproveitada.

## Estrutura de categorias

A tabela `categories` já possui campos comerciais relevantes:

- `price_logic_type`;
- `price_rules`;
- `pricing_strategy`;
- `loyalty_eligible`;
- `loyalty_multiplier`.

Pontos importantes:

- `price_rules` existe como `jsonb` com default `[]`;
- `pricing_strategy` existe como `jsonb`;
- as amostras mostram categorias com regras por quantidade no formato aproximado:

```json
[
  { "min": 0, "price": 3.75 },
  { "min": 8, "price": 3.25 },
  { "min": 15, "price": 2.8 },
  { "min": 25, "price": 2.6 }
]
```

## Estrutura de itens de pedido

A tabela `order_items` já suporta desconto e rastreio comercial:

- `quantity`;
- `unit_price`;
- `discount`;
- `product_snapshot`;
- `commercial_metadata`.

Decisão:

- não é necessário criar coluna para desconto manual agora;
- `discount` já suporta desconto por item;
- `commercial_metadata` deve guardar a regra aplicada e o motivo do desconto;
- `product_snapshot` deve guardar preço base/original quando aplicável.

## Estrutura de pedidos

A tabela `orders` já suporta metadados comerciais:

- `subtotal`;
- `total`;
- `commercial_metadata`;
- `customer_snapshot`;
- `sales_channel`;
- `fulfillment_type`;
- `delivery_metadata`.

Decisão:

- subtotal bruto, desconto total e total final podem ser guardados inicialmente em `orders.commercial_metadata`;
- não criar colunas explícitas agora para `gross_total` ou `discount_total`;
- criar colunas depois somente se relatórios/BI exigirem performance ou filtros diretos.

## Cliente atacado

A tabela `customers` ainda não possui coluna explícita do tipo:

- `customer_type`;
- `is_wholesale`;
- `price_profile_id`.

Mas possui alternativas iniciais:

- `tags`;
- `customer_metadata`;
- `source`;
- `data_ownership`;
- `editable_by_store`.

Decisão inicial:

- não criar coluna de atacado agora;
- para primeira versão, identificar cliente atacado por `tags` ou `customer_metadata`;
- preferir `tags` para operação simples, por exemplo `atacado`;
- estudar `customer_segments` como camada mais robusta em etapa posterior.

## Benefícios de cliente

A tabela `customer_benefit_rules` já possui:

- `benefit_type`;
- `target_type`;
- `target_tier_id`;
- `target_customer_id`;
- `target_tag`;
- `discount_percent`;
- `discount_amount`;
- `minimum_order_value`;
- `conditions`;
- `metadata`.

Constraints confirmam tipos de benefício:

- `discount_percent`;
- `discount_amount`;
- `free_delivery`;
- `bonus_points`;
- `gift`;
- `voucher`;
- `custom`.

E tipos de alvo:

- `all`;
- `tier`;
- `customer`;
- `tag`;
- `campaign`.

Decisão:

- `customer_benefit_rules` pode ser reaproveitada para benefícios/descontos de cliente;
- porém, ela não deve virar tabela principal de regra de preço por quantidade de produto/categoria;
- usar para benefícios transversais de cliente, como desconto para cliente específico, tag ou campanha.

## Segmentos

`customer_segments` suporta:

- `manual`;
- `tag`;
- `loyalty_tier`;
- `behavior`;
- `purchase_history`;
- `campaign`;
- `custom`.

Decisão:

- segmentos são bons para agrupar clientes de atacado no futuro;
- para primeira versão, usar tag `atacado` é mais simples;
- depois, segmento `clientes_atacado` pode ser criado e sincronizado por regra/tag.

## Fidelidade

`loyalty_point_rules` suporta regras por:

- moeda;
- pontos fixos;
- multiplicador;
- multiplicador de categoria;
- multiplicador por canal;
- multiplicador por nível;
- bônus.

Decisão:

- fidelidade deve continuar separada de preço/desconto;
- desconto de atacado reduz preço/total;
- fidelidade calcula pontos sobre o total final, como já ocorre na função avançada;
- não misturar regra de atacado com regra de pontuação.

## Permissões

O catálogo retornou permissões suficientes para a primeira entrega:

- `orders.view`;
- `orders.manage`;
- `orders.cancel`;
- `customers.view`;
- `customers.manage`;
- `products.view`;
- `products.manage`;
- `categories.view`;
- `categories.manage`;
- `loyalty.view`;
- `loyalty.manage`;
- `marketing.view`;
- `marketing.manage`.

Decisão:

- não criar permissão nova para desconto manual agora;
- usar `orders.manage` para conceder desconto no PDV básico;
- avaliar futuramente `orders.discount.manage` se houver risco operacional maior.

## Decisão técnica principal

Não criar schema novo agora.

Motivo:

- produtos e categorias já têm `price_rules`;
- produtos já têm `use_category_pricing`;
- itens já têm `discount`;
- itens e pedidos já têm `commercial_metadata`;
- clientes já têm `tags` e `customer_metadata`;
- benefícios já cobrem descontos por cliente/tag/campanha.

## Estratégia recomendada — Etapa 2

Criar uma função de cálculo de preço para venda direta.

Nome sugerido:

- `calculate_direct_sale_item_price_safe` ou helper interno equivalente.

Ela deve calcular:

- preço base do produto;
- regra de preço por quantidade do produto, se existir;
- regra de preço por quantidade da categoria, se `use_category_pricing=true`;
- desconto manual informado;
- desconto/benefício de cliente se aplicável;
- preço aplicado;
- desconto total;
- razão/regra aplicada.

## Estratégia recomendada — Primeira implementação funcional

### 1. PDV simples

Implementar desconto manual por item na UI e no service.

Payload do item:

```json
{
  "product_id": "...",
  "quantity": 5,
  "unit_price": 3.75,
  "discount": 1.25,
  "discount_reason": "desconto_manual"
}
```

Backend:

- já aceita `discount`;
- precisa apenas guardar melhor `discount_reason` e totais em `commercial_metadata`.

### 2. Regra por quantidade/categoria

Aproveitar `categories.price_rules` como fonte principal quando o produto usar categoria.

Regra:

- selecionar a maior faixa cujo `min <= quantity`;
- aplicar o `price` da faixa;
- registrar em `order_items.commercial_metadata`:
  - `pricing_source='category_price_rules'`;
  - `price_rule_min`;
  - `original_unit_price`;
  - `applied_unit_price`;
  - `automatic_discount_total`.

### 3. Produto com regra própria

Se `products.price_rules` não estiver vazio, ele deve ter prioridade sobre a categoria.

Ordem sugerida:

1. regra do produto;
2. regra da categoria se `use_category_pricing=true`;
3. preço padrão do produto.

### 4. Cliente atacado

Primeira versão:

- cliente atacado identificado por tag `atacado`;
- a regra de atacado usa as mesmas regras de quantidade da categoria/produto;
- no futuro, criar segmento dedicado ou perfil de preço.

## O que não fazer agora

- Não criar tabela nova de preço por atacado ainda.
- Não alterar catálogo de permissões agora.
- Não misturar fidelidade com preço.
- Não criar colunas `gross_total` e `discount_total` ainda.
- Não criar fluxo final de PDV popup antes de estabilizar cálculo.

## Próxima etapa recomendada

Abrir:

- `POS_9_VENDA_DIRETA_DESCONTOS_ATACADO_2_DESCONTO_MANUAL_E_PRICE_RULES`

Objetivo:

- ajustar RPC `create_admin_direct_sale_order_safe` para registrar descontos com mais metadados;
- calcular/aplicar preço por quantidade com `price_rules` de produto/categoria;
- atualizar service para enviar/receber desconto e metadados;
- atualizar UI mínima para mostrar desconto manual, subtotal bruto, desconto e total final;
- validar sem schema novo.
