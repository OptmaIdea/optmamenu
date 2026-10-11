# Decisões — devoluções, reprecificação, taxas e parcelamento

Data: 2026-08-24

## 1. Devolução parcial deve reprecificar o saldo mantido

Uma devolução parcial não deve simplesmente multiplicar a quantidade devolvida pelo preço unitário líquido originalmente aplicado quando esse preço dependia de quantidade, categoria ou grupo combinado.

A regra adotada é:

1. preservar a venda original e seu snapshot comercial;
2. subtrair todas as quantidades já devolvidas e a nova quantidade solicitada;
3. reavaliar as regras de preço sobre as quantidades que permanecerão com o cliente;
4. calcular o novo valor comercial dos itens mantidos;
5. calcular o direito acumulado de devolução como `subtotal original - novo subtotal dos itens mantidos`;
6. subtrair estornos anteriores para obter o valor desta devolução.

Isso evita a exploração de faixas de volume por compra artificialmente maior seguida de devolução.

### Exemplo homologado

Venda `PED-20260731-164856-3559`:

- 5 Tutti fruti + 4 Uva = 9 unidades;
- preço-base: R$ 3,75;
- faixa a partir de 8 unidades: R$ 3,25;
- total original: 9 × R$ 3,25 = R$ 29,25;
- devolução de 3 unidades;
- permanecem 6 unidades, portanto a faixa de 8 deixa de ser válida;
- novo valor mantido: 6 × R$ 3,75 = R$ 22,50;
- valor correto desta devolução, sem estornos anteriores: R$ 29,25 − R$ 22,50 = **R$ 6,75**.

Observação: a conta de R$ 6,50 mencionada durante a homologação foi apenas uma diferença aritmética; a regra de negócio proposta estava correta.

## 2. Snapshot das regras de preço

Para novas vendas, o snapshot central de precificação passa a guardar também o conjunto completo de regras/faixas utilizado no momento da venda (`pricing_rules_snapshot`). A devolução deve usar esse snapshot histórico, e não depender de uma regra que possa ter sido alterada posteriormente.

Para vendas históricas anteriores a esse snapshot completo, o sistema pode usar a regra ainda existente somente quando houver evidência de que ela não foi alterada após a conclusão da venda. Quando não houver evidência suficiente, a operação deve ser tratada de forma conservadora e auditável, sem inventar uma regra histórica.

## 3. Forma de devolução é independente da forma original

A forma de recebimento original não obriga a devolução a ocorrer pelo mesmo meio.

Exemplo: venda no cartão de crédito pode ser devolvida posteriormente em dinheiro ou PIX quando o estorno na adquirente não estiver disponível.

A operação deve registrar separadamente:

- forma original de recebimento;
- forma efetiva da devolução;
- conta financeira de onde saiu o valor;
- operador, data/hora e justificativa;
- lançamento de estorno no Livro Diário.

A conta escolhida deve aceitar a forma de devolução selecionada.

## 4. Taxa administrativa do cartão e devolução inferior ao valor comercial

Não reduzir automaticamente o valor de devolução por uma taxa da adquirente.

São conceitos distintos:

- valor comercial devido pela devolução;
- taxa/custo da adquirente para a loja;
- valor efetivamente devolvido ao cliente;
- eventual retenção/ajuste autorizado e sua justificativa.

Uma futura regra de retenção deve possuir campos próprios, trilha de auditoria e política explícita. O custo de cartão deve ser modelado principalmente no financeiro/recebíveis como custo da operação, sem alterar silenciosamente o preço comercial da venda ou a regra de reprecificação.

Antes de permitir retenção automática ou sugerida ao consumidor, deve haver validação das regras comerciais, contábeis e legais aplicáveis ao caso.

## 5. Parcelamento no cartão

Parcelamento fica para uma rodada própria de cartões/recebíveis. Não é requisito para fechar a correção de devoluções atual.

O modelo futuro deverá considerar, no mínimo:

- quantidade de parcelas;
- valor bruto e líquido;
- adquirente/maquininha;
- taxa por modalidade e parcelamento;
- datas previstas de cada recebível;
- antecipação de recebíveis, quando houver;
- estorno/cancelamento total ou parcial e sua distribuição nas parcelas;
- conciliação com conta financeira e extrato da adquirente.

## 6. PIX antecipado com comprovante

Permanece em rodada própria, conforme `docs/PENDENCIA_COMPROVACAO_PIX_ANTECIPADO_PEDIDOS_20260824.md`.

## 7. Histórico já homologado

A devolução já registrada em HML para `PED-20260731-164856-3559` não deve ser reescrita automaticamente. Ela permanece como fato histórico da homologação. A nova regra vale para novas devoluções; eventual correção retroativa deve ser uma operação auditada e explicitamente solicitada.