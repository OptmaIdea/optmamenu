# Backlog futuro — Devoluções e trocas com fornecedores

**Origem:** observação na frente Correções Pré-Testes Finais, 18/10/2026.
**Estado:** ideia registrada; **não implementada**. A frente atual permanece concentrada na estabilização das telas de Estoque e Vida do Produto.

## Motivação e casos de uso
- **Devolução por excesso:** lojista devolve ao fornecedor unidades que já estavam no estoque, eventualmente por negociação comercial.
- **Devolução por circunstância específica do cliente:** retorno de produtos ao fornecedor conforme condições comerciais acordadas; avaliar elegibilidade, validade e rastreabilidade.
- **Troca simples:** sair do estoque com X unidades e receber reposição do mesmo produto, verificando quantidades, lotes/validade quando aplicável e eventual diferença de valores.
- **Troca por outros produtos:** entregar mercadoria A e receber B/C, refletindo entrada e saída por produto/local e apuração do saldo financeiro.
- **Diferença financeira:** crédito do fornecedor, complemento a pagar, devolução de dinheiro ou abatimento em obrigação futura; necessidade de conciliação.

## Integração com o que já existe (evitar autoridade duplicada)

A central /admin/stock/divergences já trata **ressalvas de recebimento de compras**, com tipos `shortage`, `damage`, `wrong_item`, `excess`, `other` e destinos operacionais `awaiting_replacement`, `discount`, `supplier_credit`, `partial_return`, `accepted_closed`, `other`.

A nova frente não pode recriar esse fluxo sob outro nome: precisa relacionar uma operação posterior ao recebimento com a compra original, seu documento, possíveis ressalvas anteriores e os lançamentos financeiros existentes. Os eventos devem aparecer na Vida do Produto por meio de leitura/consulta, não como outra autoridade de estoque.

## Desenho inicial proposto — sujeito a aprovação
1. Solicitação: fornecedor, compra/referência, produto, local, quantidade, motivo, tipo (devolução/troca), responsável, condição do material.
2. Aprovação: verificar permissões, quantidade fisicamente disponível, reservas e regras de devolução; não permitir devolver estoque comprometido.
3. Saída física: registrar somente quando a mercadoria efetivamente sair do estabelecimento; status documental independente de saldo.
4. Recebimento da troca: receber e conferir os novos produtos, incluindo recebimento parcial e divergências, sem creditar estoque antecipadamente.
5. Acerto financeiro: base de valores acordados, descontos, frete e tributos/documentos fiscais conforme aplicáveis; diferença positiva a pagar ou negativa a creditar; conciliar sem receita/despesa fictícia.
6. Auditoria: cada evento com usuário, timestamp, documento, local, quantidade, motivo, aprovação e relação com o fornecedor; movimentos idempotentes e compensação segura.
7. UI: cards compactos e expansíveis em mobile/tablet, vínculo com a Vida do Produto, histórico navegável e áreas de conferência separadas.

## Critérios de aceitação futuros
- Devolução integral/parcial, troca 1:1, troca por produto diferente, complemento a pagar e crédito de fornecedor.
- Estoque de origem somente baixa quando despachado; estoque recebido somente entra após conferência.
- Reserva de cliente não pode ser consumida por devolução indevida.
- Documento de compra original não deve ser apagado ou sobrescrito para simular devolução.
- Livro Diário / Livro Caixa / contas a pagar e receber coerentes, sem duplicar lançamentos ou saldos.
- Ajustes, cancelamentos e divergências auditáveis e com permissões.
- GitHub Actions e Vercel READY, reteste de operação real em homologação.

## Informação relevante da frente Vida do Produto

Em 18/10/2026, a aba **Movimentações** já lista entradas e cancelamentos de compras, ajustes, reservas, transferências e divergências de transferência. **Divergências de recebimento de compras e divergências físicas de vendas não aparecem ali como registros de ocorrência classificados.** Esses registros estão na central de Divergências e precisam de agregação read-only ao histórico do produto numa etapa futura, sem permitir tratamento duplicado.

**Não autoriza execução agora.** Abrir frente específica quando o escopo das correções pré-testes finais estiver estabilizado.
