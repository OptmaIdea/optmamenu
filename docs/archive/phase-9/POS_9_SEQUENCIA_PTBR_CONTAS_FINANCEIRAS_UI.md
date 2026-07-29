# POS_9 — Sequência própria — PT-BR e UX de contas financeiras

## Motivo

Durante a retomada do financeiro/caixa, foi validado que todas as informações exibidas ao usuário precisam estar em português do Brasil, inclusive códigos técnicos de plano de contas, contas financeiras, tipos, status, booleanos e métodos de pagamento.

Também foi identificado um ajuste de UX na tela `Financeiro > Contas financeiras`:

```txt
Ao clicar para editar uma conta, o editor abre acima da lista inteira.
O comportamento desejado é abrir em modal ou editar inline no próprio item/card selecionado.
```

## Regra obrigatória

```txt
Nenhuma informação técnica deve aparecer crua para o usuário final quando houver equivalente em pt-BR.
```

Exemplos que devem ser traduzidos na interface:

```txt
cash_drawer        -> Caixa físico
safe               -> Cofre
bank_main          -> Banco principal
pix_wallet         -> Carteira Pix
card_acquirer      -> Maquininha
card_receivable    -> Recebíveis de cartão
owner              -> Proprietário
change_float_reinforcement -> Reforço de troco
closing_replenishment      -> Reposição de divergência
true               -> Sim
false              -> Não
```

## Helper criado

Arquivo criado para centralizar os labels em pt-BR:

```txt
src/utils/finance/ptBrFinancialLabels.ts
```

Funções disponíveis:

```txt
getCashbookAccountPlanLabel
getFinancialAccountTypeLabel
getFinancialAccountCodeLabel
getCashbookKindLabel
getCashbookDirectionLabel
getPaymentMethodPtBrLabel
getCashbookEntryTypeLabel
getCashbookStatusLabel
getBooleanPtBrLabel
formatFinancialAccountOptionLabel
formatCashbookCategoryOptionLabel
```

## Próximos usos esperados

### 1. Livro Diário

Usar os helpers no modal `Nova Entrada` / `Nova Saída` para:

- exibir categorias em pt-BR;
- exibir contas financeiras em pt-BR;
- exibir tipo/direção/status de forma amigável;
- evitar mostrar códigos técnicos como `cash_drawer`, `pix_wallet`, `change_float_reinforcement`.

### 2. Contas financeiras

Refatorar:

```txt
src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx
```

Ajustes esperados:

- usar helpers de pt-BR para tipo de conta e códigos padrão;
- remover labels técnicos da tela;
- trocar o editor superior por modal ou edição inline no card/linha selecionada;
- manter criação de nova conta clara e separada da edição;
- preservar console limpo e build limpo.

## Decisão de sequência

Esta sequência deve ser feita separadamente da primeira ligação do Livro Diário com categoria/conta financeira, para evitar misturar mudança de comportamento de lançamento com refatoração visual da tela de contas financeiras.
