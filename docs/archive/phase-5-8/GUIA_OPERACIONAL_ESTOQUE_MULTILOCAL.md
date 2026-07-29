# Guia operacional — estoque multilocal

## Conceito
A loja opera com múltiplos locais internos de estoque dentro da mesma store.

## Visões disponíveis
### Produtos
Visão consolidada do item.

### Estoque por local
Visão de saldo físico, reservado e disponível por local.

### Transferências
Fluxo entre origem e destino.

### Vida do produto
Visão 360° do item.

### Movimentações
Histórico detalhado de entradas, saídas, reservas, ajustes e transferências.

## Conceitos operacionais
### Físico
Quantidade realmente existente no local.

### Reservado
Quantidade comprometida com pedidos ou operações.

### Disponível
Saldo utilizável no momento.

### Divergência
Diferença entre o que foi enviado e o que foi recebido.

## Quando comprar vs quando transferir
### Comprar
Quando o estoque consolidado da loja está crítico.

### Transferir
Quando o estoque global ainda está bom, mas um local específico está abaixo do necessário.

## Boas práticas
- vender pela loja com saldo do ponto correto
- transferir do estoque principal para a frente de venda
- usar vida do produto para investigar histórico e ruptura
- usar exportações para controle externo

### Visão Aprovada
A solução gerencial recomendada é trabalhar com duas camadas de criticidade:
- global da loja
- por local/ponto

Isto é coerente com o estado atual do schema, onde `products` guarda min/max globais e `inventory_location_balances` guarda o saldo por local.
