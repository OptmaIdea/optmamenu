# POS_9 — Patch manual — Classificação no Livro Diário

## Contexto

A integração direta em `CashbookPage.tsx` deve preservar a correção local já validada para regra de saldo insuficiente, em que o aviso aparece apenas via toast e o console permanece limpo.

Como esse arquivo estava com alteração local recente, o próximo patch deve ser aplicado com cuidado.

## Objetivo do patch

Adicionar no modal `Nova Entrada` / `Nova Saída`:

- campo `Categoria`;
- campo `Conta financeira`;
- labels em pt-BR;
- envio de `account_plan_code`;
- envio de `source_financial_account_code` ou `destination_financial_account_code` conforme direção;
- envio de `affects_cash_drawer`, `affects_financial_result` e `is_transfer`.

## Arquivos já preparados

```txt
src/hooks/financial/useCashbookClassificationOptions.ts
src/utils/finance/ptBrFinancialLabels.ts
```

## Integração esperada em CashbookPage

1. Importar `useCashbookClassificationOptions`.
2. Adicionar no `CashbookFormState`:

```txt
accountPlanCode
financialAccountCode
```

3. Inicializar os campos no `openCreateForm` e `openEditForm`.
4. Usar o hook com `storeId` e `formState.direction`.
5. Ao mudar a forma de pagamento, sugerir conta padrão:

```txt
Dinheiro -> cash_drawer
Pix -> pix_wallet
Cartão -> card_receivable
```

6. Antes de chamar `CashbookService.create`, montar a sugestão com `buildSuggestion` e enviar os campos de classificação.
7. Exibir selects de categoria e conta financeira antes de `Observações`.

## Validações depois do patch

- Entrada em dinheiro com categoria escolhida;
- Entrada Pix com categoria escolhida;
- Saída em dinheiro dentro do saldo;
- Saída em dinheiro acima do saldo;
- Toast em pt-BR;
- Console limpo;
- Supabase preenchendo `account_plan_code`, origem/destino e flags pelo trigger.
