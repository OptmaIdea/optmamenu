# PDV — correção operacional urgente (2026-07-24)

## Motivo

A Fase PDV-2 foi encerrada com rota, bootstrap e catálogo, mas sem validar uma
operação real. Esta correção fecha as regressões observadas na homologação em
desktop e celular.

## Entregas

- cards exibem a primeira imagem real do produto;
- toque/clique adiciona o produto ao carrinho;
- carrinho persistente por loja e local;
- controles `− / quantidade / +`, remoção e limpeza;
- carrinho lateral no desktop e gaveta inferior no celular;
- forma de pagamento, dinheiro recebido e troco;
- finalização idempotente pelo motor central de preços;
- modo escuro dentro do layout dedicado;
- avatar e apelido do operador;
- botão de retorno ao painel também no celular para usuários com acesso;
- atalho permanente do PDV no cabeçalho administrativo;
- manifesto `pdv.webmanifest` e service worker próprios;
- cadastro de código interno, SKU e EAN no formulário de produto;
- rolagem horizontal explícita nas tabelas de Produtos e Categorias;
- tratamento local de sessão inválida antes de redirecionar ao login.

## Venda com divergência de estoque

O PDV não bloqueia o atendimento quando a quantidade vendida supera o saldo
disponível. O operador precisa confirmar a exceção. A transação:

1. conclui a venda;
2. reduz o saldo físico até zero, sem criar saldo negativo silencioso;
3. registra `pdv_stock_exception` em `audit_logs`;
4. preserva no evento os itens, quantidade pedida, disponível e diferença;
5. deixa a divergência disponível para reconciliação posterior.

Descontos enviados por um operador de PDV continuam exigindo
`pdv.discount.apply`.

## Banco

Migração:

`20260724002328_pdv_stock_exception_and_sell_permission.sql`

Funções alteradas:

- `create_admin_direct_sale_order_safe`
- `create_admin_direct_sale_order_legacy_internal`

## Validação

Teste transacional executado com 55 unidades solicitadas e 50 disponíveis:

- venda concluída;
- saldo resultante: zero;
- divergência registrada: 5 unidades;
- um evento de auditoria criado;
- transação revertida;
- nenhum pedido, auditoria ou movimento de teste permaneceu no banco.
