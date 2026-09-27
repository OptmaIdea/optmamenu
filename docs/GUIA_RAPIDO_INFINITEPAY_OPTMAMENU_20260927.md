# Guia rápido — InfinitePay no OptmaMenu

**Data de referência:** 27/09/2026  
**Status:** diretriz arquitetural para futura integração real  
**Objetivo:** permitir que uma loja use a InfinitePay como provedor principal de cobrança sem acoplar pedidos, estoque ou financeiro do OptmaMenu à API de um banco específico.

> Este guia não ativa dinheiro real. A integração real só deve ser habilitada quando a loja tiver conta InfinitePay própria, Checkout Integrado habilitado e dados oficiais de produção.

## 1. Decisão arquitetural

O OptmaMenu não deve tratar InfinitePay, OptmaPay, Mercado Pago, bancos ou adquirentes como parte do domínio de pedidos.

A aplicação mantém um contrato interno de provedor:

```text
OptmaMenu
  -> payment intent
  -> adapter do provedor
  -> provedor externo
  -> confirmação server-side
  -> online_payment_events
  -> liquidação interna
  -> pedido + Livro Diário / conta financeira
```

A troca de provedor não deve exigir alteração da máquina de estados de pedido, reserva, estoque, cliente ou fidelidade.

O OptmaPay Sandbox é o laboratório oficial para desenvolver e homologar esse contrato sem dinheiro real.

## 2. InfinitePay como referência operacional

A documentação pública atual da InfinitePay oferece dois trilhos especialmente úteis ao OptmaMenu:

1. **Checkout Integrado** — o OptmaMenu envia os itens do pedido, recebe uma URL de checkout hospedado e o cliente conclui o pagamento por Pix ou cartão no ambiente da InfinitePay.
2. **InfiniteTap** — integração presencial por deeplink com o aplicativo InfinitePay, interessante futuramente para o OptmaPDV.

Fontes oficiais:

- https://www.infinitepay.io/desenvolvedores
- https://www.infinitepay.io/checkout-documentacao
- https://www.infinitepay.io/checkout
- https://www.infinitepay.io/checkout-tap

Sempre conferir novamente a documentação oficial antes de ativar produção, pois contrato, campos e requisitos podem mudar.

## 3. Mapeamento recomendado

Não copiar nomes da InfinitePay para o domínio principal. Traduzir para o contrato canônico do OptmaMenu.

| OptmaMenu | InfinitePay | Finalidade |
|---|---|---|
| `merchant_reference` | `handle` | identifica o recebedor |
| `order_reference` | `order_nsu` | liga pagamento ao pedido |
| `provider_payment_id` | `invoice_slug` / `slug` | identifica a cobrança/fatura |
| `provider_transaction_id` | `transaction_nsu` | identifica a transação |
| `method` | `capture_method` | Pix ou cartão |
| `amount` | `amount` | valor esperado |
| `paid_amount` | `paid_amount` | valor reportado como pago |
| `installments` | `installments` | parcelas |
| `receipt_url` | `receipt_url` | comprovante |
| `checkout_url` | `url` | checkout hospedado |

Os valores enviados à API de Checkout da InfinitePay são expressos em **centavos**. O OptmaMenu pode manter `numeric(14,2)` internamente e converter somente na fronteira do adapter.

## 4. Fluxo online recomendado

```text
Cliente fecha o pedido
  -> OptmaMenu cria online_payment_intent
  -> adapter InfinitePay cria checkout
  -> order_nsu = referência estável do pedido/intent
  -> cliente é redirecionado à URL retornada
  -> InfinitePay processa Pix/cartão
  -> webhook/retorno informa a transação
  -> backend do OptmaMenu confirma server-side
  -> confere pedido, loja, valor e transação
  -> deduplica
  -> liquida uma única vez
```

Endpoint documentado atualmente para criação de checkout:

```http
POST https://api.checkout.infinitepay.io/links
```

Campos de maior interesse:

- `handle`;
- `order_nsu`;
- `items`;
- `redirect_url`;
- `webhook_url`;
- `customer` opcional;
- `address` opcional.

O `order_nsu` deve ser estável e rastreável. Não gerar uma referência aleatória diferente a cada retry.

## 5. Confirmação do pagamento

A InfinitePay documenta dois mecanismos:

1. webhook após aprovação;
2. consulta de confirmação por `payment_check`.

Endpoint documentado:

```http
POST https://api.checkout.infinitepay.io/payment_check
```

A confirmação do browser ou os parâmetros da `redirect_url` **nunca** devem marcar o pedido como pago sozinhos.

Como a documentação pública consultada não descreve uma assinatura HMAC equivalente à do OptmaPay, a futura integração InfinitePay deve operar de forma defensiva:

1. receber o webhook;
2. localizar previamente o `online_payment_intent`;
3. não confiar em valor, loja ou cliente recebidos como autoridade;
4. confirmar a transação server-side pelo mecanismo oficial disponível;
5. comparar `order_nsu`, `transaction_nsu`, `slug`, valor e estado;
6. deduplicar antes da liquidação;
7. somente então chamar a liquidação interna do OptmaMenu.

