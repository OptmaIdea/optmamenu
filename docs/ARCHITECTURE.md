# Arquitetura do OptmaMenu

## Visão geral
O sistema está organizado em uma store com múltiplos locais de estoque, permitindo operação consolidada e também controle por ponto operacional.

## Núcleos principais
- Catálogo: produtos, categorias, promoções
- Estoque: saldos, movimentações, reservas, posições por local
- Transferências: origem, destino, envio, recebimento, divergência
- Compras: documentos, itens, fornecedores, histórico de custo
- Operação comercial: pedidos, itens, clientes
- Fidelidade: programas, recompensas, vouchers, transações

## Multiestoque
### Conceito
A operação atual usa uma única store com múltiplos locais internos.

### Tabelas centrais
- stock_locations
- inventory_location_balances
- stock_movements
- stock_transfers
- stock_transfer_items

## Visões do sistema
### Visão consolidada
Usada em Produtos e indicadores gerenciais.

### Visão operacional por local
Usada em Estoque por local, Transferências e Vida do produto.

## Fluxos críticos
### Compra
Fornecedor -> Documento de compra -> Itens -> Entrada de estoque -> Histórico de custo

### Transferência
Origem -> Solicitação -> Envio -> Recebimento -> Divergência eventual

### Vida do produto
Resumo -> Estoque por local -> Movimentações -> Auditoria/relacionamentos

### Vida do fornecedor
Resumo -> Compras -> Cotações -> Produtos -> Preços -> Contatos -> Relacionamento -> Linha do tempo unificada

## Timeline Operacional (Cross-cutting)
### Conceito
Sistema central de rastreabilidade que consolida eventos automáticos do sistema e registros manuais de relacionamento.

### Entidades suportadas
- Fornecedores
- Produtos
- Documentos de compra
- Cotações
- Transferências
- Movimentações de estoque

## Legado ainda existente
- products.stock_quantity permanece como compatibilidade histórica
- mínimos e máximos ainda são globais por produto
- futura evolução recomendada: configuração min/max por local

**Ponto importante de registro:**
Hoje o mínimo/máximo global ainda vive em `products.min_stock` e `products.max_stock`, enquanto o saldo por local vive em `inventory_location_balances` e os locais em `stock_locations`.
