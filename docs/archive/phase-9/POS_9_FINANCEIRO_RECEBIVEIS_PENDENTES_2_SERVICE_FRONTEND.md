# POS_9 — Financeiro — Recebiveis pendentes — Service frontend

## Status

Implementado.

## Contexto

O diagnostico de recebiveis pendentes confirmou que existem pedidos/vendas com pagamento pendente e que eles nao afetam o saldo do Livro Caixa.

Exemplos recentes de candidatos:

- `PED-20260630-122908-2D73`;
- `PED-20260630-121716-7064`;
- `PED-20260630-092805-35D3`.

Todos aparecem com:

- `payment_method_code = pending` ou `payment_method = pending`;
- `already_affects_cashbook = false`.

## Arquivo alterado

- `src/services/cashbookService.ts`

Commit:

- `a73f4faaaeec753e56320e6c5482008a532e060f`

## O que foi adicionado

Foi criado o tipo:

- `ConfirmPendingPaymentInput`

E o metodo:

- `CashbookService.confirmPendingPayment(input)`

## RPC chamada

O service chama:

- `confirm_pending_order_payment_safe`

Parametros enviados:

- `p_store_id`;
- `p_order_id`;
- `p_payment_method_code`;
- `p_received_at`;
- `p_notes`;
- `p_metadata`.

## Regra

O service nao faz update direto em `orders` ou `cashbook_entries`.

A confirmacao passa pela RPC segura para preservar:

- permissao;
- consistencia;
- auditoria;
- prevencao de duplicidade.

## Proxima etapa

Adicionar na tela `Livro diario` uma acao visivel somente quando o lancamento for venda pendente:

- `Confirmar recebimento`.

A acao deve permitir escolher a forma real de pagamento, chamar o service e recarregar os dados do caixa.
