# POS_9 — Próximo patch — Classificação no modal do Livro Diário

## Estado atual

A classificação automática por forma de pagamento já foi validada:

- dinheiro -> `cash_drawer`;
- Pix -> `pix_wallet`;
- cartão -> `card_receivable`;
- saída em dinheiro acima do saldo físico -> bloqueada;
- regra de caixa físico não negativo -> validada;
- toast em pt-BR para regra prevista -> validado;
- console limpo para regra prevista -> validado localmente.

## Hook criado

Arquivo:

```txt
src/hooks/financial/useCashbookClassificationOptions.ts
```

Objetivo:

- carregar categorias do plano de contas via `CashbookAccountPlanService.listForDirection`;
- carregar contas financeiras ativas via `FinancialAccountsService.list`;
- formatar categorias/contas com helpers pt-BR;
- sugerir conta financeira padrão pela forma de pagamento;
- montar sugestão de payload para `CashbookService.create`.

## Próxima integração no `CashbookPage.tsx`

Adicionar no estado do formulário:

```txt
accountPlanCode
financialAccountCode
```

No modal `Nova Entrada` / `Nova Saída`, exibir:

```txt
Categoria
Conta financeira
```

Ambos devem aparecer em pt-BR.

## Payload esperado no create

Ao salvar lançamento manual, além dos campos atuais, enviar:

```txt
account_plan_code
source_financial_account_code
ou destination_financial_account_code
affects_cash_drawer
affects_financial_result
is_transfer
```

A direção define origem/destino:

```txt
Entrada -> destination_financial_account_code
Saída   -> source_financial_account_code
```

## Cuidados

1. Não sobrescrever a correção local do `catch` no `CashbookPage.tsx`, que mantém console limpo para regra prevista de saldo insuficiente.
2. Não alterar ainda os cards de saldo visual.
3. Não transformar Pix/cartão em caixa físico.
4. Categoria deve ser escolhida pelo usuário; não forçar `account_plan_code` automático.

## Validação esperada após integração

- Criar entrada em dinheiro com categoria escolhida;
- Criar entrada Pix com categoria escolhida;
- Criar saída em dinheiro dentro do saldo;
- Tentar saída em dinheiro acima do saldo;
- Confirmar console limpo e toast em pt-BR;
- Verificar no Supabase se `account_plan_code`, origem/destino e flags foram preenchidos pelo trigger.
