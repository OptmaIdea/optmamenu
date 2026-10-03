# OptmaMenu ↔ OptmaPay — Cartões: baseline e Bloco C1

**Data:** 03/10/2026  
**Escopo:** cartão de débito e crédito. PIX permanece como baseline homologado e não foi redesenhado.

## Baseline confirmado

- OptmaMenu: `OptmaIdea/optmamenu`, branch `agent/homologacao-geral-20260820`.
- Supabase OptmaMenu: `lgkkfmqzaorrutuoqeax`.
- OptmaPay: `OptmaIdea/optmapay`, branch `main`.
- O provider de homologação continua sendo `optma_sandbox`.
- As credenciais do provider no OptmaMenu continuam referenciadas pelo Vault; nenhum segredo deve ser persistido no Git, metadata de pedidos ou logs.

## Auditoria do motor real de cartões no OptmaPay

A implementação existente foi reutilizada como base. Foram revisadas, entre outras, as migrations:

- `20260901000000_cards_pos_and_fee_system.sql`;
- `20260901000001_credit_card_invoices_and_d1_settlement.sql`;
- `20260919234000_authoritative_payment_events.sql`;
- `20260920010000_audit_hardening_pacote_01b.sql`.

Também foram revisados `api/sandbox/v1/cards/charge.ts`, `src/lib/cardService.ts`, `src/lib/cardRules.ts`, o dispatcher de webhooks e o guia de API endurecida.

### O que já existe e deve ser preservado

- API autenticada por API key com escopo `cards:charge`;
- idempotência autoritativa server-side com hash da requisição;
- validação Sandbox de cartão, saldo/limite e modalidade;
- débito do pagador no débito;
- consumo de limite no crédito;
- matriz de taxas por modalidade, parcelas e plano;
- planos conceituais Standard/D+1, D+7, D+15, vencimento e OnTime/Nitro;
- evento outbox `card.paid` e entrega HMAC;
- comprovante/retorno apenas com dados seguros mascarados.

### Lacunas encontradas antes da exposição pública de cartão

1. O hardening atual do `process_card_payment` credita o lojista imediatamente no **débito**, inclusive quando o plano efetivo é `standard`. Isso conflita com a semântica de D+1 existente na migration anterior e precisa ser reparado no motor OptmaPay antes de homologar Golden Debit D+1.
2. O hardening atual consome o limite no **crédito**, mas a competência de fatura/parcelas continua derivada principalmente pelo frontend a partir de transações. A próxima evolução deve tornar o ledger de fatura/parcela autoritativo no banco, sem depender de inferência por descrição.
3. A conta Supabase do OptmaPay (`wertmoquxdrucdbobuie`) não está acessível pelo conector desta sessão. Portanto a migration do lado OptmaPay não deve ser declarada aplicada nem homologada até que o projeto esteja acessível.
4. O projeto OptmaPay também não aparece na integração Vercel disponível nesta sessão. O repositório está acessível no GitHub, mas o deploy real não pode ser confirmado pelo conector atual.

## Primeira entrega prática aplicada no OptmaMenu

Foram aplicadas as migrations:

- `20261003174317_optmapay_card_receivables_foundation.sql`;
- `20261003174902_optmapay_card_method_adapter_enablement`.

A fundação adiciona:

- `online_payment_receivables`;
- conta transitória `Valores a receber — OptmaPay` (`card_receivable`);
- conta do plano `payment_processing_fees`;
- separação de bruto, taxa, taxa de antecipação e líquido;
- status e datas de recebível/liquidação;
- RPC de criação/reuso de intent de cartão;
- RPC de confirmação comercial de cartão;
- RPC de liquidação posterior do recebível;
- exposição dos recebíveis no workspace administrativo de pagamentos online.

### Regra financeira aplicada

No pagamento confirmado:

1. receita bruta da venda entra em `Valores a receber — OptmaPay`;
2. a taxa financeira sai da mesma conta transitória;
3. o saldo econômico pendente da conta transitória fica igual ao líquido a receber;
4. na liquidação, somente o líquido é transferido da conta transitória para a conta financeira OptmaPay;
5. a liquidação é transferência e **não gera nova receita**.

Exemplo de teste: venda R$ 100, taxa R$ 3, recebível líquido R$ 97. Antes da liquidação a conta transitória fica em R$ 97. Na liquidação, R$ 97 migram para a conta OptmaPay sem duplicar a receita.

## Edge Functions

- `optmapay-public-checkout`: passou a preparar intents de cartões e a fazer a ponte server-side com a API endurecida do OptmaPay.
- `optmapay-sandbox-webhook`: passou a reconhecer `card.paid` e eventos de liquidação de recebível, mantendo `pix.paid` inalterado.
- A referência externa foi generalizada para `pix`, `debit_card` e `credit_card`.
- Payload persistido de webhook é sanitizado para remover campos sensíveis.

Os métodos de débito e crédito foram ligados ao provider em metadata, mas `pay_now` permanece **desabilitado** para cartões até o motor OptmaPay ter a correção autoritativa de fatura/liquidação e o Golden Debit/Credit passar ponta a ponta.

## Teste automatizado executado no banco

Foi executado um Golden Test transacional com `BEGIN/ROLLBACK` para a camada financeira de cartão. As assertivas passaram para:

- pedido marcado como pago;
- venda bruta de R$ 100;
- taxa de R$ 3;
- recebível líquido de R$ 97;
- exatamente um lançamento de venda;
- exatamente um lançamento de taxa;
- repetição da confirmação sem duplicidade;
- exatamente uma transferência de liquidação;
- repetição da liquidação idempotente.

O teste foi revertido ao final e não deixou pedido sintético persistido.

## Segurança

O OptmaMenu não deve persistir PAN, CVV, PIN ou senha. Enquanto a API Sandbox ainda trabalha com dados de cartão em memória de requisição, a evolução preferida é migrar a entrada pública para token/identificador seguro ou formulário hospedado pelo OptmaPay antes de qualquer caminho compatível com dinheiro real.

## Próximo bloco

O próximo bloco deve corrigir primeiro o motor autoritativo do OptmaPay:

- débito respeitando o plano de liquidação;
- ledger de obrigação/fatura do crédito;
- parcelas por competência;
- recebível do merchant independente da obrigação do pagador;
- `receivable.settled` idempotente;
- teste de saldo do pagador (débito) e de limite/fatura sem débito em conta (crédito).

Só depois disso deve ser ligado `pay_now=true` para débito/crédito no checkout público.

## Backlog deliberadamente fora desta frente

**OptmaPay/OptmaMenu — Boletos e cobranças B2B**

Escopo futuro: emissão, vencimento, juros/multa, baixa, fornecedores, contas a pagar/receber e conciliação. Nenhuma implementação de boleto foi aberta neste bloco.
