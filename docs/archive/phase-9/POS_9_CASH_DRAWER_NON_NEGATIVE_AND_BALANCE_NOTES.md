# POS_9 — Regra caixa físico não negativo e observações de saldo

## Contexto

Após validar a classificação automática por forma de pagamento no Livro Diário, foram criados lançamentos manuais de teste com dinheiro e Pix.

A classificação foi aplicada corretamente:

- entrada em dinheiro -> destino `cash_drawer`, `affects_cash_drawer = true`;
- saída em dinheiro -> origem `cash_drawer`, `affects_cash_drawer = true`;
- entrada Pix -> destino `pix_wallet`, `affects_cash_drawer = false`;
- todos com `classification_source = cashbook_entry_metadata_trigger`.

## Regra operacional confirmada

```txt
Caixa físico em dinheiro nunca pode ficar negativo.
```

Uma saída em dinheiro só pode ser lançada se houver saldo físico disponível na gaveta/caixa.

## Correção aplicada

Arquivo:

```txt
src/services/cashbookService.ts
```

Commit:

```txt
c444fb6 - fix: bloqueia saida dinheiro com caixa insuficiente
```

A correção adiciona validação defensiva no `CashbookService.create`:

1. monta a classificação padrão por forma de pagamento;
2. identifica se o lançamento é saída do caixa físico;
3. calcula o saldo físico atual da gaveta usando lançamentos com:

```txt
affects_cash_drawer = true
affects_balance != false
status não cancelado/anulado
```

4. bloqueia a criação se o valor da saída for maior que o saldo físico disponível.

Mensagem esperada em pt-BR:

```txt
Saldo insuficiente no caixa físico. Saldo disponível: R$ X,XX.
```

## Observação importante sobre Pix e Saldo Atual

Também foi observado que entrada Pix altera o card visual `Saldo Atual`.

Isso deve ser tratado em uma etapa posterior de revisão dos indicadores, porque o card atual ainda representa o saldo financeiro acumulado do Livro Diário e não o saldo físico da gaveta.

A revisão futura deve separar claramente:

```txt
saldo financeiro acumulado
saldo físico do caixa/gaveta
saldo por conta financeira
movimento do período
pendentes
transferências internas
```

## Próxima recomendação

Depois de validar o bloqueio de saída em dinheiro sem saldo, seguir para:

1. modal `Nova Entrada` / `Nova Saída` com categoria e conta financeira em pt-BR;
2. etapa específica dos indicadores financeiros, separando saldo financeiro de caixa físico.
