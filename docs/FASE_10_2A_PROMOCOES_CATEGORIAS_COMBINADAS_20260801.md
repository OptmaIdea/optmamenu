# Fase 10.2A — Promoções por categoria e categorias combinadas

Data: 2026-08-01

## Objetivo

Tornar a explicação pública das promoções por quantidade mais clara e abrangente, sem antecipar regras promocionais futuras que ainda não possuem contrato autoritativo completo.

## Escopo atual

Nesta etapa, o catálogo público explica somente:

1. promoções por quantidade dentro de uma categoria;
2. promoções combinadas entre categorias vinculadas ao mesmo grupo de precificação.

Exemplo real esperado:

- `Picolé cremoso`;
- `Picolé cremoso zero lactose`;
- ambas as categorias somam quantidade dentro do mesmo grupo promocional;
- as faixas de preço são aplicadas conforme a quantidade combinada.

## Fora do escopo atual

Ainda não entram nesta entrega promoções relacionais como:

- compre um item e ganhe desconto em outro produto;
- leve X e pague Y;
- desconto progressivo entre produtos não agrupados;
- brindes condicionais;
- combos de produtos distintos;
- desconto em água com gás condicionado à compra de picolé.

Esses cenários exigem um motor promocional próprio, contrato autoritativo e representação pública específica.

## Alterações técnicas

### Metadados de categoria no carrinho

O catálogo já carregava categorias e grupos de precificação, mas o estado de precificação mantinha apenas IDs e faixas.

O `useCartStore` passou a preservar também:

- nome da categoria;
- nome do grupo de precificação;
- nomes de todas as categorias participantes do grupo.

Esses metadados não alteram o cálculo. Servem somente para explicar ao consumidor quais categorias somam juntas.

### Modal do produto

O modal diferencia:

- `Promoção da categoria`;
- `Promoção combinada entre categorias`;
- promoção restrita ao produto, quando aplicável.

Quando a regra é combinada, o modal mostra:

- nome do grupo;
- chips com as categorias participantes;
- faixas de quantidade e preço;
- quantidade atual considerada;
- quantos itens faltam para a próxima faixa.

## Regras preservadas

- não há duplicação da lógica de preço;
- o cálculo continua vindo das regras já carregadas no catálogo;
- o carrinho continua recalculando os preços;
- o backend continua validando o valor final e o estoque ao concluir o pedido;
- nenhuma migration foi criada;
- checkout, entrega e pagamento não foram alterados.

## Arquivos alterados

- `src/store/useCartStore.ts`
- `src/pages/store/ProductModal.tsx`

## Homologação sugerida

1. abrir um produto da categoria `Picolé cremoso zero lactose`;
2. verificar se o modal mostra a promoção combinada;
3. confirmar a presença das categorias participantes;
4. adicionar itens de `Picolé cremoso` e `Picolé cremoso zero lactose`;
5. reabrir o produto e verificar se a quantidade combinada é refletida;
6. confirmar mudança da próxima faixa conforme o carrinho;
7. validar build, console e comportamento mobile.
