# Fase 10.2B — Estoque online autoritativo por local

Data: 01/08/2026

## Objetivo

Fazer a loja pública calcular disponibilidade somente a partir do local de estoque vinculado à slug, sem usar saldo global ou saldo de outras unidades.

## Configuração da slug

A configuração existente em `Configurações → Pedido Online → Loja pública e catálogo → Local de venda pública` usa `stores.public_sales_location_id`.

Para a Gelinhares, a slug `gelinharessjn` está vinculada ao local:

- nome: `Loja SJN`;
- código: `LOJA-SJN`;
- id: `b5707f49-bcbe-465f-98fa-b9ad9c426859`.

O catálogo público passa a falhar de forma segura quando a loja está ativa sem local de venda pública configurado.

## Fórmula de disponibilidade

```text
disponível_local = on_hand_local - reserved_local
saldo_após_reserva = max(disponível_local - reserva_local, 0)
disponível_online = min(saldo_após_reserva, limite_online)
```

Quando não existe limite online, o saldo após a reserva é usado integralmente.

## Configurações padrão da loja

As seguintes chaves ficam em `store_settings.order_settings`:

- `online_stock_local_reserve_default`: quantidade mínima preservada para venda presencial;
- `online_stock_limit_default`: teto opcional de unidades expostas online;
- `online_stock_low_threshold`: limite para mostrar “Poucas unidades”;
- `online_stock_show_exact`: permite ou não revelar quantidade exata;
- `online_stock_publish_products_by_default`: define publicação padrão dos produtos.

Valores iniciais aplicados à Gelinhares:

```json
{
  "online_stock_local_reserve_default": 0,
  "online_stock_limit_default": null,
  "online_stock_low_threshold": 5,
  "online_stock_show_exact": false,
  "online_stock_publish_products_by_default": true
}
```

## Exceções por produto

Foi criada a tabela `storefront_product_settings` com:

- `published`;
- `local_reserve`;
- `online_limit`;
- `low_stock_threshold`;
- `show_exact_stock`.

Quando uma exceção não existe, o produto herda a configuração padrão da loja.

## Contrato público

`get_public_catalog_by_slug` agora retorna em cada produto:

```json
{
  "stock_quantity": 0,
  "public_availability": {
    "status": "unavailable",
    "available_online": 0,
    "display_mode": "low_stock_only",
    "message": "Indisponível no momento"
  }
}
```

Estados possíveis:

- `available`;
- `low_stock`;
- `unavailable`.

## Validação realizada

O produto `Abacaxi`, que possui saldo global mas saldo `0` em `Loja SJN`, passou a retornar:

- `stock_quantity: 0`;
- `status: unavailable`;
- `available_online: 0`.

Produtos com até cinco unidades online passaram a retornar `low_stock` e a mensagem “Poucas unidades”.

## Segurança

- o cálculo é feito no backend;
- o frontend não soma estoques de locais diferentes;
- reservas ativas do local reduzem o disponível;
- o resultado nunca fica negativo;
- a tabela de exceções usa RLS por membro da loja.

## Migration aplicada

Migration Supabase:

```text
storefront_inventory_location_and_online_availability
```

A migration foi aplicada ao projeto `lgkkfmqzaorrutuoqeax`.

## Próxima evolução administrativa

A tela de Pedido Online já possui o seletor do local vinculado. A próxima camada visual deve expor no mesmo módulo os campos padrão de reserva local, limite online, poucas unidades e exibição de quantidade, além de uma tela própria para exceções por produto.