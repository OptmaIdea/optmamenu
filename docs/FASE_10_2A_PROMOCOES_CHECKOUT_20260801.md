# F10.2A — Promoções no checkout público

Data: 2026-08-01

## Objetivo

Dar função real ao botão `Saiba mais` do carrinho, apresentando ao consumidor uma visão consolidada das promoções por quantidade que afetam os itens atuais.

## Escopo implementado

O checkout passa a exibir um modal próprio com:

- promoções por categoria;
- promoções combinadas entre categorias;
- nome do grupo promocional, quando existir;
- categorias participantes;
- quantidade já presente no carrinho;
- todas as faixas de quantidade e preço;
- faixas já alcançadas;
- quantidade que falta para atingir a próxima faixa;
- aviso de validação autoritativa antes da conclusão.

## Regras preservadas

- o checkout reutiliza `categoryRules` e os itens atuais do Zustand;
- grupos são consolidados por identificador, evitando repetição por produto;
- categorias isoladas são consolidadas por categoria;
- a quantidade combinada soma somente itens participantes;
- o frontend não cria novas regras comerciais;
- preço e disponibilidade continuam sendo confirmados pelo backend na conclusão.

## Fora deste bloco

Ainda não entram:

- compre um item e ganhe desconto em outro;
- brindes condicionais;
- combos;
- leve X e pague Y;
- regras cruzadas entre produtos sem vínculo por categoria.

Esses casos exigirão um motor promocional próprio e contrato autoritativo específico.

## Arquivos

- `src/pages/store/components/CheckoutPromotionsModal.tsx`
- `src/pages/store/Checkout.tsx`

## Homologação recomendada

1. adicionar itens de uma categoria com regra própria;
2. abrir `Saiba mais` no carrinho;
3. conferir faixas, quantidade atual e próxima faixa;
4. adicionar itens de duas categorias do mesmo grupo;
5. confirmar que a promoção combinada aparece uma única vez;
6. conferir nomes das categorias participantes;
7. alterar quantidades e reabrir o modal;
8. executar `npm run build`;
9. verificar console e comportamento mobile.
