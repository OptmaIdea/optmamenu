# Fechamento de caixa, divergências de estoque e conciliação futura

Data: 24/07/2026

## Problemas tratados

### Fechamento de 22/07

O dia tinha R$ 46,00 de entradas em dinheiro e R$ 50,00 de saída manual em dinheiro. O movimento líquido foi de -R$ 4,00.

A implementação anterior utilizava esse movimento líquido como se fosse o valor físico esperado na gaveta. Isso produzia três efeitos incorretos:

1. contar cédulas aumentava a diferença;
2. o fechamento tentava persistir um valor esperado negativo;
3. a constraint `cashbook_day_closings_amounts_non_negative` impedia o salvamento.

O novo contrato separa:

- fundo de abertura / troco inicial;
- movimento em dinheiro do dia;
- saldo físico esperado na gaveta;
- saída não coberta pelo fundo registrado.

A fórmula operacional é:

`esperado na gaveta = max(fundo de abertura + movimento em dinheiro, 0)`

Quando o resultado bruto é negativo, o fechamento continua com valores monetários não negativos e abre uma ocorrência para a saída não coberta. O operador precisa informar observação.

O fundo sugerido vem da contagem do último caixa fechado, mas permanece editável, porque a aplicação ainda não possui uma operação formal de abertura de caixa.

### Filtro por data

A data operacional `cashbook_entries.entry_date` passa a ser a autoridade. O frontend não reconverte a data para UTC e a RPC de período filtra diretamente por `date`. Isso evita que lançamentos noturnos no fuso de São Paulo apareçam no dia seguinte.

### Divergências de estoque do PDV

Vendas concluídas com `allow_stock_exception` já geravam `audit_logs.action = 'pdv_stock_exception'`, mas não existia uma fila de tratamento.

A nova estrutura `stock_discrepancy_occurrences` sincroniza essas auditorias e oferece:

- estados Aberta, Em análise, Aguardando contagem, Resolvida e Cancelada;
- venda, operador, local, produtos, solicitado, disponível e diferença;
- tipo de resolução;
- observação obrigatória no encerramento;
- trilha de auditoria para cada atualização;
- RLS e permissões `stock.view`, `stock.manage` e `stock.adjust`;
- atualização Realtime.

A resolução não altera o saldo automaticamente. Contagem física, perda, erro de cadastro e item localizado exigem decisões distintas e devem ser lançados pelos fluxos próprios de estoque.

## Evolução registrada: conciliação financeira do PDV

O atendimento no PDV deve permanecer rápido. A venda pode continuar usando classificação e conta financeira padrão com base na forma de pagamento.

Será criada posteriormente uma fila de conciliação financeira para revisar e, quando necessário, reclassificar:

- forma de pagamento efetivamente recebida;
- motivo/plano de contas;
- conta financeira de origem ou destino;
- vínculo entre venda, lançamento de caixa e recebimento;
- divergências do fechamento por forma de pagamento;
- responsável, justificativa e histórico da reclassificação.

Essa conciliação é separada da divergência física de estoque e do fechamento da gaveta. Ela não deve bloquear a venda no pico.

## Arquivos e contratos

- `src/pages/private/admin/financial/cashbook/components/DayClosingPanel.tsx`
- `src/pages/private/admin/products/inventory/StockDiscrepanciesPage.tsx`
- `src/services/cashbookService.ts`
- `src/services/stockDiscrepancyService.ts`
- `supabase/migrations/20260724180000_fix_cashbook_and_stock_discrepancies.sql`
- `get_cashbook_day_closing_preview_safe`
- `save_cashbook_day_closing_safe`
- `list_cashbook_entries_by_period_safe`
- `list_stock_discrepancy_occurrences_safe`
- `resolve_stock_discrepancy_occurrence_safe`
