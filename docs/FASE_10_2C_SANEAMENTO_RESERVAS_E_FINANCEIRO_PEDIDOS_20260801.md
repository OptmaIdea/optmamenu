# Fase 10.2C — Saneamento de reservas e financeiro de pedidos

Data: 01/08/2026

## Escopo executado

Foram aplicadas no projeto Supabase `lgkkfmqzaorrutuoqeax` as migrations:

- `reconcile_reservations_and_backfill_completed_order_cashbook`;
- `fix_public_order_cashbook_completion_and_pending_receivables`.

## Reservas por local

Foi criada a função autoritativa:

```sql
public.reconcile_inventory_reservations(
  p_store_id uuid default null,
  p_apply boolean default false
)
```

A função calcula o reservado esperado usando apenas reservas:

- com `status = active`;
- ainda não expiradas;
- ligadas a pedidos em `reserved`, `confirmed` ou `ready`;
- pertencentes à mesma loja, local e produto.

Quando `p_apply = true`, o valor de `inventory_location_balances.reserved` é reconciliado e o total de `inventory_balances.reserved` é recomposto pela soma dos locais.

Foi criada a tabela de auditoria:

```text
inventory_reservation_reconciliation_audit
```

Ela registra saldo anterior, saldo esperado, diferença, produto, local, loja, executor e data.

### Correção aplicada na Loja SJN

Foram removidas reservas materializadas sem reserva ativa correspondente:

| Produto | Antes | Depois |
|---|---:|---:|
| Abacate | 3 | 0 |
| Acerola | 2 | 0 |
| Amendoim | 2 | 0 |
| Graviola | 9 | 0 |
| Menta | 5 | 0 |

Diferença líquida reconciliada: `-21` unidades reservadas.

As funções de cancelamento de reserva e expiração foram ajustadas para executar reconciliação após alterar o estado das reservas.

## Financeiro de pedidos concluídos

Foi corrigida `create_cashbook_entry_from_order(uuid)` para distinguir:

- pagamento confirmado na finalização: lançamento `confirmed`, com impacto no saldo;
- pagamento ainda não confirmado e método que não afeta caixa: lançamento `pending`, sem impacto no saldo;
- chamadas repetidas: retorno idempotente sem duplicar lançamento.

A confirmação operacional registrada em `payment_metadata.confirmed_in_finalization = true` passa a prevalecer sobre o snapshot inicial `Pagar na retirada`.

Também foi incluído em `cashbook_entries.metadata`:

```json
{
  "sales_channel": "public_store",
  "fulfillment_type": "pickup",
  "origin_detail": "Loja online · Retirada"
}
```

## Backfill confirmado

Os pedidos de 31/07/2026 sem lançamento financeiro receberam entradas idempotentes:

| Pedido | Forma | Valor | Estado financeiro | Origem |
|---|---|---:|---|---|
| PED-20260731-005119-E011 | Pix | R$ 28,25 | Confirmado | Loja online · Retirada |
| PED-20260731-152856-40F8 | Pix | R$ 42,00 | Confirmado | Loja online · Retirada |
| PED-20260731-164856-3559 | Pix | R$ 29,25 | Confirmado | Loja online · Retirada |
| PED-20260731-173351-1CE8 | Cartão de crédito | R$ 92,00 | Confirmado | Loja online · Retirada |

Total recomposto no Livro Diário: **R$ 191,50**.

## Próximas validações

1. confirmar os lançamentos no Livro Diário com período incluindo 31/07/2026;
2. criar um novo pedido público e validar reserva → confirmação → conclusão → cashbook;
3. testar cancelamento e expiração de reserva;
4. retestar as transferências bloqueadas anteriormente;
5. melhorar mensagens de saldo insuficiente e filtros de transferências;
6. implementar alerta visual e sonoro para chegada de pedido online.

## Observação de versionamento

As migrations foram aplicadas diretamente ao projeto Supabase e devem permanecer espelhadas no diretório `supabase/migrations` antes do fechamento definitivo da PR, preservando reprodutibilidade do ambiente.
