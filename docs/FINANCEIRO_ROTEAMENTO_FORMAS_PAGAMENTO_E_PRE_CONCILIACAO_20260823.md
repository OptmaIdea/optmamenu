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

## Formas específicas e conta preferencial

Uma loja pode criar uma forma específica derivada de uma natureza-base, por exemplo:

- `Débito InfinitePay` → base `Cartão de débito`;
- `Crédito Stone` → base `Cartão de crédito`;
- `Pix Banco X` → base `Pix`.

A forma específica preserva um `base_code` canônico para relatórios e compatibilidade financeira, mas mantém código próprio para identificar adquirente/canal.

Uma forma específica pode possuir **conta financeira preferencial**. Quando o operador troca a forma de recebimento de um lançamento para uma forma com conta preferencial:

1. a interface sugere e pré-seleciona automaticamente a conta preferencial;
2. a sugestão não é uma trava: o operador pode escolher outra conta compatível;
3. uma conta é considerada compatível quando aceita o código específico ou a natureza-base da forma;
4. a conta preferencial precisa pertencer à mesma loja e estar ativa;
5. a alteração do recebimento permanece auditada.

Exemplo homologado em HML: `Débito InfinitePay`, base `Cartão de débito`, com conta preferencial `InfinitePay`.

## Distribuição em lote do histórico

Lançamentos antigos continuam sem inferência automática.

A interface permite:

- selecionar todos;
- filtrar por forma de pagamento;
- selecionar os lançamentos visíveis;
- escolher uma conta compatível;
- distribuir a seleção em lote;
- registrar motivo comum opcional;
- manter auditoria de cada lançamento classificado.

Os botões de filtro possuem seleção visual exclusiva: somente o filtro ativo deve aparecer destacado.

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

Para formas específicas, a compatibilidade considera tanto o código específico quanto sua natureza-base, preservando o código específico no movimento.

## Conferência em tela

A área `Conferência` permite conferir extrato, caixa ou resumo de maquininha sem impressão, com:

- conta;
- forma de pagamento;
- período;
- total e saldo do filtro;
- ticadores visuais por sessão;
- ajuste individual de forma de recebimento e conta;
- sugestão automática da conta preferencial quando configurada;
- override manual para outra conta compatível.

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

Migrations remotas/Git relevantes:

- `20260823180822_financial_account_payment_method_routing_and_batch_distribution.sql`;
- `20260823183959_financial_reconciliation_payment_adjustment_and_drilldown.sql`;
- `20260823184724_custom_payment_method_variants_and_preferred_accounts.sql`;
- `20260823185227_fix_payment_variant_slug_without_unaccent.sql`;
- `20260823191942_financial_payment_preferred_account_suggestion_and_base_compatibility.sql`.

Backend:

- configuração de formas aceitas por conta;
- uma conta operacional padrão de entrada das vendas;
- roteamento automático de novas vendas compatíveis;
- saldo por forma de pagamento dentro de cada conta;
- classificação individual validando compatibilidade;
- classificação em lote;
- transferência entre contas validando forma e saldo disponível;
- formas específicas com natureza-base;
- conta preferencial por forma específica;
- compatibilidade por código específico ou base;
- RLS/revogação de acesso direto à tabela de configuração;
- RPCs autorizadas por loja/permissão.

Frontend:

- visualização da composição do saldo por forma;
- indicação `Entrada das vendas`;
- configuração de formas aceitas;
- distribuição em lote com filtro por forma de pagamento;
- filtros com estado visual exclusivo;
- destinos filtrados por compatibilidade;
- sugestão automática de conta preferencial com possibilidade de override;
- transferência entre contas diretamente no card de saldo;
- conferência em tela com período e ticadores.

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
