# HANDOFF 2026-07-06 - Financeiro, caixa fisico e contas

## Objetivo deste documento

Registrar de forma coesa o ponto exato em que o trabalho parou, para continuidade em novo chat sem perda de contexto.

## Contexto geral

Estamos evoluindo o financeiro do OptmaMenu para separar corretamente:

- movimento financeiro do dia;
- saldo do Livro Diario;
- dinheiro fisico na gaveta/caixa;
- contas financeiras da loja;
- plano simples de contas/categorias;
- ocorrencias de divergencia de fechamento;
- reposicoes, sangrias, reforco de troco e transferencias internas.

A regra operacional definida foi:

```txt
Livro Diario registra movimentos financeiros.
Caixa fisico representa dinheiro real na gaveta.
Pix/cartao/banco/maquininha nao devem ser tratados como dinheiro fisico do caixa.
```

## Ultimas entregas validadas pelo usuario

### 1. Fechamento do caixa do dia

Foi criada a base de fechamento diario com:

- tabela `cashbook_day_closings`;
- previa de fechamento;
- salvar fechamento;
- contagem de dinheiro por denominacao;
- totais por Pix/debito/credito/outros;
- divergencia;
- historico;
- caixas abertos;
- caixas em atraso;
- modal de detalhes;
- ocorrencias de divergencia.

O usuario validou que a tela estava funcionando bem.

### 2. Ocorrencia de divergencia

Foi criada a tabela:

```txt
cashbook_closing_occurrences
```

A divergencia gera ocorrencia quando necessario.

Fluxo validado:

```txt
Fechamento original fica intacto.
Ocorrencia registra a falta/sobra.
Resolucao registra observacao e status.
Se valor for reposto, entra um novo lancamento no Livro Diario atual.
```

### 3. Reposicao de valor de divergencia

Caso real validado:

```txt
Fechamento: 05/05/2026
Diferenca: -1,00
Ocorrencia: falta
Reposicao posterior: +1,00 no Livro Diario em 02/07/2026
```

Entrada validada pelo usuario:

```txt
entry_code: CXA-20260702-221247-B951
amount: 1.00
description: Reposicao de divergencia de fechamento 05/05/2026
account_plan_code: closing_replenishment
destination_account_code: cash_drawer
affects_cash_drawer: true
affects_financial_result: false
occurrence_id: 47c80994-73c0-4ccb-ac48-ad0f68d75f55
```

Regra confirmada:

```txt
A reposicao aumenta o caixa fisico.
Nao vira receita operacional.
Continua vinculada a ocorrencia.
```

## Base de contas financeiras criada

Tabelas criadas:

```txt
cashbook_account_plan
store_financial_accounts
```

Colunas adicionadas em `cashbook_entries`:

```txt
account_plan_code
source_financial_account_id
destination_financial_account_id
is_transfer
transfer_group_id
affects_cash_drawer
affects_financial_result
```

Contas padrao criadas por loja:

```txt
cash_drawer        Caixa fisico
safe               Cofre
bank_main          Banco principal
pix_wallet         Carteira Pix
card_acquirer      Maquininha
card_receivable    Recebiveis de cartao
owner              Proprietario
```

Usuario validou a criacao dessas contas.

## Tela de contas financeiras

Criada tela:

```txt
src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx
```

Rota criada:

```txt
/admin/financial-accounts
```

Service criado:

```txt
src/services/financialAccountsService.ts
```

Permite:

- listar contas;
- criar conta;
- editar conta;
- ativar/desativar;
- marcar padrao.

O usuario confirmou que o ajuste estava de acordo.

Atalho no menu lateral:

O usuario informou posteriormente que o patch visual do menu lateral ja tinha sido aplicado.

Item esperado:

```txt
Financeiro > Contas financeiras
```

## Plano simples de contas

Seed criado com categorias como:

Entradas:

```txt
sale_cash
sale_pix
sale_debit
sale_credit
pending_payment_received
closing_replenishment
change_float_reinforcement
owner_contribution
positive_adjustment
```

Saidas:

```txt
operational_expense
small_purchase
refund
negative_adjustment
assumed_loss
```

Transferencias:

```txt
transfer_cash_to_safe
transfer_safe_to_cash
transfer_cash_to_bank
transfer_bank_to_cash
transfer_owner_to_cash
transfer_cash_to_owner
transfer_pix_to_bank
transfer_card_to_bank
cash_change_exchange
```

## Trigger de classificacao por metadata

Criado trigger:

```txt
trg_cashbook_entry_metadata_classification
```

Funcao:

```txt
apply_cashbook_entry_metadata_classification
```

Arquivo:

```txt
supabase/migrations/20260703040000_cashbook_entries_metadata_classifier.sql
```

Ele interpreta metadata enviada para `cashbook_entries` e preenche colunas estruturadas.

Campos aceitos em metadata:

