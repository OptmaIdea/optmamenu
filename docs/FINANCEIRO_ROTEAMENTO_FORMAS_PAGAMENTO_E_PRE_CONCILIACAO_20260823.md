# OptmaMenu — roteamento financeiro, formas de pagamento e pré-conciliação

Data: 2026-08-23

## Decisão funcional

O módulo `Financeiro → Saldos por conta` passa a trabalhar com uma **conta operacional de entrada das vendas** por loja.

Quando uma venda concluída gera movimento financeiro:

1. o valor entra primeiro na conta marcada como `Entrada das vendas`;
2. o lançamento preserva a forma de pagamento real (`cash`, `pix`, `debit_card`, `credit_card`, etc.);
3. a conta mantém saldo total e saldo segmentado por forma de pagamento;
4. posteriormente o operador transfere os valores para outras contas financeiras compatíveis;
5. transferências internas não alteram o resultado do Livro Diário; somente deslocam o saldo entre contas;
6. `Não distribuído` deixa de ser o fluxo normal e permanece como área de exceção para histórico antigo, falha de configuração ou lançamento sem rota válida.

## Formas aceitas por conta

Cada conta financeira possui uma lista configurável de formas de pagamento aceitas.

Exemplos:

- Caixa físico: dinheiro, Pix, débito e crédito;
- Cofre: dinheiro;
- Banco/CEF: Pix e/ou transferência bancária;
- Carteira Pix: Pix;
- Maquininha/recebíveis: débito e crédito.

Esses valores são defaults iniciais e podem ser alterados pelo proprietário/usuário autorizado.

A transferência entre contas deve respeitar a forma de pagamento. Se uma conta de destino não aceita a forma selecionada, ela não é destino válido.

## Conta de entrada das vendas

Só pode existir uma conta marcada como `Entrada das vendas` por loja.

A venda só é roteada automaticamente quando:

- a conta está ativa;
- é a conta de entrada da loja;
- aceita a forma de pagamento da venda.

Se não houver uma conta compatível, o lançamento permanece em `Não distribuído`, preservando o erro operacional para correção manual.

## Distribuição em lote do histórico

Lançamentos antigos continuam sem inferência automática.

A interface permite:

- selecionar todos;
- selecionar por forma de pagamento;
- escolher uma conta compatível;
- distribuir a seleção em lote;
- registrar motivo comum opcional;
- manter auditoria de cada lançamento classificado.

## Transferência entre contas / pré-conciliação

A transferência utiliza:

- conta de origem;
- forma de pagamento;
- saldo disponível daquela forma na origem;
- conta de destino compatível;
- valor;
- observação opcional.

Exemplo conceitual:

- Conta operacional possui R$ 20 em dinheiro, R$ 100 em Pix, R$ 120 em débito e R$ 100 em crédito;
- dinheiro só pode ir para outra conta que aceite `cash`;
- Pix só pode ir para conta que aceite `pix`;
- débito/crédito só podem ir para contas que aceitem os respectivos meios;
- o saldo total do Livro Diário não muda com essas transferências.

## Duplicata / venda PJ → PJ

`Duplicata` não deve ser tratada como dinheiro disponível no caixa no momento da venda.

A decisão é modelá-la como **venda a prazo / contas a receber**:

1. a venda registra a condição `duplicata`;
2. nasce um recebível com vencimento, contraparte, documento e saldo em aberto;
3. somente na baixa do recebível o valor entra efetivamente em uma conta financeira;
4. a baixa informa o meio real de liquidação (Pix, transferência, dinheiro, etc.);
5. conciliação futura compara o recebível baixado com extrato/OFX/CSV.

Portanto `duplicata` não será ativada como simples forma que afeta saldo antes da entrega do submódulo de contas a receber.

## Implementado nesta entrega

Migration remota/Git:

- `20260823180822_financial_account_payment_method_routing_and_batch_distribution.sql`

Backend:

- configuração de formas aceitas por conta;
- uma conta operacional padrão de entrada das vendas;
- roteamento automático de novas vendas compatíveis;
- saldo por forma de pagamento dentro de cada conta;
- classificação individual validando compatibilidade;
- classificação em lote;
- transferência entre contas validando forma e saldo disponível;
- RLS/revogação de acesso direto à tabela de configuração;
- RPCs autorizadas por loja/permissão.

Frontend:

- visualização da composição do saldo por forma;
- indicação `Entrada das vendas`;
- configuração de formas aceitas;
- distribuição em lote com seleção por forma de pagamento;
- destinos filtrados por compatibilidade;
- transferência entre contas diretamente no card de saldo.

## Regra de continuidade

Este modelo é a base para:

- fechamento de caixa;
- pré-conciliação;
- conciliação bancária;
- contas a receber/duplicatas;
- taxas de adquirente;
- liquidação de cartões;
- OFX/CSV;
- DRE e fluxo de caixa.
