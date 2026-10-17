# Fase 10.2A — Promoções por quantidade no modal do produto

**Data:** 01/08/2026  
**Branch:** `agent/fase-10-loja-publica-blueprint`

## Objetivo

Transformar o texto `Saiba mais` dos cards com promoção em uma explicação realmente útil dentro do próprio modal do produto, sem criar outro fluxo paralelo e sem duplicar a regra de precificação.

## Implementação

O modal passou a apresentar, quando existem faixas promocionais válidas:

- título `Compre mais, pague menos`;
- todas as faixas públicas aplicáveis;
- preço unitário de cada faixa;
- destaque visual das faixas já alcançadas;
- indicação de quantos itens participantes faltam para a próxima faixa;
- mensagem quando a melhor faixa publicada já foi alcançada.

## Escopo da quantidade

A explicação respeita a origem já utilizada pelo carrinho:

1. grupo de precificação combinado;
2. categoria com volume combinado;
3. volume por produto;
4. regra própria do produto.

O texto informa se a quantidade considera:

- produtos do mesmo grupo;
- produtos da mesma categoria;
- somente o produto atual.

## Regras preservadas

- nenhuma regra de preço foi recriada fora do estado já sincronizado pelo catálogo;
- o cálculo visual usa as mesmas regras carregadas em `useCartStore`;
- a quantidade já presente no carrinho participa da projeção;
- o backend permanece autoritativo na conclusão do pedido;
- nenhuma migration ou RPC foi criada;
- checkout, estoque e criação de pedido não foram alterados.

## Arquivo alterado

- `src/pages/store/ProductModal.tsx`

## Homologação recomendada

1. produto sem promoção;
2. promoção própria por produto;
3. promoção por categoria combinada;
4. promoção por grupo de categorias;
5. carrinho vazio;
6. carrinho já próximo da próxima faixa;
7. melhor faixa já alcançada;
8. alteração da quantidade no modal atualizando preço e progresso;
9. mobile com conteúdo rolável e ação fixa;
10. inclusão no carrinho e conferência no checkout.

## Validação não declarada

A alteração foi enviada diretamente pelo conector do GitHub. Build, lint e testes locais devem ser executados no ambiente de desenvolvimento antes da integração definitiva.
