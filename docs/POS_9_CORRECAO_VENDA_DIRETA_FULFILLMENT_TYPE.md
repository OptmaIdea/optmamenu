# POS_9 — Correção da venda direta — fulfillment_type

## Status

Correção criada, aguardando aplicação no Supabase.

## Erro observado

Ao concluir venda direta, a RPC retornou:

```txt
new row for relation "orders" violates check constraint "orders_fulfillment_type_check"
```

## Causa

A tela/service enviava:

```txt
fulfillmentType = in_person
```

A RPC tentava gravar esse valor em:

```sql
orders.fulfillment_type
```

mas o check constraint atual da tabela `orders` não aceita `in_person`.

## Decisão

Não alterar o check constraint agora.

Para manter compatibilidade com o modelo atual, a RPC passa a gravar:

```txt
orders.fulfillment_type = pickup
```

quando receber `in_person`.

A informação de venda direta/presencial continua preservada em:

- `orders.sales_channel = direct`;
- `orders.delivery_metadata.direct_sale = true`;
- `orders.delivery_metadata.direct_sale_fulfillment = in_person`;
- `orders.commercial_metadata.direct_sale = true`;
- `orders.commercial_metadata.direct_sale_fulfillment = in_person`;
- `stock_movements.metadata.direct_sale_fulfillment = in_person`.

## Migration criada

- `supabase/migrations/20260629151500_fix_direct_sale_fulfillment_type.sql`

## Resultado esperado

Após aplicar a migration, a venda direta deve avançar além da constraint `orders_fulfillment_type_check`.

Se houver novo erro, ele deve estar relacionado à próxima camada incremental do fluxo, como:

- estoque/local;
- order_items;
- stock_movements;
- caixa;
- fidelidade.

## Próximo passo

1. Aplicar a migration.
2. Atualizar a tela.
3. Tentar concluir venda direta novamente.
4. Enviar qualquer novo erro se aparecer.
