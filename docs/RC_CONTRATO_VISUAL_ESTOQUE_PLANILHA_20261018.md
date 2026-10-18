# Contrato visual — Estoque (base: formato do estoque.xlsx)

Análise da aba Planilha1, A2:O31, recebida em 18/10/2026.

Tabela agrupada por produto, linhas dos locais sob expansão. Ordem do cabeçalho: Produto/Local; Estoque total; Reservado; Em rota de entrega; Transferências (Enviando/Recebendo); Estoque disponível; Mín; Máx; Status. Ícones de situação: zerado, abaixo do mínimo, normal e excedente. Legendas e ⓘ por toque/foco; tabela arrastável horizontalmente em telas estreitas.

**Significados preservados:** Enviando é transferência entre locais já expedida; Recebendo é remessa a receber ainda não utilizável; Em rota de entrega é pedido de cliente despachado. A disponibilidade prevista da linha do local aparece entre parênteses quando há Recebendo. Origem/destino e documento permanecem consultáveis nas telas de detalhe.

**Regra de integridade:** os saldos de estoque exibidos são de `get_inventory_position_by_store` e do modelo físico auditado. A saída física por transferência e entrega já é registrada na origem no seu evento respectivo; subtrair de novo o Enviando/Em rota quebraria a contabilidade física. A previsão entre parênteses soma o Recebendo somente para projeção (não libera estoque). A nota A2:O2 da planilha requer desconto de Enviando, mas o exemplo Abacate D4:I4 (279,3,7,5,5,269) não o desconta (279-3-7=269 versus 264). Este conflito não cria uma nova regra de estoque.

**Status:** classificado pela disponibilidade atual nas linhas produto; na linha local usa a disponibilidade prevista (entre parênteses) se houver remessa a receber, com tooltip indicando explicitamente a previsão. Quando não há mín/máx configurados, status sem regra (não inventar 0). A legenda da planilha mostra ⛔ zerado, ❎ abaixo do mínimo, ✅ normal, ❗ excedente; UI usa ícones Lucide equivalentes com cor e descrição.

**Cenários:** Planilha cita Abacate, Abacaxi repetido, Groselha, Tangerina, Tapioca, Tentação, Tutti fruti e Uva. Loja Bicas aparece apenas como **exemplo fictício**, não foi criada no banco. Quantidades da planilha não devem substituir saldos reais do Supabase.

Evoluções em outras telas (Vida do Produto, movimentações, transferências) ficam para a frente posterior. Este pacote apenas fixa o padrão visual de referência.
