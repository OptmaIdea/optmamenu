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
- `20261003174902_optmapay_card_method_adapter_enablement`;
- `20261003175622_optmapay_card_workspace_hardening`;
- `20261003175742_optmapay_card_pay_now_checkout`;
- `20261003175906_optmapay_card_pay_now_release_gate`.

A fundação adiciona:

- `online_payment_receivables`;
- conta transitória `Valores a receber — OptmaPay` (`card_receivable`);
- conta do plano `payment_processing_fees`;
- separação de bruto, taxa, taxa de antecipação e líquido;
- status e datas de recebível/liquidação;
- RPC de criação/reuso de intent de cartão;
- RPC de confirmação comercial de cartão;
- RPC de liquidação posterior do recebível;
- exposição dos recebíveis no workspace administrativo de pagamentos online;
- execução do workspace administrativo revogada para `anon` e mantida apenas para `authenticated`/`service_role`.

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

Os métodos de débito e crédito foram ligados ao provider em metadata. Houve uma habilitação intermediária de `pay_now`, mas a auditoria detectou que o frontend ainda não fechava o ciclo de cobrança e que o motor OptmaPay ainda possui as lacunas de fatura/liquidação descritas acima. A migration de gate `20261003175906` voltou `pay_now=false`; portanto cartão permanece **deliberadamente não exposto** até o Golden Debit/Credit passar ponta a ponta.

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


## Atualização 2026-10-04 — C2/C3 executado no OptmaPay

Os bloqueios externos descritos acima foram removidos. O projeto Supabase OptmaPay `wertmoquxdrucdbobuie`, o repositório canônico `OptmaIdea/optmapay`, o repositório de deploy `EduSouza-OptmaIdea/optmapay` e o projeto Vercel do OptmaPay passaram a estar acessíveis operacionalmente.

Foi aplicada no Supabase OptmaPay a migration `20261004020711_card_ledger_and_settlement_authority`, que introduziu:

- ledger autoritativo de recebíveis de cartão em `card_receivables`;
- faturas e itens de fatura persistidos no banco;
- pagamentos e alocações de fatura;
- cálculo de vencimento de parcelas;
- liquidação idempotente de recebíveis;
- evento `receivable.settled`;
- separação entre obrigação do pagador e recebível do merchant;
- validação de escopo `cards:charge`;
- endurecimento das permissões de RPC.

Também foi removido do cliente OptmaPay o fallback que fazia crédito direto de saldo quando a RPC `release_d1_settlement` falhava. A liquidação passou a falhar fechada e permanecer sob autoridade do servidor.

Durante a primeira execução do Golden Test foi encontrado um defeito real no contrato de resposta da RPC `process_card_payment`: uma chamada única de `jsonb_build_object` ultrapassava o limite de 100 argumentos do PostgreSQL. A correção foi aplicada em `20261004024451_card_response_payload_argument_limit_fix`.

Em seguida foi aplicado e executado o harness `20261004024651_card_golden_regression_harness_v2`.

### Golden Debit — aprovado

O teste transacional validou:

- débito do saldo do pagador exatamente uma vez;
- merchant sem crédito antes do vencimento D+1;
- recebível bruto R$ 10,00;
- taxa R$ 0,09;
- líquido R$ 9,91;
- replay da cobrança idempotente;
- bloqueio de liquidação antecipada;
- replay da liquidação idempotente.

### Golden Credit — aprovado

O teste transacional validou:

- conta corrente não debitada no momento da compra;
- limite consumido exatamente uma vez;
- fatura autoritativa criada;
- replay da cobrança idempotente;
- pagamento da fatura debitando a conta corrente;
- pagamento restaurando o limite;
- liquidação do merchant independente da obrigação do pagador.

O próprio harness executa os cenários em subtransações e reverte as alterações de validação, sem deixar efeitos financeiros de teste.

### Estado de release no OptmaMenu

O gate público foi atualizado para `card_public_release_state=golden_passed_pending_e2e`, mantendo `pay_now=false`.

Portanto o motor autoritativo do OptmaPay já passou Golden Debit/Credit, mas cartão ainda não foi liberado ao cliente final. Falta somente a validação E2E real da ponte:

`OptmaMenu → API OptmaPay → Supabase OptmaPay → webhook assinado → OptmaMenu`.

O PIX permanece inalterado e habilitado.


## Atualização 2026-10-04 — E2E de webhook e endurecimento final

Foi executada uma validação HTTP real entre o ambiente do OptmaMenu e a Edge Function `optmapay-sandbox-webhook`, usando assinatura HMAC válida calculada a partir do segredo armazenado no Vault.

O cenário de débito homologado utilizou um pedido sintético de R$ 3,75 e validou:

- `card.paid` aceito pela Edge Function com HTTP 200;
- intent alterada para `paid`;
- pedido marcado como pago;
- timer/reserva suspenso após confirmação;
- recebível criado como `scheduled`;
- bruto R$ 3,75;
- taxa R$ 0,03;
- líquido R$ 3,72;
- dois lançamentos financeiros na confirmação: venda + taxa;
- `receivable.settled` aceito via HTTP 200;
- liquidação de R$ 3,72;
- criação de uma única transferência financeira de liquidação;
- ausência de duplicação de receita.

