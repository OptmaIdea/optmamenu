# Fase 10.2B — Publicação e regras de estoque por produto

Data: 01/08/2026

## Objetivo

Permitir que o lojista controle, produto a produto, o que será publicado na slug e quais itens terão regras próprias de reserva presencial, limite online e aviso de poucas unidades.

## Local

`/admin/settings` → `Pedido Online` → `Estoque da loja pública` → `Produtos publicados e exceções`

## Funcionalidades

- busca por produto ou categoria;
- filtro para mostrar somente produtos publicados;
- publicação ou ocultação individual na slug;
- leitura do saldo físico, reservado e disponível online no local vinculado;
- reserva mínima presencial específica;
- teto online específico;
- limite específico de poucas unidades;
- escolha individual sobre exibir a quantidade exata;
- prévia do estado público: disponível, poucas unidades ou indisponível;
- restauração das regras gerais da loja.

## Herança

Campos individuais em branco herdam as configurações gerais da loja:

- `online_stock_local_reserve_default`;
- `online_stock_limit_default`;
- `online_stock_low_threshold`;
- `online_stock_show_exact`;
- `online_stock_publish_products_by_default`.

## Persistência

As exceções são gravadas em `public.storefront_product_settings`, com unicidade por:

```text
(store_id, product_id)
```

A remoção da exceção faz o produto voltar a herdar integralmente as regras gerais.

## Fonte de saldo

A grade administrativa consulta `inventory_location_balances` somente para o local vinculado em `stores.public_sales_location_id`.

O saldo mostrado na administração é:

```text
disponível local = físico local - reservado local
```

A prévia online aplica a reserva presencial e o teto configurados. A decisão pública final continua sendo feita pelo RPC `get_public_catalog_by_slug`.

## Arquivos

- `src/services/onlineStockProductSettingsService.ts`
- `src/pages/private/admin/settings/onlineOrders/OnlineStockPolicySection.tsx`

## Segurança e consistência

- a grade é administrativa e depende das políticas RLS existentes;
- nenhum saldo interno adicional é exposto na rota pública;
- o frontend oferece apenas prévia operacional;
- o backend permanece como fonte autoritativa do catálogo público.
