# Pagamentos online — Sandbox próprio + Asaas Sandbox

Data: 2026-08-25
Branch: `agent/homologacao-geral-20260820`

## Objetivo

Homologar e demonstrar pagamentos online sem utilizar CPF, cartão, conta bancária, chave PIX ou dinheiro reais. O desenho deve ser reaproveitável para provedores futuros e permitir gravação do fluxo comercial completo do OptmaMenu.

## Arquitetura aprovada

O OptmaMenu não depende diretamente de um provedor único. A camada de pagamentos registra `provider`, `intent`, `event` e `refund` e mantém o pedido/financeiro como fonte interna auditável.

Provedores iniciais:

1. `optma_sandbox`: simulador descartável e determinístico do OptmaMenu, somente HML;
2. `asaas`: primeiro adaptador externo, inicialmente somente Sandbox.

Fluxo esperado:

`Pedido -> Payment Intent -> Provedor -> Webhook -> estado confirmado -> Pedido -> Livro Diário -> Conta financeira`

Nunca aceitar confirmação financeira apenas porque o frontend declarou pagamento.

## Dados de teste

- somente identidades fictícias;
- cartões oficiais de teste do provedor ou cartões do sandbox interno;
- contas Asaas exclusivamente Sandbox;
- nenhuma API Key no frontend, Git, logs, documentos ou mensagens;
- PAN/CVV nunca persistidos no OptmaMenu;
- dados sintéticos devem ser descartáveis ao final da Golden Run.

## Segredos do Asaas Sandbox

Armazenar somente como secrets das Supabase Edge Functions:

- `ASAAS_SANDBOX_API_KEY_MERCHANT`: chave da conta Sandbox recebedora da Gelinhares;
- `ASAAS_SANDBOX_API_KEY_BUYER`: chave da conta Sandbox do pseudo comprador;
- `ASAAS_SANDBOX_WEBHOOK_TOKEN`: token próprio de autenticação do Webhook, diferente das API Keys.

O token de Webhook deve ter entre 32 e 255 caracteres, sem espaços, e nunca reutilizar uma API Key Asaas.

### Geração segura do token no PowerShell

Compatível também com ambientes Windows PowerShell/.NET em que `RandomNumberGenerator.Fill(...)` não existe:

```powershell
$bytes = New-Object byte[] 48
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
[Convert]::ToBase64String($bytes) | Set-Clipboard
$rng.Dispose()
```

O comando grava o token diretamente na área de transferência e não o imprime no terminal.

Se `RandomNumberGenerator.Fill($bytes)` falhar e depois for executado `ToBase64String($bytes)`, não utilizar o resultado: o array pode continuar preenchido apenas com zeros e gerar um token previsível. Nesse caso, gerar um novo token com o bloco compatível acima e substituir imediatamente qualquer secret já salvo com o valor anterior.

## Edge Functions

- `asaas-sandbox-adapter`: JWT obrigatório; faz chamadas outbound para `https://api-sandbox.asaas.com/v3` e nunca retorna API Keys;
- `asaas-sandbox-webhook`: endpoint público autenticado por `asaas-access-token`, com idempotência de evento.

URL HML do Webhook:

`https://lgkkfmqzaorrutuoqeax.supabase.co/functions/v1/asaas-sandbox-webhook`

### Liquidação financeira do Asaas

- o status `PAYMENT_CONFIRMED` atualiza a intenção para **autorizado**, sem baixa financeira;
- somente `PAYMENT_RECEIVED`, quando o saldo está disponível, marca a intenção e o pedido como **pagos**;
- o webhook chama `apply_online_payment_settlement_internal`, que exige uma conta de liquidação PIX definida explicitamente no provedor e gera no máximo um lançamento de recebimento por pedido;
- a conta selecionada precisa estar ativa, pertencer à loja e aceitar PIX; o sistema não deduz a conta pelo padrão da loja.

A tela de Pagamentos online apresenta nomes amigáveis para capacidades do provedor, conexão e ambientes de teste, e permite selecionar a conta de liquidação do PIX sem expor segredos.

## Permissões

- `payments.online.view`
- `payments.online.manage`
- `payments.online.credentials.manage`
- `payments.online.proofs.review`
- `payments.online.transactions.view`
- `payments.online.refund`
- `payments.online.events.view`

Credenciais são owner-only por padrão.

## Área administrativa

Rota: `/admin/online-payments`

Abas:

- Visão geral
- Provedores
- Transações
- Comprovantes
- Webhooks e eventos
- Laboratório Sandbox

A UI mostra somente o estado da credencial (`aguardando`, `pronto`, `inválido`); nunca o segredo.

## Sequência de homologação

1. Validar laboratório OptmaPay: pendente/aprovado/recusado/expirado/estornado.
2. Configurar as duas API Keys Asaas como secrets.
3. Confirmar conexão e saldos Sandbox pelo adapter.
4. Configurar Webhook Asaas com token separado.
5. Gerar cobrança PIX na conta recebedora.
6. Pagar o QR pela conta Sandbox compradora.
7. Receber Webhook e atualizar `online_payment_intents`.
8. Conectar evento pago ao pedido e à baixa financeira idempotente.
9. Homologar cartão aprovado e recusado com cartões oficiais de teste.
10. Homologar link de pagamento.
11. Homologar comprovante manual e pagamento no recebimento.
12. Homologar estorno total/parcial e conciliação.

## Golden Run posterior

A homologação final criará empresa do zero, identidade visual, estoque, catálogo, usuários/permissões, contas financeiras, pagamentos online, cliente fictício, pedidos, pagamentos, devoluções, relatórios, exclusão dos dados de teste e encerramento/exclusão da empresa. Os fluxos poderão ser gravados como evidência e material de demonstração.
