# Guia — Loja Pública, Pedidos e Estoque

## Visão geral

A loja pública permite que o cliente acesse o cardápio/catálogo por slug, escolha produtos e envie o pedido principalmente via WhatsApp, preservando a retaguarda de estoque e caixa do OptmaMenu.

## Fluxo do pedido público

```text
1. Cliente acessa a loja pública.
2. Escolhe produtos.
3. Escolhe retirada, entrega ou mesa/QR, conforme configuração.
4. Escolhe forma de pagamento disponível.
5. O sistema cria o pedido em reserva.
6. O lojista aceita/prepara.
7. O lojista conclui/entrega.
8. O sistema consome reserva, baixa estoque, registra caixa e aplica fidelidade.
```

## Status principais

| Status | Significado operacional |
|---|---|
| `reserved` | Pedido criado e estoque reservado |
| `confirmed` | Pedido aceito/em preparo |
| `completed` | Pedido concluído/entregue |
| `cancelled` | Pedido cancelado |

## Reserva de estoque

Ao criar um pedido público válido, o sistema cria reserva em `stock_reservations` e aumenta o campo `reserved` no saldo por local.

A reserva evita vender o mesmo item duas vezes enquanto o pedido aguarda aceite, pagamento ou preparo.

## Aceitar/preparar

Ao aceitar o pedido, o sistema muda o status para `confirmed`. Nessa etapa:

- o estoque físico ainda não baixa;
- a reserva continua ativa;
- o pedido entra no fluxo de preparo.

## Concluir pedido

Ao concluir pedido confirmado:

- o pedido muda para `completed`;
- a reserva muda para `consumed`;
- o estoque físico baixa;
- é gerada saída em `stock_movements`;
- pode ser gerada entrada no livro de caixa;
- a fidelidade pode pontuar o cliente.

## Cancelamento

Cancelamento seguro deve:

- mudar pedido para `cancelled`;
- cancelar reservas ativas;
- devolver o reservado ao estoque disponível;
- registrar metadados de cancelamento.

Reservas antigas criadas antes da correção de cancelamento podem precisar de limpeza controlada posterior.

## Pedido mínimo

A regra adotada é:

| Tipo | Pedido mínimo |
|---|---|
| Retirada | Pode ter qualquer valor |
| Entrega | Deve respeitar valor mínimo configurado |

## Formas de pagamento

As formas são configuráveis por loja. Exemplos:

- A combinar / pendente
- PIX
- Dinheiro
- Cartão de débito
- Cartão de crédito

Somente métodos com `affects_cashbook = true` geram lançamento automático no Livro de Caixa.

## Formas de entrega

As formas são configuráveis por loja. Exemplos:

- Retirada na loja
- Entrega local
- Mesa/QR
- Consumo local

Entrega local pode exigir endereço e pedido mínimo. A evolução futura deve incluir taxa por km, meios de transporte e regras avançadas.

## Pontos de atenção para suporte

Se um pedido não cria:

1. Verifique se a forma de pagamento está ativa e pública.
2. Verifique se a forma de entrega está ativa e pública.
3. Verifique estoque disponível no local de venda pública.
4. Verifique se a regra de pedido mínimo está sendo aplicada corretamente.
5. Verifique console e retorno da RPC.

Se uma reserva não libera:

1. Confirme se o cancelamento foi feito pelo fluxo seguro atual.
2. Verifique `stock_reservations.status`.
3. Verifique `inventory_location_balances.reserved`.
4. Para reservas antigas de teste, planeje limpeza controlada.
