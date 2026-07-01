# POS_9 - Financeiro - Recebiveis pendentes no Livro Diario

## Status

Componente isolado criado para encaixe seguro no Livro Diario de Caixa.

## Contexto

A decisao atual e manter os recebiveis pendentes dentro do proprio Livro Diario, sem criar um novo item no menu Financeiro nesta primeira versao.

Um modulo proprio de Recebiveis fica para versao posterior, quando o fluxo crescer.

## Arquivo criado

- `src/pages/private/admin/financial/cashbook/components/PendingReceivablesPanel.tsx`

Commit:

- `916468ea6dc5b4da1f76eb73e226ddf82ca9d716`

## Objetivo do componente

Exibir vendas/pedidos pendentes dentro do Livro Diario e permitir confirmar o recebimento usando a RPC segura ja criada.

## O que o componente faz

- filtra entradas de venda pendentes;
- mostra total pendente;
- mostra pedido, cliente, data e valor;
- permite escolher a forma real de pagamento;
- chama `CashbookService.confirmPendingPayment`;
- recarrega dados via `onConfirmed`;
- nao faz update direto em `orders` ou `cashbook_entries`.

## Criterio de pendente

O componente considera pendente quando:

- `entry.type = sale`;
- `entry.direction = in`;
- nao esta cancelado;
- tem `payment_method_code = pending`; ou
- tem `payment_method = pending`; ou
- tem `affects_balance = false`;
- possui `order_id`.

## Permissao

O componente recebe a prop:

- `canConfirm`.

Enquanto nao houver permissao granular definitiva, pode ser usada permissao existente do Livro Caixa, por exemplo:

- `cashbook.create`; ou
- `cashbook.manage`, se disponivel no projeto.

Futuro:

- criar permissao propria para oficializar recebiveis pendentes.

Sugestao futura:

- `cashbook.receivables.confirm`.

## Como encaixar no CashbookPage

No arquivo:

- `src/pages/private/admin/financial/cashbook/CashbookPage.tsx`

Adicionar import:

```tsx
import PendingReceivablesPanel from './components/PendingReceivablesPanel';
```

Depois, dentro do JSX principal, logo apos os cards superiores de resumo e antes da lista de lancamentos, adicionar:

```tsx
<PendingReceivablesPanel
  storeId={storeId}
  entries={entries}
  canConfirm={canCreateCashbookEntry}
  onConfirmed={loadData}
/>
```

## Validacao sugerida

1. Rodar `npm run build`.
2. Abrir Livro Diario.
3. Conferir se aparece a area Pendentes de recebimento.
4. Confirmar que pendentes nao afetam saldo antes da confirmacao.
5. Escolher forma real de pagamento.
6. Clicar em Confirmar.
7. Conferir toast de sucesso.
8. Conferir que o item sai dos pendentes.
9. Conferir que o saldo passa a considerar o valor.
10. Conferir console limpo.

## Observacao

O componente foi criado isolado para evitar sobrescrever o layout novo do Livro Diario, que foi alterado recentemente e validado com build e console limpos.
