# OptmaMenu — Vendas realizadas → detalhe → estoque → financeiro

Data: 2026-08-23

## Objetivo

Transformar `Comercial → Vendas` em um ponto confiável para conferir uma venda concluída sem procurar as mesmas informações em várias telas.

A venda passa a ter rota de detalhe própria:

`/admin/sales/:saleId`

A tela reúne a mesma venda em quatro dimensões:

1. pedido/comercial;
2. itens e snapshot de preço;
3. reserva/baixa física/divergência de estoque;
4. Livro Diário/forma de recebimento/conta financeira/histórico de reclassificação.

## Backend autoritativo

Foi criada a RPC:

`get_sale_detail_safe(store_id, order_id)`

Ela valida a loja e `orders.view/orders.manage` e só entrega estoque ou financeiro quando o usuário também possui as permissões correspondentes.

O frontend não reconstrói vínculos por heurística. São usados os relacionamentos já persistidos por `order_id` em:

- `order_items`;
- `stock_movements`;
- `stock_reservations`;
- `stock_discrepancy_occurrences`;
- `cashbook_entries`;
- `cashbook_payment_route_audit`.

## Tela de detalhe

A primeira entrega exibe:

- código da venda e status;
- canal e tipo de atendimento;
- cliente/snapshot eventual;
- forma específica de pagamento e status;
- bruto, desconto e total;
- itens, quantidade, preço-base, preço aplicado e origem da regra;
- link para Vida do Produto;
- baixa física por item, local e saldo anterior → novo saldo;
- reservas e estado de consumo;
- divergências vinculadas;
- lançamento do Livro Diário;
- conta financeira de destino/origem;
- forma efetivamente recebida;
- histórico de ajuste da rota financeira;
- checklist visual Venda / Pagamento / Estoque / Financeiro.

## Integridade validada em HML

Na leitura realizada em 2026-08-23 para a Gelinhares:

- vendas concluídas: 46;
- sem itens: 0;
- sem financeiro: 0;
- diferença entre valor da venda e financeiro: 0;
- sem baixa física vinculada: 1 registro histórico.

O único registro sem baixa física é uma venda histórica de maio/2026 com `completed_at` ausente. Ele deve permanecer como exceção histórica para investigação, sem backfill automático por inferência.

A RPC foi testada contra venda real de HML com múltiplos itens e retornou, de forma coerente, itens, sete movimentações físicas, sete reservas consumidas e lançamento financeiro vinculado.

## Checklist automatizado

Arquivo somente leitura:

`scripts/homologation/sql/08_completed_sales_stock_finance_integrity.sql`

Ele mede:

- venda concluída sem itens;
- venda concluída sem baixa física;
- venda concluída sem financeiro;
- valor financeiro diferente do total da venda;
- exceções para investigação;
- ausência de `EXECUTE` da RPC para `anon`.

## Continuidade

Depois da primeira homologação visual desta página, a mesma rota deve absorver progressivamente as ações que alteram a vida de uma venda, especialmente cancelamento/estorno, sem criar fluxos paralelos que percam o vínculo entre pedido, estoque e financeiro.
