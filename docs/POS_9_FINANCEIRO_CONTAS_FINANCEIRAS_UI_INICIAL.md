# POS_9 - Financeiro - Contas financeiras - UI inicial

## Status

Tela inicial criada para cadastro de contas financeiras.

## Arquivos alterados/criados

- `src/pages/private/admin/settings/financialAccounts/FinancialAccountsSettingsPage.tsx`
- `src/AppRoutes.tsx`

## Commits

- `3b170b85b187fb11144d4967c2d2eac4d69dc14f` — cria tela contas financeiras
- `5fc87817bda3bce8c677e3b5b4d34fd4a30884a4` — adiciona rota contas financeiras

## Rota inicial

- `/admin/financial-accounts`

## Permissao inicial

A rota usa:

- `cashbook.view`

As operacoes de escrita continuam protegidas no backend por:

- owner;
- `cashbook.create`.

Permissoes granulares futuras sugeridas:

- `cashbook.accounts.view`;
- `cashbook.accounts.manage`.

## Recursos da tela

A tela permite:

- listar contas financeiras;
- mostrar contas ativas e inativas;
- criar nova conta;
- editar conta existente;
- marcar conta como padrao do tipo;
- ativar/desativar conta;
- agrupar contas por tipo.

## Tipos disponiveis

- caixa fisico;
- cofre;
- banco;
- carteira Pix;
- maquininha;
- recebiveis de cartao;
- proprietario;
- outro.

## Observacao

Esta primeira entrega ficou como rota propria para reduzir risco de alterar a tela grande de Configuracoes.

Proximo passo recomendado:

- criar atalho/menu para a rota;
- depois avaliar encaixar como aba `Financeiro` dentro de Configuracoes.

## Validacao sugerida

1. Rodar `git pull`.
2. Rodar `npm run build`.
3. Acessar `/admin/financial-accounts`.
4. Conferir contas padrao e `Caixa Teste`.
5. Criar uma conta nova, por exemplo `Banco Teste`.
6. Editar nome/tipo.
7. Desativar e reativar.
8. Conferir console limpo.
