# POS_9 — Clientes 360º e vendas diretas — 3 Service frontend

## Status

Implementado.

Esta etapa criou o service TypeScript para encapsular a RPC administrativa de venda direta.

## Arquivo criado

- `src/services/directSalesService.ts`

## Objetivo

Evitar chamada solta da RPC `create_admin_direct_sale_order_safe` diretamente em componentes React.

O service padroniza:

- payload de entrada;
- nomes camelCase no frontend;
- conversão para parâmetros `p_*` da RPC;
- validações mínimas antes da chamada;
- tratamento de erro;
- retorno tipado para a UI.

## Service criado

Objeto exportado:

- `DirectSalesService`.

Método principal:

- `createAdminDirectSale(input)`.

## Tipos criados

- `DirectSaleSalesChannel`;
- `DirectSaleFulfillmentType`;
- `DirectSaleItemInput`;
- `CreateAdminDirectSaleInput`;
- `AdminDirectSaleOrderResult`;
- `AdminDirectSaleResult`.

## Entrada esperada

Exemplo de payload frontend:

```ts
await DirectSalesService.createAdminDirectSale({
  storeId,
  customerId,
  customerName: 'Cliente Balcão',
  customerPhone: '27999999999',
  paymentMethodCode: 'cash',
  salesChannel: 'direct',
  fulfillmentType: 'in_person',
  items: [
    {
      productId,
      quantity: 2,
      unitPrice: 10,
      discount: 0,
    },
  ],
});
```

## Conversão feita pelo service

Frontend:

```ts
productId
unitPrice
customerId
paymentMethodCode
```

RPC:

```ts
product_id
unit_price
p_customer_id
p_payment_method_code
```

## Validações mínimas no frontend/service

O service valida antes da chamada:

- `storeId` obrigatório;
- pelo menos um item;
- `productId` obrigatório por item;
- `quantity` numérica e maior que zero.

Validações de permissão, estoque, cliente, local e pagamento continuam no backend.

## Retorno esperado

Quando a venda é criada:

```ts
{
  ok: true,
  order: {
    id,
    order_code,
    status,
    subtotal,
    delivery_fee,
    total,
    sales_channel,
    fulfillment_type,
    payment_method,
    payment_method_code,
    payment_method_name,
    customer_id,
    customer_name,
    customer_phone,
    location_id,
    items_count
  },
  cashbook,
  loyalty
}
```

## Decisão técnica

Nesta etapa não foi criada tela ainda.

Motivo:

- manter sprint pequeno;
- validar primeiro o contrato frontend/backend;
- facilitar integração posterior em tela administrativa ou no detalhe do cliente.

## Próxima etapa recomendada

Abrir:

- `POS_9_CLIENTES_360_VENDAS_DIRETAS_4_UI_VENDA_DIRETA_MINIMA`

Objetivo:

- criar uma tela/fluxo mínimo de venda direta para demonstração;
- selecionar produto;
- selecionar/criar cliente rápido;
- informar pagamento;
- concluir venda;
- exibir pedido gerado;
- atualizar pedidos/cliente/estoque.

## Observação de build

Rodar localmente:

```bash
npm run build
```

Após o build, validar console e integração visual.
