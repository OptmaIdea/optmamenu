# POS_9 - Financeiro - Contas financeiras - Menu lateral

## Status

Rota e tela ja existem.

Rota:

```txt
/admin/financial-accounts
```

Tela:

```txt
src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx
```

## Ajuste pendente

Adicionar item visual no menu lateral, dentro do grupo Financeiro.

## Local

Arquivo:

```txt
src/components/layouts/PrivateLayout.tsx
```

Objeto:

```txt
navigationItems.financial
```

## Item a adicionar

```txt
path: /admin/financial-accounts
icon: Building
label: Contas financeiras
permission: cashbook.view
```

## Resultado esperado

Menu Financeiro:

```txt
Livro diário
Contas financeiras
```

## Validacao

Depois da alteração:

```txt
npm run build
```

Conferir:

- item aparece no menu Financeiro;
- clique abre /admin/financial-accounts;
- console limpo.
