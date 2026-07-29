# POS_9 — Venda direta, descontos e atacado — 2 Desconto manual e price rules

## Status

Implementado para build/teste local e validação Supabase.

## Objetivo

Evoluir a venda direta mínima para suportar:

- desconto manual por item;
- cálculo visual de preço por quantidade;
- uso inicial de `products.price_rules`;
- uso inicial de `categories.price_rules` quando o produto usa precificação por categoria;
- destaque de subtotal bruto, desconto por regra, desconto manual e total final;
- persistência de metadados comerciais no pedido e nos itens.

## Estratégia

Não foi criado schema novo.

A implementação reaproveita:

- `products.price`;
- `products.price_rules`;
- `products.use_category_pricing`;
- `categories.price_rules`;
- `order_items.discount`;
- `order_items.commercial_metadata`;
- `orders.commercial_metadata`.

## Backend

### Migration criada

- `supabase/migrations/20260630104500_enhance_direct_sale_discount_metadata.sql`

### O que mudou na RPC

A função `create_admin_direct_sale_order_safe(...)` passou a aceitar e persistir metadados por item:

- `original_unit_price`;
- `unit_price`;
- `discount`;
- `discount_reason`;
- `pricing_source`;
- `price_rule`;
- `metadata`.

### Metadados de item

Agora `order_items.commercial_metadata` registra:

- `gross_total`;
- `line_total`;
- `original_unit_price`;
- `applied_unit_price`;
- `automatic_discount_total`;
- `manual_discount_total`;
- `discount_reason`;
- `pricing_source`;
- `price_rule`;
- `location_id`.

### Metadados do pedido

Agora `orders.commercial_metadata` registra:

- `gross_subtotal`;
- `discount_total`;
- `net_subtotal`;
- `total_final`;
- `discounts_enabled=true`.

O campo `orders.metadata` também recebe resumo de totais para rastreio.

## Service frontend

### Arquivo alterado

- `src/services/directSalesService.ts`

### Novos campos no item

`DirectSaleItemInput` recebeu:

- `originalUnitPrice`;
- `discountReason`;
- `pricingSource`;
- `priceRule`;
- `metadata`.

### Retorno enriquecido

`AdminDirectSaleOrderResult` agora aceita:

- `gross_subtotal`;
- `discount_total`.

## UI mínima

### Arquivo alterado

- `src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`

### Produto

A tela passou a carregar:

- `price`;
- `category_id`;
- `use_category_pricing`;
- `price_rules`;
- `categories(name, price_rules)`.

### Regra de preço

A tela aplica a seguinte ordem:

1. `products.price_rules`, se houver;
2. `categories.price_rules`, se `use_category_pricing=true`;
3. `products.price`.

A regra selecionada é a maior faixa cujo:

```txt
min <= quantity
```

### Carrinho

Cada item agora guarda:

- preço original;
- preço aplicado;
- desconto manual;
- fonte de preço;
- regra aplicada.

### Resumo

A lateral passou a mostrar:

- subtotal bruto;
- desconto por regra;
- desconto manual;
- total final.

## Decisões

### Sem schema novo

A estrutura atual é suficiente para esta primeira versão.

### Sem permissão nova

A permissão usada continua sendo:

- `orders.manage`.

Uma permissão futura como `orders.discount.manage` só deve ser avaliada depois, se o desconto manual virar risco operacional relevante.

### Atacado ainda não recebeu fluxo próprio

Esta etapa prepara a base de preço por quantidade.

O cliente de atacado ainda deve ser tratado depois, provavelmente por:

- tag `atacado` no cliente;
- segmento dedicado;
- ou perfil de preço futuro.

## Pontos importantes para validação

### Supabase

Aplicar a migration:

- `supabase/migrations/20260630104500_enhance_direct_sale_discount_metadata.sql`

### Local

Rodar:

```bash
npm run build
```

### Navegador

Testar:

- `/admin/direct-sales`

Cenários:

1. produto sem regra e sem desconto manual;
2. produto com regra por quantidade;
3. produto com desconto manual;
4. produto com regra por quantidade + desconto manual;
5. verificar pedido gerado;
6. verificar `order_items.discount`;
7. verificar `order_items.commercial_metadata`;
8. verificar dashboard comercial.

## Próximos passos prováveis

- selector de cliente existente;
- marcação simples de cliente atacado por tag;
- regra visual para atacado;
- dropdown de forma de pagamento;
- dropdown de local de estoque;
- botão no sidebar;
- experiência PDV/popup mais refinada;
- permissão granular de desconto, se necessário.
