# RLS e segurança

## Princípios
- isolamento por store_id
- acesso autenticado
- evitar SECURITY DEFINER sem necessidade
- privilegiar leitura controlada via views seguras ou funções específicas

## Tabelas críticas
- products
- stock_locations
- inventory_location_balances
- stock_movements
- stock_transfers
- stock_transfer_items
- purchase_documents
- suppliers

## O que documentar depois
- policies por tabela
- helpers de store context
- funções usadas em writes sensíveis
- histórico de correções do linter Supabase

## Grupos de atacado — 24/07/2026

`pricing_groups` possui RLS ativa e isolamento por `store_id`.

Leitura autenticada:

- proprietário;
- `categories.view/manage`;
- `products.view/manage`.

Escrita autenticada:

- proprietário;
- `categories.manage`;
- `products.manage`.

`anon` não acessa a tabela, não executa `save_pricing_group` e não executa
diretamente `calculate_store_cart_pricing`. A slug recebe somente o recorte
público de grupos ativos por `get_public_catalog_by_slug`.

As funções `SECURITY DEFINER` desta frente usam `search_path` controlado,
validam autenticação/loja/permissão e têm privilégios explícitos.