```txt
account_plan_code
source_financial_account_code
destination_financial_account_code
is_transfer
affects_cash_drawer
affects_financial_result
```

Campos preenchidos:

```txt
account_plan_code
source_financial_account_id
destination_financial_account_id
is_transfer
affects_cash_drawer
affects_financial_result
```

Validacao rodada pelo usuario confirmou que a reposicao continuou classificada corretamente.

## Services criados/alterados na ultima parte

### 1. Service do plano de contas

Arquivo criado:

```txt
src/services/cashbookAccountPlanService.ts
```

Commit:

```txt
6465257 - feat: cria service plano contas caixa
```

Metodos:

```txt
CashbookAccountPlanService.list(activeOnly)
CashbookAccountPlanService.listForDirection(direction)
```

Direcoes:

```txt
in       -> income + adjustment
out      -> expense + adjustment
transfer -> transfer/is_transfer
```

### 2. CashbookService preparado para classificacao

Arquivo alterado:

```txt
src/services/cashbookService.ts
```

Commit:

```txt
b27fac3 - feat: prepara cashbook service classificacao
```

Foi adicionado suporte opcional em `CreateCashbookEntryInput` para:

```txt
account_plan_code
source_financial_account_code
destination_financial_account_code
is_transfer
affects_cash_drawer
affects_financial_result
```

Esses campos sao convertidos para metadata antes de chamar:

```txt
create_cashbook_entry
```

O trigger no banco faz o preenchimento estrutural.

## Ultima validacao criada antes do chat travar

Arquivo criado:

```txt
docs/sql_diagnostics/validate_cashbook_service_classification_path.sql
```

Commit:

```txt
fc2fc85 - docs: valida caminho classificacao service caixa
```

Esse SQL cria uma entrada tecnica de teste de R$ 0,01 com metadata:

```txt
account_plan_code = change_float_reinforcement
destination_financial_account_code = cash_drawer
affects_cash_drawer = true
affects_financial_result = false
is_transfer = false
```

Depois consulta se o trigger aplicou:

```txt
account_plan_code
destination_account_code
affects_cash_drawer
affects_financial_result
classification_source
```

## Ponto exato em que parou

O chat travou logo apos:

1. atualizar `CashbookService` com campos opcionais de classificacao;
2. tentar criar um documento tecnico, que foi bloqueado pela ferramenta;
3. criar a validacao SQL `validate_cashbook_service_classification_path.sql`.

Ainda nao foi validado pelo usuario:

```txt
docs/sql_diagnostics/validate_cashbook_service_classification_path.sql
```

## Proxima acao recomendada no novo chat

### Passo 1 - Atualizar codigo local

```bash
git pull
npm run build
```

### Passo 2 - Aplicar migrations pendentes no Supabase, se ainda nao aplicadas

Confirmar se estas ja foram aplicadas:

```txt
supabase/migrations/20260703040000_cashbook_entries_metadata_classifier.sql
```

Se nao tiver sido aplicada, aplicar antes da validacao.

### Passo 3 - Rodar validacao SQL

Rodar:

```txt
docs/sql_diagnostics/validate_cashbook_service_classification_path.sql
```

Resultado esperado:

```txt
account_plan_code = change_float_reinforcement
destination_account_code = cash_drawer
affects_cash_drawer = true
affects_financial_result = false
classification_source = cashbook_entry_metadata_trigger
```

Observacao: esse teste cria uma entrada de R$ 0,01. Depois pode ser cancelada no Livro Diario ou ignorada como teste tecnico.

### Passo 4 - Evoluir UI do Livro Diario

Proxima entrega funcional:

- carregar `CashbookAccountPlanService`;
- carregar `FinancialAccountsService`;
- no modal Nova Entrada/Nova Saida, adicionar selecao opcional de categoria;
- para entrada comum, destino padrao pode ser `cash_drawer` quando forma de pagamento for dinheiro;
- para Pix/cartao, futuramente destino deve ser carteira Pix/maquininha/recebiveis;
- enviar metadata via `CashbookService.create`.

## Cuidado importante

Nao alterar ainda o calculo visual do Livro Diario sem antes separar claramente:

```txt
saldo financeiro acumulado
saldo fisico do caixa/gaveta
movimento do periodo
pendentes
transferencias internas
```

Tambem evitar tratar Pix/cartao como dinheiro fisico em caixa.

## Estado final resumido

Estamos com:

- fechamento diario funcional;
- ocorrencias de divergencia funcionais;
- reposicao de divergencia validada;
- contas financeiras base criadas;
- tela de contas financeiras criada;
- plano simples de contas criado;
- trigger de classificacao por metadata criado;
- service de plano de contas criado;
- CashbookService preparado para enviar classificacao;
- falta validar o caminho de classificacao via SQL de teste;
- proxima etapa e UI do Livro Diario para escolher categoria/conta.
