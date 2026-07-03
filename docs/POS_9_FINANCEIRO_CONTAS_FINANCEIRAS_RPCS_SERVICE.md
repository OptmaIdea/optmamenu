# POS_9 - Financeiro - Contas financeiras - RPCs e service

## Status

Primeira camada funcional criada para cadastro de contas financeiras.

## Migration criada

- `supabase/migrations/20260703015500_financial_accounts_rpcs.sql`

Commit:

- `62c754bc45486bf490bf8e2681277b04f68ba14c`

## Service criado

- `src/services/financialAccountsService.ts`

Commit:

- `6e246e56e67019f7a39f85bf9b6ad328f35d07a0`

## Validacao criada

- `docs/sql_diagnostics/validate_financial_accounts_rpcs.sql`

Commit:

- `48ab539f7657fd41159f7d8cd4cc1bb57bbfd702`

## RPCs criadas

### Listar contas

- `list_store_financial_accounts_safe`

Lista contas financeiras da loja, com opcao de incluir inativas.

### Criar/editar conta

- `upsert_store_financial_account_safe`

Cria ou atualiza uma conta financeira da loja.

Campos principais:

- loja;
- id opcional;
- codigo;
- nome;
- tipo;
- descricao;
- padrao;
- ativo;
- ordem.

### Ativar/desativar conta

- `set_store_financial_account_active_safe`

Altera apenas o status ativo/inativo.

## Service frontend

Criado `FinancialAccountsService` com metodos:

- `list(storeId, includeInactive)`;
- `save(input)`;
- `setActive(storeId, accountId, active)`.

## Permissoes atuais

Leitura:

- owner;
- `cashbook.view`;
- `cashbook.create`.

Escrita:

- owner;
- `cashbook.create`.

Permissoes futuras sugeridas:

- `cashbook.accounts.view`;
- `cashbook.accounts.manage`.

## Proxima etapa

Criar UI em:

- Configuracoes > Financeiro > Contas financeiras.

A tela deve permitir:

- listar;
- criar;
- editar;
- desativar;
- reativar;
- marcar padrao.
