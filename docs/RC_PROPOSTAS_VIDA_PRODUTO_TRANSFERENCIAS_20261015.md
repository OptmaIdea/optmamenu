# OptmaMenu — Hipóteses de apresentação da Vida do Produto e Estoque (15/10/2026)

## Fonte
Proposta elaborada a partir da imagem de planilha enviada nesta conversa e do pedido de interface otimizada para mobile/tablet. Não altera a fórmula de saldos do backend.

## Princípios
- Em telas estreitas, uma linha por produto ou evento, resumo de poucas métricas, botão `↓/↑` para abrir informações adicionais e `Expandir tudo / Recolher tudo`.
- Quando não filtrado, **um produto = um agrupamento**; linhas de locais só aparecem após expandir; filtro por local faz o nome do local virar título e os produtos aparecerem abaixo.
- Separar: físico, reservado, disponível para venda, em trânsito **entre estoques**, em rota **para cliente**, e estoque online quando houver regra publicada. Não somar transferências a receber no disponível atual.
- A transferência já baixa o físico na origem no ato de enviar: não subtrair o enviado outra vez. Mostrar o valor enviado como indicador de movimentação.
- Mín/Máx por local ou global só quando a configuração correspondente estiver presente; caso contrário, mostrar `não configurado`, não 0 artificial.
- Classificações de estado devem usar nível correto (global versus local) e respeitar real estado do estoque.

## Proposta de narrativa de cada transferência
**Origem — Estoque Principal / TRF-...**
- Rascunho: sem baixa; resumo "30 solicitados"; detalhes documento, data, itens e responsável.
- Enviado: "104 enviados", data/hora, físico antes 294 (somente se histórico comprovado), saída 104 e físico após 190. Indicador "em trânsito para destino 104" é informativo, sem outra baixa.
- Encerrado com retorno de 3: "Enviados 104, recebidos no destino 101, devolvidos à origem 3" e físico final 193, se não houve outras operações no intervalo.
- Encerrado com perda de 3: "Enviados 104, recebidos 101, perda 3" e físico final 190 (na mesma condição, sem outras operações).
- Motivo e resolução no detalhe expandido; arquivo/documento e linha temporal de estoque auditável.

**Destino — Loja SJN / TRF-...**
- Antes do envio: não exibir estoque em trânsito como disponível.
- Enviado/a receber: "104 a caminho" e disponível atual inalterado.
- Recebido integralmente: efetivar entrada física de 104 e registrar data/hora.
- Recebido parcialmente: "101 recebidos; divergência 3" e creditar **somente** 101 ao físico do destino. Ao expandir, mostrar se a diferença retornou, foi perda ou falta aceita.

Esses números são **hipóteses de ilustração**, não histórico apurado para a TRF real. Não inferir saldo antes/depois a partir do saldo atual; usar snapshots/movimentações confiáveis.

## Caso confirmado da TRF de teste
`TRF-20261015-144225-589`: Abacate, 30 enviados, 27 recebidos, divergência 3, resolução perda/avaria, motivo quebra, sem retorno. Esta é uma ocorrência **já tratada na conferência**. A central deve fornecer link ao histórico, não oferecer resolução duplicada.

## Ideias visuais para sequência
- Cabeçalhos/tabelas ordenáveis pelo título das colunas úteis (físico, reservado, disponível, trânsito, nome, situação); mínimo/máximo normalmente só informação, sem filtro obrigatório.
- Resumos progressivos por contexto: produto, local, transferência/ocorrência, cliente em rota (conceitos separados).
- Badges acessíveis em claro/escuro; divergência âmbar sem texto de baixo contraste.
- Estados responsivos sem linhas duplas de tabela; filtros compactos recolhíveis após seleção, com contador e limpar filtros visíveis.
- A tela inicial agrupada já foi parcialmente implementada; detalhes de Vida do Produto por evento ainda **pendentes de implementação e reteste**.
