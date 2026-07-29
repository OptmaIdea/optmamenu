# POS_9 — Venda direta — Cliente de balcão e tela Pedidos

## Status

Implementado para validação local.

## Contexto

Foram observados três comportamentos após a validação da venda direta:

1. vendas diretas com cliente de balcão sem cliente selecionado não apareciam na Vida do Cliente de balcão;
2. dashboard comercial exibia corretamente o nome gravado no pedido, como `Cliente de balcão` ou um nome digitado manualmente;
3. a tela `/admin/orders` aparecia vazia porque o filtro default era `Pedidos Atuais`, que mostra apenas pedidos `reserved` e `confirmed`, enquanto a venda direta nasce como `completed`.

## Decisão funcional

Telefone de cliente de balcão permanece opcional.

Regra de negócio:

- cliente balcão pode comprar sem telefone;
- se quiser promoções, fidelidade ou campanhas, precisa se cadastrar/conceder permissões;
- o sistema não deve forçar telefone no PDV.

## Ajuste 1 — Cliente operacional de balcão

Arquivo alterado:

- `src/pages/private/admin/commercial/directSales/DirectSalesPage.tsx`

Commit:

- `42d3b0ee1a14157f0e5d9fb8f9ab4865aa87e614`

### Comportamento

Quando a venda direta está no modo default `Cliente de balcão`, a tela tenta localizar um cliente cadastrado com nome:

- `Cliente de balcão`; ou
- `Cliente balcão`.

Se esse cliente operacional existir, a venda é criada com:

- `customer_id` vinculado ao cliente operacional de balcão;
- `customer_name` preservando o nome digitado/exibido no pedido.

Assim:

- o dashboard comercial continua mostrando o nome colocado no pedido;
- as vendas passam a aparecer na Vida do Cliente de balcão;
- telefone continua opcional;
- não há exigência de cadastro real do comprador.

Se o cliente operacional de balcão não existir, a tela informa que a venda será salva sem vínculo na Vida do Cliente até esse cadastro existir.

## Ajuste 2 — Tela Pedidos

Arquivo alterado:

- `src/pages/private/admin/commercial/orders/Orders.tsx`

Commit:

- `c21994004dcfe043e8315b2562e1ac5aa2db3d24`

### Comportamento anterior

A tela abria com filtro:

- `Pedidos Atuais`.

Esse filtro mostra localmente apenas:

- `reserved`;
- `confirmed`.

Como a venda direta nasce concluída, com status:

- `completed`,

ela não aparecia no filtro inicial.

### Novo comportamento

A tela agora abre por padrão em:

- `Todos os Status`.

Assim, vendas diretas concluídas aparecem na listagem de pedidos.

O filtro `Pedidos Atuais` continua disponível para o fluxo operacional em tempo real.

O estado vazio também ficou mais explicativo quando o filtro atual não possui pedidos.

## Sem migration

Nenhuma migration foi criada.

## Sem permissão nova

Nenhuma permissão nova foi criada.

## Validação sugerida

1. Rodar `npm run build`.
2. Abrir `/admin/direct-sales`.
3. Manter `Cliente de balcão`.
4. Criar venda sem telefone.
5. Validar que o pedido foi criado.
6. Abrir Dashboard comercial e conferir o nome exibido.
7. Abrir Vida do Cliente de balcão e conferir a venda.
8. Abrir `/admin/orders` e conferir que a venda aparece por padrão em `Todos os Status`.
9. Trocar filtro para `Pedidos Atuais` e confirmar que apenas pedidos abertos/em preparo aparecem.
