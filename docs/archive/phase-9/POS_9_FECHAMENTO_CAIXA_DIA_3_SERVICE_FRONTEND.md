# POS_9 - Financeiro - Fechamento do caixa do dia - Service frontend

## Status

Service frontend implementado.

## Contexto

A validacao da previa de fechamento retornou `ok=true` para `2026-07-01`, com totais esperados:

- Pix: R$ 7,50;
- Debito: R$ 29,75;
- Credito: R$ 11,25;
- Total: R$ 48,50;
- Pendentes: R$ 0,00;
- Cancelados: R$ 0,00.

Isso confirmou que a RPC de previa esta operacional.

## Arquivo alterado

- `src/services/cashbookService.ts`

Commit:

- `7a418733550b04ebf433f959ea6f8278625d6bd9`

## Tipos adicionados

- `CashbookDayClosingExpected`;
- `CashbookDayClosingPreview`;
- `CashbookDayClosing`;
- `SaveCashbookDayClosingInput`.

## Metodos adicionados

### `CashbookService.getDayClosingPreview(storeId, closingDate)`

Chama:

- `get_cashbook_day_closing_preview_safe`.

Retorna:

- esperados por forma de pagamento;
- pendentes;
- cancelados;
- fechamento existente, se houver.

### `CashbookService.saveDayClosing(input)`

Chama:

- `save_cashbook_day_closing_safe`.

Envia:

- loja;
- data;
- denominacoes contadas;
- dinheiro contado;
- Pix conferido;
- debito conferido;
- credito conferido;
- outros conferidos;
- observacao;
- status `draft` ou `closed`;
- metadata.

Retorna:

- registro de fechamento salvo.

## Regra mantida

O front nao calcula o esperado como fonte de verdade.

A fonte de verdade continua sendo a RPC:

- `get_cashbook_day_closing_preview_safe`.

O front apenas coleta valores conferidos e envia para a RPC de salvamento.

## Proxima etapa

Criar componente/tela inicial para Fechamento do caixa do dia.

Sugestao inicial:

- area dentro do Livro Diario;
- aba ou card separado `Fechamento do dia`;
- data selecionavel;
- cards de esperado;
- tabela de cedulas/moedas;
- campos Pix/Debito/Credito/Outros;
- diferencas em tempo real;
- botao salvar rascunho;
- botao fechar caixa.
