# POS_9 - Financeiro - Fechamento do caixa do dia

## Status

Etapa futura registrada para depois da consolidacao do Livro Diario de Caixa.

## Contexto

Durante a evolucao do Livro Diario de Caixa, foi definida a necessidade de uma area propria para conferencia e fechamento do caixa do dia.

A ideia inicial era uma calculadora simples de cedulas e moedas, mas a decisao funcional e evoluir para um fluxo mais robusto de fechamento de caixa.

## Objetivo

Ajudar o usuario que esta fechando a loja a conferir o caixa com rapidez, clareza e menos risco de erro.

Esse fluxo deve considerar que, no fim do expediente, quem confere o caixa normalmente precisa de uma tela simples, objetiva e confiavel.

## Posicionamento na aplicacao

A area de fechamento deve ficar ligada ao Financeiro e ao Livro Diario.

Na primeira versao planejada, pode aparecer logo apos consolidarmos o Livro Diario de Caixa, como uma area ou etapa chamada:

- Fechamento do caixa do dia;
- Conferencia de caixa;
- Fechar caixa.

## Componentes esperados

### 1. Conferencia de dinheiro fisico

Tabela de cedulas e moedas:

| Nota ou moeda | Quantidade | Total |
| --- | ---: | ---: |
| 0,05 | | |
| 0,10 | | |
| 0,25 | | |
| 0,50 | | |
| 1,00 | | |
| 2,00 | | |
| 5,00 | | |
| 10,00 | | |
| 20,00 | | |
| 50,00 | | |
| 100,00 | | |
| 200,00 | | |

Resultado:

- Total em caixa dinheiro.

### 2. Conferencia de cartoes

Campo ou bloco para informar totais conferidos nas maquinas de cartao.

Resultado:

- Total em cartoes.

Observacao operacional:

- O valor deve ser conferido nas maquinas/adquirentes.

### 3. Conferencia de Pix

Campo ou bloco para informar totais conferidos no banco ou extrato Pix.

Resultado:

- Total em Pix.

Observacao operacional:

- O valor deve ser conferido no banco/extrato Pix.

### 4. Comparacao com o sistema

O sistema deve comparar:

- dinheiro esperado pelo Livro Caixa;
- dinheiro contado fisicamente;
- Pix esperado no sistema;
- Pix confirmado no banco;
- cartoes esperados no sistema;
- cartoes confirmados nas maquinas.

### 5. Diferencas

Mostrar diferencas de forma clara:

- sobra;
- falta;
- divergencia por forma de pagamento;
- observacao obrigatoria quando houver divergencia relevante.

### 6. Registro do fechamento

O fechamento deve registrar:

- loja;
- data do fechamento;
- usuario responsavel;
- horario;
- totais informados;
- totais calculados pelo sistema;
- divergencias;
- observacoes;
- status do fechamento.

## Status possiveis futuros

- aberto;
- em conferencia;
- fechado;
- reaberto;
- ajustado.

## Permissoes futuras

O fechamento de caixa deve exigir permissao propria ou financeira explicita.

Sugestoes futuras:

- cashbook.close_day;
- cashbook.manage;
- finance.manage.

## Relacao com recebiveis pendentes

Pagamentos pendentes nao devem entrar como valor realizado no fechamento.

Eles podem aparecer como informativo:

- Pendentes de recebimento no dia;
- Pendentes acumulados;
- Recebidos depois do fechamento.

## Fora do escopo imediato

Nao implementar agora:

- tela completa de fechamento;
- schema proprio de fechamento;
- impressao de relatorio;
- assinatura digital;
- sangria/suprimento avancados;
- integracao com adquirentes;
- conciliacao bancaria automatica.

Esses itens ficam para etapa posterior, apos a consolidacao do Livro Diario e recebiveis pendentes.

## Decisao atual

Seguir agora com:

1. recebiveis pendentes dentro do Livro Diario;
2. confirmacao de recebimento via RPC;
3. depois consolidar Livro Diario;
4. em seguida criar a etapa de Fechamento do caixa do dia.
