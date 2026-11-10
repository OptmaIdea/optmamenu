# Vida do Produto — ocorrências operacionais, 18/10/2026

**Escopo: somente consulta.** A central `/admin/stock/divergences` continua responsável por tratar as ocorrências.

## Fontes
- Ressalvas de recebimento: `purchase_receipt_issues`, tipos falta, avaria, excesso ou item incorreto.
- Divergências físicas: `stock_discrepancy_occurrences`, com pedido/local, quantidades e tratamento.
- Transferências: o histórico anterior continua preservado e separado.

O RPC `get_product_operational_occurrences_safe(store_id,product_id)` é read-only; exige sessão, loja do produto e permissões compatíveis com a central. Apenas as ocorrências do produto escolhido são retornadas. Nenhum lançamento físico ou financeiro é efetuado.

## Interface
Na aba **Movimentações** existem os filtros adicionais **Ressalvas de compras** e **Divergências físicas**. Em **Todos os tipos**, os eventos entram cronologicamente entre movimentos e transferências. Cards recolhidos/expansíveis mostram motivo, status, quantidades, fornecedor/pedido e documentos. Links direcionam para a central, não executam tratamento.

## Reteste
1. Graviola: ressalva `RSV-20260905-8B5AFB1C`, aguardando documento.
2. Doce de leite: ressalva `RSV-20260905-0AED29CB`, aguardando financeiro.
3. Abacaxi: divergência física resolvida associada a `PED-20260725-122903-6D16`.
4. Abacate: transferência `TRF-20261015-144225-589` permanece independente, sem duplicação.
5. Testar busca, ordenação, filtros mobile recolhidos, modo escuro, links, expandir/recolher tudo e permissões.

**Pendente:** consolidar uma TRF inteira em uma ocorrência-mãe, após aprovação do reteste. Devoluções/trocas com fornecedores pertencem a frente própria, já registrada no backlog.
