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
