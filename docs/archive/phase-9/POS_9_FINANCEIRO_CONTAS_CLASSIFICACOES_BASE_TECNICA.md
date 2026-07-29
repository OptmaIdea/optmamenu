# POS_9 - Financeiro - Contas e classificacoes - Base tecnica

## Status

Base tecnica criada para separar caixa fisico, contas financeiras e classificacoes de lancamentos.

## Migrations criadas

- `supabase/migrations/20260703013000_create_cashbook_accounts_base.sql`
- `supabase/migrations/20260703013500_seed_cashbook_account_plan.sql`
- `supabase/migrations/20260703014000_seed_store_financial_accounts.sql`

## Validacao criada

- `docs/sql_diagnostics/validate_cashbook_accounts_base.sql`

## Objetivo

Preparar o Livro Diario para diferenciar:

- movimento financeiro;
- caixa fisico;
- contas financeiras;
- transferencias internas;
- entradas;
- saidas;
- ajustes.

## Tabelas criadas

### `cashbook_account_plan`

Plano simples de categorias.

Exemplos:

- venda em dinheiro;
- venda Pix;
- reposicao de divergencia;
- reforco de troco;
- despesa operacional;
- caixa para cofre;
- banco para caixa;
- troca de cedulas e moedas.

### `store_financial_accounts`

Contas ou locais financeiros da loja.

Exemplos:

- caixa fisico;
- cofre;
- banco principal;
- carteira Pix;
- maquininha;
- recebiveis de cartao;
- proprietario.

## Campos adicionados em `cashbook_entries`

- `account_plan_code`;
- `source_financial_account_id`;
- `destination_financial_account_id`;
- `is_transfer`;
- `transfer_group_id`;
- `affects_cash_drawer`;
- `affects_financial_result`.

## Importante

Esses campos sao opcionais.

A migration nao muda o calculo atual do Livro Diario.

Ela apenas cria a base para evoluir a tela e as regras.

## Proximas etapas

1. Classificar automaticamente novos lancamentos.
2. Ajustar reposicao de divergencia para marcar categoria e conta.
3. Criar transferencias internas no fechamento.
4. Separar saldo fisico do caixa e movimento financeiro na UI.
5. Preparar zeramento operacional das formas que nao ficam no caixa fisico.
