# POS_9 — Venda direta — Validação e decisões funcionais

## Status

Validação básica concluída.

A venda direta já está funcional no fluxo mínimo.

## Resultado validado

O usuário validou que:

- a tela `/admin/direct-sales` abre corretamente;
- o console permanece limpo após login/logout;
- a venda foi salva;
- um pedido foi gerado;
- a venda permaneceu na tela de venda direta, sem redirecionamento;
- a venda aparece no dashboard comercial.

## Interpretação

O ciclo básico foi fechado:

```txt
venda direta -> pedido -> dashboard comercial
```

Com a RPC atual, o fluxo também preserva a base para:

- vínculo com cliente quando houver;
- baixa de estoque;
- movimentação de estoque;
- caixa/livro diário;
- fidelidade;
- histórico comercial do cliente.

Esses pontos devem continuar sendo validados em testes incrementais.

## Decisão funcional — Venda direta tem dois cenários

A venda direta passa a ser tratada como dois cenários distintos.

### 1. PDV / venda balcão

Cenário de venda rápida, presencial, normalmente com cliente não identificado ou cliente simples.

Características:

- foco em velocidade;
- layout mais próximo de PDV;
- seleção rápida de produto;
- quantidade;
- pagamento;
- conclusão imediata;
- opcionalmente cliente balcão ou cliente rápido;
- posterior melhoria com popup/modal mais amigável.

Decisão:

- manter a tela mínima atual como base técnica;
- evoluir posteriormente para uma experiência de PDV/popup mais refinada;
- não bloquear o avanço básico por UX final ainda.

### 2. Venda direta para cliente de atacado

Cenário de venda para cliente identificado, com possibilidade de regras comerciais próprias.

Características:

- cliente identificado;
- preço pode ser diferenciado;
- desconto pode depender de quantidade;
- desconto pode vir da categoria;
- desconto pode vir do próprio produto;
- pode exigir regras comerciais de atacado;
- pode exigir melhor exibição do desconto aplicado.

Decisão:

- tratar como evolução estrutural separada do PDV simples;
- não misturar a regra de atacado com o fluxo mínimo recém-validado;
- mapear regras de preço/desconto antes de alterar schema ou RPC.

## Descontos

O campo desconto passa a ser requisito funcional da venda direta.

Existem dois tipos a considerar:

### Desconto manual

Aplicado pelo operador no momento da venda.

Exemplos:

- desconto por negociação;
- arredondamento;
- desconto autorizado;
- promoção manual.

### Desconto automático/regra comercial

Aplicado por regra do sistema.

Exemplos:

- desconto por quantidade;
- desconto por categoria;
- desconto específico do produto;
- preço especial de atacado;
- faixa de preço por volume.

## Diretriz para UI

A UI deve futuramente destacar:

- preço original;
- preço aplicado;
- desconto manual;
- desconto automático;
- motivo/regra do desconto;
- total bruto;
- total de descontos;
- total final.

## Diretriz para backend

Antes de implementar atacado/descontos avançados, diagnosticar a estrutura atual de:

- produtos;
- categorias;
- preços;
- descontos;
- promoções;
- regras de fidelidade/benefícios;
- campanhas;
- metadados comerciais de pedido e item.

## Campos já úteis hoje

A tabela `order_items` já possui:

- `unit_price`;
- `discount`;
- `commercial_metadata`;
- `product_snapshot`.

A tabela `orders` já possui:

- `subtotal`;
- `total`;
- `commercial_metadata`;
- `customer_snapshot`;
- `sales_channel`.

Esses campos podem sustentar a primeira camada de desconto sem migration imediata, desde que a regra seja calculada antes de inserir os itens.

## Próxima etapa recomendada

Antes de criar UX de PDV final ou atacado, abrir diagnóstico específico:

- `POS_9_VENDA_DIRETA_DESCONTOS_ATACADO_1_DIAGNOSTICO`

Objetivo:

- mapear schema atual de produtos/categorias/descontos;
- verificar se já existem campos de preço por quantidade;
- verificar se categorias já suportam regras comerciais;
- verificar se benefícios de cliente podem ser reaproveitados;
- definir se desconto de atacado será por produto, categoria, cliente ou faixa de quantidade;
- decidir se será necessário schema novo.

## Próximos refinamentos já anotados

- botão/atalho no menu para venda direta;
- popup/modal de PDV mais bonito;
- seleção de cliente existente;
- cliente rápido melhorado;
- dropdown de forma de pagamento;
- dropdown de local de estoque;
- desconto manual por item;
- subtotal bruto/desconto/total final;
- regras de atacado;
- preço por quantidade;
- destaque visual do desconto aplicado;
- recibo/impressão futuramente.
