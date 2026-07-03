# POS_9 - Financeiro - Contas financeiras - Rota inicial

## Status

A tela de contas financeiras foi criada e a rota inicial foi adicionada.

## Arquivos envolvidos

- `src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx`
- `src/AppRoutes.tsx`

## Rota disponivel

- `/admin/financial-accounts`

## Permissao inicial

A rota usa:

- `cashbook.view`

As escritas seguem protegidas pelas RPCs:

- owner;
- `cashbook.create`.

## Observacao

Ainda falta adicionar item visual no sidebar ou encaixar como aba em Configuracoes.

Por seguranca, a primeira entrega ficou como rota direta.

## Proximo ajuste recomendado

Adicionar atalho visual em uma destas opcoes:

1. Menu lateral > Financeiro > Contas financeiras;
2. Configuracoes > aba Financeiro > Contas financeiras;
3. Link/atalho dentro do Livro Diario.

Preferencia operacional atual:

- Menu lateral > Financeiro > Contas financeiras;
- depois encaixar tambem em Configuracoes.

## Validacao sugerida

1. Rodar `git pull`.
2. Rodar `npm run build`.
3. Acessar `/admin/financial-accounts`.
4. Criar uma conta financeira real de teste.
5. Desativar e reativar.
6. Conferir console limpo.