Todos os pedidos, intents, eventos, recebíveis, lançamentos e reservas sintéticos usados nessa validação foram removidos ao final. A limpeza confirmou zero pedidos, intents, lançamentos e reservas ativas remanescentes do teste.

Também foi executada uma chamada HTTP real do OptmaMenu para `https://optmapay.optmaidea.com.br/api/sandbox/v1/account` utilizando a API key armazenada no Vault. O OptmaPay respondeu HTTP 200, com `environment=sandbox` e `realMoney=false`, confirmando que a credencial, a conta merchant e o domínio publicado estão operacionais.

### Falha encontrada durante a homologação de liquidação

A configuração de webhook do merchant principal recebia `pix.paid` e `card.paid`, porém não estava inscrita nos eventos de liquidação. Isso impediria que o D+1 real notificasse o OptmaMenu.

Foi aplicada no OptmaPay a migration:

- `20261004030915_optmamenu_webhook_settlement_subscription_hardening`.

Ela:

- adiciona `receivable.settled` e `payment.settled` ao webhook oficial do OptmaMenu;
- mantém o endpoint oficial da Edge Function ativo;
- desativa dois endpoints antigos de teste (`webhook.site` e uma URL de tela administrativa que não é endpoint de webhook).

A migration foi gravada nos repositórios `OptmaIdea/optmapay` e `EduSouza-OptmaIdea/optmapay` e o espelho de deploy obteve status Vercel `success`.

### Estado atual do gate

O gate público continua deliberadamente fechado:

- `debit_card.pay_now=false`;
- `credit_card.pay_now=false`;
- estado `golden_passed_pending_e2e`;
- PIX permanece `pay_now=true`.

O motor autoritativo, o Vault, o domínio publicado, o HMAC, a confirmação financeira e a liquidação já foram validados.

O único passo que não foi automatizado nesta sessão é a submissão do PAN/CVV do cartão fictício através do formulário público, porque a camada de segurança da ferramenta impede o envio programático desses campos mesmo sendo Sandbox. Esse teste deve ser executado manualmente no navegador após a abertura controlada do gate de homologação.


## Atualização 2026-10-04 — E2E manual aprovado e liberação Sandbox

Os dois cenários públicos de cartão foram executados manualmente na loja Gelinhares com cartões fictícios do OptmaPay Sandbox.

### Débito

Pedido `PED-20261004-001552-00FC`.

- A primeira tentativa com CVV incorreto foi recusada com HTTP 422, sem criar venda paga ou recebível.
- Após correção do CVV, o pagamento foi confirmado.
- OptmaPay registrou saída de R$ 3,75 na conta pagadora.
- OptmaMenu registrou venda bruta de R$ 3,75 e taxa de R$ 0,03 em lançamentos separados.
- Recebível líquido de R$ 3,72 ficou agendado para liquidação D+1.
- Reserva permaneceu ativa com `expires_at=infinity` após o pagamento, sem baixa física prematura.

### Crédito

Pedido `PED-20261004-001552-2CE5`.

- Pagamento autorizado e confirmado via webhook.
- Limite do cartão foi consumido em R$ 3,75.
- Fatura autoritativa criada para vencimento em 10/11/2026, com fechamento em 03/11/2026.
- A conta corrente do portador não é debitada no motor no momento da compra.
- Recebível do lojista: bruto R$ 3,75, taxa R$ 0,11, líquido R$ 3,64, agendado para D+1.
- Reserva permaneceu ativa com `expires_at=infinity`.

O Golden harness foi executado novamente após o E2E e continuou retornando `checkingNotDebitedAtPurchase=true` para crédito, além das invariantes de débito, idempotência, fatura e liquidação.

### Correções de interface decorrentes da homologação

1. O Dashboard do OptmaPay tratava a linha informativa de compra no cartão de crédito como se fosse saída da conta corrente ao reconstruir o extrato. O motor financeiro estava correto; a classificação visual estava errada. A linha de compra a crédito foi retirada do cálculo/extrato da conta corrente e permanece na fatura/cartão.
2. O Dashboard do merchant OptmaPay passou a mostrar, para recebíveis futuros de cartão, os valores de venda bruta, taxa e líquido, mantendo o valor líquido como montante futuro de caixa.
3. O OptmaMenu já persistia `online_payment_receivables`, mas o cliente do workspace descartava o campo retornado pela RPC. Foi adicionada a aba **Recebíveis** em Financeiro → Pagamentos online, com bruto, taxa, líquido, plano e previsão de liquidação.
4. A recusa por CVV incorreto continua usando HTTP 422, mas o frontend agora extrai a mensagem da Edge Function e apresenta erro amigável em vez de apenas `Edge Function returned a non-2xx status code`.
5. A exibição da data de liquidação foi protegida contra deslocamento de fuso na interface.

### Release gate

Após Golden Debit, Golden Credit e E2E manual de débito/crédito aprovados, foi aplicada a migration:

- `20261004020821_optmapay_card_sandbox_e2e_release`.

Para a Gelinhares:

- `debit_card.checkout.pay_now=true`;
- `credit_card.checkout.pay_now=true`;
- estado `e2e_approved_sandbox`;
- PIX permanece habilitado;
- o método legado `debit_card_debito_infinitepay` permanece oculto/bloqueado.

A liberação é exclusivamente Sandbox. `realMoney=false` continua obrigatório em toda a fronteira OptmaMenu ↔ OptmaPay.
