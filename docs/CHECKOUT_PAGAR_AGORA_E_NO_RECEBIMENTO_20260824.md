# Checkout — Pagar agora x pagar no recebimento

Data: 2026-08-24

## Decisão

O checkout público passa a separar duas dimensões que antes estavam misturadas:

1. **momento do pagamento** (`pay_now` ou `pay_on_fulfillment`);
2. **forma de liquidação** (PIX, cartão, dinheiro, link, PIX manual etc.).

O código interno `pending` deixa de significar literalmente "Pagar na retirada". Ele representa **Pagar no recebimento**. O rótulo exibido depende do atendimento:

- retirada: **Pagar na retirada**;
- entrega: **Pagar na entrega**;
- mesa/atendimento: **Pagar no atendimento**.

## Pagar agora

Somente formas realmente disponíveis/configuradas pela loja devem aparecer.

### Com confirmação automática por integração

Podem existir independentemente por loja/provedor:

- PIX integrado/API;
- cartão online/API;
- link de pagamento/API.

Cada trilho possui configuração independente em `store_payment_methods.metadata.checkout`, incluindo `pay_now`, `confirmation_mode=api` e `integration_enabled`.

Uma loja pode, por exemplo, integrar cartão e link sem integrar PIX. Uma forma API com `integration_enabled=false` **não aparece** no bloco Pagar agora.

A confirmação por API/webhook deverá ser a fonte autoritativa da baixa financeira desses trilhos. A simples criação do pedido não marca o pagamento como pago.

### Sem API: PIX copia e cola / QR Code

Existe um trilho próprio:

- `code = pix_manual_qr`;
- `base_code = pix`;
- `confirmation_mode = manual_proof`;
- `requires_proof = true`.

Fluxo:

1. pedido nasce reservado e pagamento pendente;
2. cliente envia comprovante pela página pública do pedido;
3. equipe autorizada confere;
4. confirmação manual gera Livro Diário/conta financeira e marca pagamento como pago;
5. rejeição exige justificativa e permite novo envio enquanto o pedido estiver elegível.

O PIX integrado/API não aceita comprovante manual.

## Pagar na retirada

O pedido nasce com:

- `payment_method_code = pending`;
- `payment_timing = pay_on_fulfillment`.

A forma real é escolhida apenas no momento da retirada. Não é necessário prometer PIX/cartão/dinheiro no checkout.

## Pagar na entrega

O pedido também permanece `pending`, mas o cliente informa a intenção para facilitar a operação:

- PIX na entrega;
- Cartão na entrega;
- Dinheiro na entrega.

A escolha é registrada em `payment_metadata.checkout.promised_method_code`, sem fingir que o pagamento já ocorreu.

Para dinheiro, aplica-se a regra de troco: quando o cliente solicita troco, o valor informado deve ser igual ou superior ao total do pedido.

No recebimento, a forma efetivamente usada continua autoritativa e pode ser diferente da intenção registrada.

## Dados e auditoria

`orders.payment_metadata.checkout` preserva, conforme o caso:

- `timing`;
- `selected_method_code`;
- `selected_method_name`;
- `confirmation_mode`;
- `requires_proof`;
- `promised_method_code`;
- `change_for`;
- `awaiting_confirmation`.

`orders.commercial_metadata` recebe também a classificação operacional do momento/forma prometida.

## RPCs

- `get_public_checkout_payment_options_by_slug(slug, fulfillment)` — opções públicas autoritativas conforme configuração e atendimento.
- `create_public_order_by_slug_v3(...)` — cria o pedido com seleção estruturada de momento/forma.

A V3 mantém a V2 como núcleo autoritativo de criação, precificação, reserva e validações existentes.

## Compatibilidade financeira

- pagar agora manual PIX: a forma efetiva é `pix_manual_qr`, natureza-base `pix`;
- pagar agora via API: a forma específica da integração deve ser preservada e a confirmação posterior fará a baixa;
- pagar no recebimento: permanece `pending` até a operação registrar a forma efetivamente recebida;
- conta financeira e forma real não devem ser inferidas de forma irreversível apenas pela intenção informada no checkout.
