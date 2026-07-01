# POS_9 - Financeiro - Fechamento do caixa do dia - Diagnostico 1

## Status

Diagnostico criado.

## Contexto

A frente de Livro Diario foi validada com:

- lancamentos e pendentes separados em abas;
- recebimento pendente confirmado pela RPC segura;
- formas de pagamento corrigidas;
- build ok;
- console limpo.

Com isso, o proximo passo financeiro e iniciar a etapa de Fechamento do caixa do dia.

## Objetivo do fechamento

Criar um fluxo robusto para ajudar o usuario a conferir o caixa no fim do expediente.

A etapa nao deve ser apenas uma calculadora simples. Deve evoluir para uma conferencia operacional com comparacao entre valores esperados pelo sistema e valores conferidos fisicamente/externamente.

## Diagnostico criado

Arquivo:

- `docs/sql_diagnostics/diagnose_cashbook_day_closing.sql`

Commit:

- `fcdf41b2c3a25c1df92ecdc2de7aa2050c851c34`

## O que o diagnostico verifica

1. Tabelas possivelmente relacionadas a caixa, fechamento e financeiro.
2. Colunas de `cashbook_entries`.
3. Constraints relevantes de `cashbook_entries` e `orders`.
4. Formas de pagamento configuradas por loja.
5. Totais realizados por dia e forma de pagamento.
6. Pendentes por dia que nao devem entrar no fechamento realizado.
7. Amostra de lancamentos recentes.
8. RPCs/funcoes financeiras existentes.

## Regras esperadas para o fechamento

### Entram no realizado

Somente lancamentos com:

- `status <> cancelled`;
- `affects_balance = true`;
- forma de pagamento real, como dinheiro, Pix, cartao de debito ou cartao de credito.

### Nao entram no realizado

Nao devem compor fechamento realizado:

- pagamentos pendentes;
- lancamentos cancelados;
- lancamentos com `affects_balance = false`.

Eles podem aparecer como informativo.

## Conferencia planejada

### Dinheiro fisico

Tabela de cedulas e moedas:

- 0,05;
- 0,10;
- 0,25;
- 0,50;
- 1,00;
- 2,00;
- 5,00;
- 10,00;
- 20,00;
- 50,00;
- 100,00;
- 200,00.

Campos:

- quantidade;
- total por nota/moeda;
- total em dinheiro contado.

### Cartoes

Campo para total conferido nas maquinas/adquirentes.

### Pix

Campo para total conferido no banco/extrato Pix.

## Comparacoes futuras

A tela deve comparar:

- dinheiro esperado x dinheiro contado;
- Pix esperado x Pix conferido;
- cartoes esperados x cartoes conferidos;
- total esperado x total conferido;
- sobra/falta/divergencia.

## Proxima etapa

Rodar o diagnostico no Supabase e, com base no resultado, decidir:

1. se ja existe tabela aproveitavel para fechamento;
2. se precisaremos criar `cashbook_day_closings`;
3. qual RPC segura criar primeiro;
4. quais permissoes temporarias usar;
5. quais permissoes definitivas registrar para etapa futura.

## Observacao de permissao

O fechamento do caixa do dia deve exigir permissao propria ou financeira explicita.

Sugestoes futuras:

- `cashbook.close_day`;
- `cashbook.manage`;
- `finance.manage`.

Enquanto a permissao granular nao existir, usar temporariamente uma permissao financeira existente e manter validacao no backend.
