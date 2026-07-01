# POS_9 - Financeiro - Recebiveis pendentes - Correcao RPC e decisao por abas

## Status

Correcao backend preparada e decisao de UX registrada.

## Contexto

A tela do Livro Diario foi alterada para incluir Pendentes de recebimento.

Commit local informado pelo usuario:

- `6a3bcfd117bd288e80c9d96d3be9d3174f7207e7`

Build:

- OK.

Ao tentar confirmar um pendente, ocorreu o erro:

```txt
column "updated_at" of relation "orders" does not exist
```

## Causa

A RPC `confirm_pending_order_payment_safe` tentava atualizar:

- `orders.updated_at`.

Mas a tabela `orders` nao possui essa coluna.

## Correcao criada

Arquivo:

- `supabase/migrations/20260701035500_fix_confirm_pending_order_payment_no_updated_at.sql`

Commit:

- `499476394dffdad0cc723360400b1366624b347f`

## O que a correcao faz

Recria a RPC `confirm_pending_order_payment_safe` sem atualizar `orders.updated_at`.

A auditoria permanece registrada em:

- `payment_metadata`;
- `commercial_metadata`;
- `metadata`.

## Decisao de UX

Pendentes de recebimento nao devem ficar como bloco acima dos lancamentos.

Ficou pouco intuitivo porque compete com a leitura principal do Livro Diario.

Nova direcao:

```txt
Livro Diario
- Aba Lancamentos
- Aba Pendentes de recebimento
```

## Regras da aba Pendentes de recebimento

A aba deve:

- listar apenas vendas/pedidos pendentes;
- mostrar total pendente;
- permitir escolher forma real de pagamento;
- confirmar recebimento pela RPC segura;
- recarregar dados apos sucesso;
- nao interferir no modo Livro/Extrato dos lancamentos.

## Regras da aba Lancamentos

A aba Lancamentos deve manter:

- cards de resumo;
- modo Livro;
- modo Extrato;
- filtros por periodo/status/cliente;
- historico normal do caixa.

## Validacao esperada apos aplicar SQL

1. Aplicar migration `20260701035500_fix_confirm_pending_order_payment_no_updated_at.sql`.
2. Reabrir Livro Diario.
3. Confirmar um pendente com forma real de pagamento.
4. Esperado:
   - sem toast de erro;
   - item sai de Pendentes;
   - pagamento do pedido deixa de ser pending;
   - cashbook entry passa a `affects_balance=true` quando forma afeta caixa;
   - saldo passa a considerar o valor;
   - console limpo.

## Proximo ajuste frontend

Transformar o painel atual em aba.

Sugestao tecnica:

- criar estado `cashbookMainTab = 'entries' | 'receivables'`;
- renderizar `PendingReceivablesPanel` somente na aba `receivables`;
- manter lista/modes Livro e Extrato apenas na aba `entries`.