Se a InfinitePay passar a oferecer assinatura/autenticação própria de webhook, incorporá-la adicionalmente.

## 6. Invariantes do OptmaMenu

Independentemente do provedor:

- browser não confirma pagamento;
- webhook não substitui o valor esperado do pedido;
- um evento repetido não pode gerar segunda baixa financeira;
- pagamento confirmado interrompe o timer aplicável;
- pagamento não baixa estoque físico antecipadamente;
- retirada baixa estoque na retirada;
- delivery baixa estoque ao sair para entrega;
- pedido pago permanece reservado até a etapa operacional correta;
- `service_role`, chaves e secrets nunca vão para o frontend;
- logs não devem conter credenciais nem dados completos de cartão.

## 7. Conta financeira e conciliação

Pagamento e conta bancária são conceitos diferentes.

A InfinitePay pode ser simultaneamente meio de cobrança e conta de recebimento, mas o OptmaMenu deve preservar a separação:

```text
Pagamento InfinitePay confirmado
  -> lançamento do OptmaMenu
  -> conta financeira "InfinitePay"
  -> conciliação posterior
```

Na documentação pública consultada não foi identificada uma API bancária genérica para extrato/saldo comparável a `GET /transactions` do OptmaPay Sandbox.

Por isso, a futura conciliação InfinitePay deve aceitar progressivamente:

- identificadores e comprovantes vindos do Checkout;
- importação de extrato quando aplicável;
- CSV/OFX ou outro formato oficial disponibilizado ao cliente;
- uma API bancária oficial futura, se a InfinitePay a disponibilizar.

Não bloquear a integração de pagamentos pela ausência de API pública de extrato.

## 8. InfiniteTap no OptmaPDV — evolução futura

O InfiniteTap deve entrar como outro modo de experiência do mesmo provider, não como subsistema separado.

Modelo interno sugerido:

```text
checkout_mode = hosted | embedded | deeplink
```

Para InfiniteTap:

```text
OptmaPDV
  -> deeplink InfinitePay
  -> pagamento no app
  -> result_url
  -> order_id / nsu / autorização / bandeira
  -> validação e registro no OptmaMenu
```

Antes de implementar, revisar a documentação oficial vigente e validar os mecanismos de autenticação/retorno disponíveis.

## 9. Como configurar uma futura loja cliente

Quando uma loja optar por InfinitePay:

1. criar/validar a conta InfinitePay da própria empresa;
2. habilitar o Checkout Integrado no ambiente oficial;
3. registrar a InfiniteTag/`handle` da loja;
4. configurar no OptmaMenu o provider da loja;
5. vincular a conta financeira de recebimento;
6. cadastrar URLs públicas de retorno/webhook;
7. testar pedido de baixo valor;
8. conferir `order_nsu`, `transaction_nsu`, valor e comprovante;
9. confirmar que um webhook repetido não duplica liquidação;
10. testar falha de rede e retry;
11. testar Pix;
12. testar cartão e parcelamento somente quando a loja desejar habilitá-los;
13. validar Livro Diário/conta financeira;
14. só depois liberar a loja para uso real.

## 10. Segurança para demonstrações e clientes

Nas demonstrações do OptmaMenu e OptmaPay, explicar explicitamente a diferença entre:

- sandbox sem dinheiro real;
- credencial de API;
- idempotência;
- webhook;
- verificação server-side;
- conciliação;
- conta financeira;
- liquidação;
- isolamento por loja.

O OptmaPay deve continuar sendo o ambiente em que demonstramos replay, evento duplicado, HMAC inválido, retry, SSRF e reconciliação sem expor uma conta bancária real.

## 11. Situação do Asaas

Por decisão do projeto em 27/09/2026:

- o Asaas deixa de ser provedor-alvo de desenvolvimento do OptmaMenu;
- não criar novas dependências, features ou testes que exijam conta Asaas;
- não depender de credenciais Asaas para o Pacote OptmaPay;
- o código Asaas existente permanece temporariamente apenas como referência histórica/técnica até a substituição pelo adapter OptmaPay estar homologada;
- a remoção definitiva deve ocorrer em uma mudança controlada posterior, evitando regressão no fluxo já existente de pagamentos online.

A referência prioritária passa a ser:

1. **OptmaPay Sandbox** — desenvolvimento, testes e demonstração segura;
2. **InfinitePay** — primeiro modelo de provedor real a ser suportado;
3. outros bancos/adquirentes — adapters futuros usando o mesmo contrato.

## 12. Critério para uma integração bancária futura

Um novo provedor não deve exigir reescrever o OptmaMenu.

Para entrar, deve ser possível mapear:

- identificação do merchant;
- criação/iniciação de pagamento;
- referência do pedido;
- identificadores externos;
- estado de pagamento;
- valor bruto/pago;
- taxas e valor líquido quando disponíveis;
- comprovante;
- parcelamento;
- confirmação server-side;
- idempotência;
- refund/estorno quando suportado;
- conciliação.

Se um banco não fornecer algum desses recursos, o adapter deve declarar a capacidade ausente em vez de simular que ela existe.
