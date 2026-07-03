# POS_9 - Financeiro - Caixa, contas e classificacoes

## Status

Diretriz registrada para evolucao do Livro Diario e do Fechamento do Dia.

## Ponto identificado

O saldo do Livro Diario nao deve ser confundido com dinheiro fisico disponivel na gaveta.

O caixa do dia representa a operacao do dia.

O dinheiro fisico, Pix, debito e credito precisam ser separados por destino financeiro.

## Regra principal

Dinheiro fica no caixa fisico ou em local definido pela loja.

Pix fica em conta ou carteira.

Debito e credito ficam na adquirente, banco ou recebiveis.

Transferencias internas nao sao despesas.

## Contas ou locais financeiros futuros

Criar separacao por locais financeiros:

- caixa fisico;
- cofre;
- banco;
- carteira Pix;
- maquininha;
- recebiveis de cartao;
- proprietario;
- outros.

## Fechamento do dia

No fechamento, o sistema deve indicar para onde cada forma de pagamento vai.

Exemplo:

- dinheiro permanece no caixa ou vai para cofre;
- Pix vai para conta;
- debito vai para maquininha ou banco;
- credito vai para recebiveis;
- sangria move dinheiro do caixa para outro local.

## Troco e moedas

Se houver apenas troca de cedulas por moedas, isso e troca interna e nao altera resultado.

Se o proprietario deixar dinheiro adicional para reforcar o troco, registrar como reforco de caixa ou aporte do proprietario.

Esse registro deve ter origem, destino, valor e observacao.

## Plano simples de contas

Criar um pequeno plano de contas para facilitar lancamentos.

Entradas:

- venda em dinheiro;
- venda Pix;
- venda debito;
- venda credito;
- recebimento pendente;
- reposicao de divergencia;
- reforco de troco;
- aporte do proprietario;
- ajuste positivo.

Saidas:

- despesa operacional;
- compra pequena;
- retirada para cofre;
- retirada do proprietario;
- devolucao;
- ajuste negativo;
- perda assumida.

Transferencias:

- caixa para cofre;
- cofre para caixa;
- caixa para banco;
- banco para caixa;
- proprietario para caixa;
- caixa para proprietario;
- Pix para banco;
- maquininha para banco;
- troca de cedulas e moedas.

## Campos futuros sugeridos

Evoluir os lancamentos com campos como:

- category_code;
- account_plan_code;
- source_account_id;
- destination_account_id;
- is_transfer;
- transfer_group_id;
- affects_cash_drawer;
- affects_financial_result;
- affects_balance.

## UX futura

Separar na tela:

- saldo fisico do caixa;
- movimento financeiro do periodo;
- recebimentos por forma de pagamento;
- transferencias internas;
- despesas reais;
- pendentes e cancelados.

## Prioridade

Registrar como diretriz agora.

Implementar em etapas depois, sem quebrar o Livro Diario atual antes do lancamento.
