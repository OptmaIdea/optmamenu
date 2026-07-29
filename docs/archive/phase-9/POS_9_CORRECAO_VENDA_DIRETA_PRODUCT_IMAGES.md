# POS_9 — Correção da venda direta — imagens do produto

## Status

Correção criada, aguardando aplicação no Supabase.

## Erro observado

Ao concluir venda direta, a RPC retornou:

```txt
COALESCE types text[] and jsonb cannot be matched
```

## Causa

Na montagem do snapshot do item vendido, a RPC usava:

```sql
COALESCE(v_product.images, '[]'::jsonb)
```

No schema atual, `products.images` é `text[]`, enquanto `order_items.product_snapshot` recebe JSON.

Isso gerava conflito de tipos entre:

- `text[]`;
- `jsonb`.

## Correção

A função foi ajustada para converter explicitamente as imagens para JSON:

```sql
COALESCE(to_jsonb(v_product.images), '[]'::jsonb)
```

## Migration criada

- `supabase/migrations/20260629152000_fix_direct_sale_product_images_snapshot.sql`

## Estratégia da migration

A migration lê a definição atual da função com `pg_get_functiondef`, aplica substituição textual segura no trecho problemático e recria a função.

Depois reaplica os grants:

- `anon=false`;
- `authenticated=true`;
- `service_role=true`;
- `PUBLIC` revogado.

## Resultado esperado

Após aplicar a migration, a venda direta deve avançar além da montagem de `product_snapshot.images`.

Se houver novo erro, ele deve estar relacionado à próxima camada incremental, como:

- caixa;
- fidelidade;
- movimentação de estoque;
- constraints adicionais de pedido/item.

## Próximo passo

1. Aplicar a migration.
2. Atualizar a tela.
3. Tentar concluir venda direta novamente.
4. Enviar qualquer novo erro se aparecer.
