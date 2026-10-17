# Fase 10.2A — Catálogo, modal de produto e disponibilidade pública

**Data:** 31/07/2026  
**Branch:** `agent/fase-10-loja-publica-blueprint`  
**Escopo:** evolução do catálogo público após a conclusão do carrinho e checkout.

## 1. Estado encontrado

O modal ativo em `src/pages/store/ProductModal.tsx` já estava concentrado na configuração do produto. Não havia, nesse componente, etapas de pagamento, entrega, nome, telefone ou endereço. Essas decisões permanecem no checkout.

O modal já continha:

- imagem e navegação entre imagens;
- nome e descrição;
- prévia de preço considerando produto, categoria e grupo de precificação;
- quantidade;
- botão de inclusão no carrinho;
- confirmação posterior de preço pelo fluxo autoritativo.

O catálogo carrega produtos por `get_public_catalog_by_slug` através de `PublicStorefrontService`. O campo legado `stock_quantity` ainda é normalizado no frontend, mas não representa, por si só, a disponibilidade pública segura para comunicação ao consumidor.

O card anterior possuía três problemas confirmados:

- avaliação visual padrão `5.0`, mesmo sem avaliação real;
- placeholder externo dependente de `via.placeholder.com`;
- troca automática de imagens ao passar o mouse, comportamento sem equivalente útil no celular.

## 2. Alterações implementadas

### 2.1 Modal responsivo

O modal foi refinado para:

- funcionar como `bottom sheet` alto no celular, usando até `94dvh`;
- manter área de ação fixa e conteúdo rolável;
- preservar pequenas margens em tablet e desktop;
- limitar a largura em telas maiores;
- reduzir a altura da imagem no celular para equilibrar produto, preço e ação;
- melhorar espaçamentos, legibilidade e áreas de toque.

O fluxo continua contendo apenas configuração do item e inclusão no carrinho.

### 2.2 Contrato explícito de disponibilidade pública

Foi introduzido o tipo `PublicAvailability`:

```ts
export interface PublicAvailability {
  status: 'available' | 'low_stock' | 'unavailable' | 'unknown';
  availableOnline?: number;
  displayMode: 'exact' | 'low_stock_only' | 'status_only' | 'hidden';
  message?: string;
}
```

O serviço público passa a normalizar, quando fornecido pela RPC, tanto `public_availability` quanto `availability`, aceitando nomes em camelCase ou snake_case nos campos internos.

O frontend não deriva esse contrato de `stock_quantity`.

### 2.3 Aviso de poucas unidades

O modal e o card mostram aviso somente quando o backend fornecer um contrato válido com:

- `status = 'low_stock'`; e
- `displayMode` diferente de `hidden`.

A quantidade exata só é exibida quando:

- `displayMode = 'exact'`; e
- `availableOnline` é numérico.

Nos demais modos, é usada uma mensagem genérica ou a mensagem autoritativa enviada pelo backend.

Sem `public_availability`, nenhum aviso é exibido. Isso evita falsa urgência e impede que o saldo físico bruto seja apresentado como disponibilidade online.

O card também respeita `status = 'unavailable'`: a interação de configuração é bloqueada e o estado indisponível é comunicado visualmente.

### 2.4 Cards de produto mobile-first

`src/pages/store/ProductCard.tsx` foi reconstruído para:

- remover avaliação fictícia e ícone de estrela sem base real;
- remover a dependência de placeholder externo;
- exibir um estado interno neutro quando não houver imagem cadastrada;
- remover animação automática de imagens por hover;
- melhorar proporção de imagem, tipografia, espaçamento e densidade em telas pequenas;
- preservar uma área de toque ampla em todo o card;
- manter o botão `+` como entrada para configurar o produto, sem adição silenciosa;
- apresentar descrição curta quando existente;
- mostrar o preço unitário atual sem inventar desconto;
- identificar promoções por quantidade somente quando houver faixas reais;
- apresentar a primeira faixa promocional real, por exemplo: `A partir de 10 itens: R$ 3,25 cada`;
- usar `Saiba mais` como acesso ao configurador quando houver promoção;
- usar `Ver detalhes` nos demais produtos.

A promoção exibida pode vir, na ordem já usada pelo carrinho, de:

1. grupo de precificação;
2. categoria;
3. regra própria do produto.

O card apenas comunica as regras já carregadas. O cálculo final continua sendo confirmado pelo fluxo autoritativo.

## 3. Fonte correta de saldo

O campo correto para comunicação pública não deve ser `products.stock_quantity` isoladamente.

A disponibilidade online deve ser calculada no backend considerando, no mínimo:

```text
saldo_fisico_disponivel = on_hand - reserved

disponivel_online = min(
  max(0, saldo_fisico_disponivel - reserva_minima_local),
  limite_maximo_online
)
```

A RPC pública deve retornar o resultado já classificado segundo a política da loja/produto, sem expor ao frontend a responsabilidade de reconstruir saldo, reservas, margem operacional ou limite online.

## 4. Riscos e limites preservados

- Nenhuma migration ou RPC foi criada nesta entrega.
- O aviso permanecerá oculto até que `get_public_catalog_by_slug` forneça `public_availability` ou `availability` válido.
- `stock_quantity` foi mantido por compatibilidade com o contrato atual, mas não é usado pelo novo aviso.
- Carrinho, checkout, criação de pedido e acompanhamento não foram alterados.
- A validação autoritativa de preço e estoque na conclusão permanece intacta.
- Complementos e observação por item continuam como evolução posterior do contrato do carrinho; não foram simulados no modal.
- A primeira faixa promocional exibida no card é informativa; o preço projetado completo continua sendo apresentado no configurador.

## 5. Etapa futura — avaliações, popularidade e descoberta

Foi preservado um bloco posterior específico, que não integra esta entrega:

- avaliações reais por produto;
- nota média e quantidade de avaliações somente com dados reais;
- comentários com moderação;
- vínculo opcional com pedido para sinalizar compra verificada;
- produtos mais vendidos por período;
- produtos mais recomprados;
- favoritos;
- categorias e itens mais procurados;
- ordenação por relevância, avaliação e popularidade;
- métricas calculadas no backend;
- critérios transparentes e resistentes a manipulação.

Até esse bloco existir, o frontend não deve mostrar nota padrão, quantidade fictícia de avaliações ou selo de `mais vendido` sem fonte real.

## 6. Arquivos alterados

Primeira entrega:

- `src/types/index.ts`
- `src/services/publicStorefrontService.ts`
- `src/pages/store/ProductModal.tsx`

Segunda entrega:

- `src/pages/store/ProductCard.tsx`

Documentação:

- `docs/FASE_10_2A_CATALOGO_MODAL_E_DISPONIBILIDADE_PUBLICA_20260731.md`

## 7. Validação necessária

Executar no ambiente de desenvolvimento:

```bash
npm run build
npm run lint
```

Homologar visualmente:

1. celular pequeno;
2. celular médio;
3. tablet;
4. desktop;
5. produto sem imagem;
6. produto sem promoção;
7. produto com regra própria por quantidade;
8. produto com precificação por categoria;
9. produto com grupo de precificação;
10. produto sem disponibilidade pública;
11. produto com `low_stock + low_stock_only`;
12. produto com `low_stock + exact`;
13. produto com `displayMode = hidden`;
14. produto com `status = unavailable`;
15. inclusão no carrinho e continuidade até o checkout.

Esta documentação não declara build ou teste local executado, pois as alterações foram realizadas diretamente na branch pelo conector do GitHub.