# POS_9 - Financeiro - Service do plano de contas do caixa

## Status

Criado service frontend para listar o plano simples de categorias do Livro Diario.

## Arquivo criado

- `src/services/cashbookAccountPlanService.ts`

Commit:

- `646525748bd98a292a6bcc61924ea85bb5af4be2`

## Service

- `CashbookAccountPlanService`

## Métodos

### `list(activeOnly)`

Lista categorias do plano de contas.

### `listForDirection(direction)`

Filtra categorias por direção operacional:

```txt
in       -> income + adjustment
out      -> expense + adjustment
transfer -> transfer/is_transfer
```

## Uso previsto

O formulário do Livro Diario poderá usar esse service para selecionar a categoria do lançamento.

Exemplos:

- Entrada: venda em dinheiro, reposição de divergência, reforço de troco, aporte do proprietário;
- Saída: despesa operacional, compra pequena, devolução, perda assumida;
- Transferência: caixa para cofre, cofre para caixa, caixa para banco.

## Próxima etapa

Evoluir `CashbookService.create` e o formulário de Nova Entrada/Nova Saída para enviar metadata de classificação:

```txt
account_plan_code
source_financial_account_code
destination_financial_account_code
is_transfer
affects_cash_drawer
affects_financial_result
```
