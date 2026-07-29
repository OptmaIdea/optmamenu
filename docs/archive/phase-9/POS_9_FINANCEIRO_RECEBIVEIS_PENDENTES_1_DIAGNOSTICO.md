# POS_9 — Financeiro — Recebiveis pendentes — Diagnostico 1

## Status

Diagnostico criado.

## Contexto

Depois do PDV rapido e da correcao do Livro Diario de Caixa, ficou definida a regra: pagamento recebido compoe saldo; pagamento pendente nao compoe saldo; pagamento pendente continua rastreavel como valor a receber.

A tela do Livro Caixa ja foi refinada com modo livro, modo extrato, agrupamento por periodo, separacao entre realizado e pendente, correcao de saldo anterior e labels amigaveis.

Commit validado pelo usuario:

- `d61658c34ecf7b2325adf16d4ed0da05e267f993`

## Diagnostico criado

Arquivo:

- `docs/sql_diagnostics/diagnose_cashbook_pending_receivables.sql`

Commit:

- `2ac54987a1f09b4cac9ab2a4f2f310347c4ddae6`

## O que verificar no Supabase

O diagnostico lista pedidos com pagamento pendente, lancamentos de caixa vinculados, resumo por loja, funcoes existentes e constraints relevantes de caixa e pedidos.

## Proxima necessidade

Criar fluxo seguro para recebiveis pendentes, permitindo listar pendencias, confirmar recebimento, escolher forma real de pagamento, gerar lancamento efetivo no Livro Caixa, atualizar o pedido e preservar auditoria.

## Proxima etapa recomendada

Rodar o diagnostico no Supabase e, com base nele, criar uma funcao segura para confirmar recebimento pendente.

A confirmacao nao deve ser feita por update direto no front. Deve passar por funcao/RPC para manter consistencia, permissoes e auditoria.
