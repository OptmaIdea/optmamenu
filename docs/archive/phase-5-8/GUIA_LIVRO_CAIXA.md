# Guia — Livro Diário de Caixa

## Objetivo

O Livro Diário de Caixa registra entradas e saídas financeiras simples da operação. Ele não é conciliação bancária e não substitui extrato bancário. A proposta inicial é dar ao lojista uma visão prática de numerários, recebíveis e movimentações manuais.

## Tabela principal

A estrutura principal é `cashbook_entries`.

Campos importantes:

| Campo | Uso |
|---|---|
| `entry_code` | Código amigável do lançamento, como `CXA-...` |
| `entry_date` | Data do lançamento |
| `occurred_at` | Momento operacional |
| `type` | Tipo: venda, entrada manual, saída manual, ajuste etc. |
| `direction` | `in` ou `out` |
| `amount` | Valor |
| `description` | Descrição operacional |
| `payment_method_code` | Forma de pagamento |
| `order_id` | Pedido de origem, quando houver |
| `affects_balance` | Indica se afeta saldo |
| `status` | `draft`, `confirmed` ou `cancelled` |

## Lançamentos automáticos por venda

Quando um pedido é concluído com forma de pagamento que afeta o caixa, o sistema cria entrada automática.

Exemplos que afetam caixa:

- Dinheiro
- PIX
- Cartão de débito
- Cartão de crédito

Exemplo que pode não afetar caixa:

- A combinar / pendente

## Entradas e saídas manuais

Os botões “Nova entrada” e “Nova saída” ficaram registrados como melhoria futura. Quando implementados, devem permitir:

- registrar receita avulsa;
- registrar despesa avulsa;
- registrar ajustes;
- anexar notas internas;
- associar forma de pagamento;
- manter trilha de auditoria.

## Diferença para conciliação bancária

O Livro de Caixa atual é operacional e simples.

Não faz ainda:

- importação de extrato;
- conciliação automática;
- baixa por conta bancária;
- vínculo com adquirentes;
- controle fiscal/contábil completo.

Esses recursos podem virar módulo financeiro futuro.

## Boas práticas para o lojista

- Conferir diariamente entradas de vendas concluídas.
- Registrar despesas importantes como saída manual quando o recurso estiver disponível.
- Não apagar lançamentos: preferir cancelar/estornar para manter histórico.
- Usar observações para explicar ajustes.

## Ajustes futuros

- Habilitar botões “Nova entrada” e “Nova saída”.
- Filtros por período, método e tipo.
- Exportação PDF/relatório impresso.
- Saldos por conta/banco, sem conciliação no primeiro momento.
- Dashboard financeiro simples.
