# Pacote 02A — Fundação do adapter Pix OptmaPay no OptmaMenu

**Data:** 27/09/2026  
**Branch:** `agent/homologacao-geral-20260820`  
**OptmaPay homologado:** `90c84a7e7380de12b260474bab8967ff13f207f9`  
**Status:** fundação implementada e publicada; E2E financeiro depende apenas da configuração segura das credenciais sandbox do merchant e do webhook.

## 1. Decisão arquitetural

O OptmaPay entra como implementação do provider já existente `optma_sandbox`.

Não foram criadas tabelas paralelas de pagamentos. Permanecem canônicos:

- `store_online_payment_providers`;
- `online_payment_intents`;
- `online_payment_events`;
- `online_payment_refunds`;
- `apply_online_payment_settlement_internal`;
- pedido, reserva, estoque e Livro Diário do OptmaMenu.

O Asaas passa a ser legado e não recebe novas funcionalidades.

## 2. Entregas de código

Commits:

- `ade0298fbb476a75b71c90f6aeb3fb1c7f959808` — fundação do adapter Pix;
- `79b619b7d05f05d14bec259ecac100f38db2b4ee` — tightening de segurança e capabilities Pix-only.

Arquivos principais:

- `supabase/functions/optmapay-sandbox-adapter/index.ts`;
- `supabase/functions/optmapay-sandbox-webhook/index.ts`;
- `supabase/functions/_shared/optmapayWebhook.ts`;
- `supabase/migrations/20260927204500_optmapay_provider_adapter_foundation.sql`;
- `supabase/migrations/20260927211500_optmapay_provider_pix_only_security_tightening.sql`;
- `src/__tests__/services/optmaPayWebhook.test.ts`.

## 3. Adapter Pix

O adapter:

- exige sessão válida do OptmaMenu;
- reutiliza `get_online_payments_workspace_safe` para autorização;
- usa somente `provider_code=optma_sandbox`, `environment=sandbox`;
- consulta o OptmaPay oficial em `/api/sandbox/v1/account`;
- valida `environment=sandbox` e `realMoney=false`;
- nunca devolve API key ao navegador;
- cria `online_payment_intent` na infraestrutura existente;
- usa referência estável `optmamenu:{store_id}:{intent_id}:pix`;
- produz instrução Pix sandbox incorporando valor, referência e expiração;
- mantém cartão/link/refund desabilitados nesta etapa até homologação específica.

## 4. Receiver do webhook

O receiver público possui autenticação própria e não usa JWT do navegador.

Valida:

- raw body;
- `x-optmapay-signature`;
- `x-optmapay-timestamp`;
- `x-optmapay-event-id`;
- `x-optmapay-event`;
- `x-optmapay-environment=sandbox`;
- `x-optmapay-real-money=false`;
- HMAC-SHA256 v1 sobre `timestamp.event_id.raw_body`;
- janela anti-replay de 300 segundos;
- comparação via `crypto.subtle.verify`;
- referência do intent;
- provider/store;
- merchant recebedor;
- valor recebido.

Eventos são deduplicados em `online_payment_events` e a liquidação reutiliza `apply_online_payment_settlement_internal`.

## 5. Segurança das credenciais

O banco guarda apenas referências a secrets.

RPC:

`configure_optmapay_sandbox_provider_safe(store_id, account_id, api_key_secret_ref, webhook_secret_ref, settlement_financial_account_id)`

Regras:

- somente owner ou `payments.online.credentials.manage`;
- referências de secrets restritas ao namespace `OPTMAPAY_*`;
- API key e webhook secret permanecem server-side;
- conta financeira de liquidação precisa pertencer à própria loja;
- nenhum secret é devolvido em respostas públicas.

Secrets esperados como padrão:

- `OPTMAPAY_SANDBOX_API_KEY`;
- `OPTMAPAY_SANDBOX_WEBHOOK_SECRET`;
- opcionalmente `OPTMAPAY_SANDBOX_BASE_URL`.

## 6. Publicação realizada

Supabase OptmaMenu `lgkkfmqzaorrutuoqeax`:

- migrations da fundação/tightening aplicadas;
- Edge Function `optmapay-sandbox-adapter` publicada;
- Edge Function `optmapay-sandbox-webhook` publicada;
- adapter com `verify_jwt=true`;
- webhook com `verify_jwt=false` porque autentica por HMAC próprio.

GitHub Actions dos commits de implementação: **success**.

Vercel Preview correspondente ao commit de tightening: **READY**.

## 7. Testes automáticos adicionados

Cobertura explícita:

- HMAC válido;
- payload adulterado;
- replay fora de 300 segundos;
- referência estável do intent Pix.

A suíte geral e o build do OptmaMenu passaram no GitHub Actions.

## 8. Dependência externa antes do primeiro E2E

Ainda é necessário provisionar no OptmaPay uma credencial sandbox do merchant com os escopos mínimos e cadastrar o webhook do OptmaMenu.

Depois, configurar no runtime Supabase do OptmaMenu os secrets correspondentes e associar:

- account ID OptmaPay;
- referência da API key;
- referência do webhook secret;
- conta financeira de liquidação da loja.

Nenhum desses valores deve ser gravado em Git, documentação, `public_config` ou frontend.

## 9. E2E obrigatório na próxima rodada

1. status do adapter retorna conexão válida;
2. criar intent Pix associado a pedido real;
3. pagar pelo ambiente OptmaPay sandbox;
4. receber `pix.paid` assinado;
5. confirmar HMAC e merchant;
6. liquidar pedido uma vez;
7. interromper timer;
8. manter reserva;
9. não baixar estoque físico;
10. criar um único lançamento financeiro;
11. reenviar o mesmo evento e comprovar no-op;
12. adulterar valor e comprovar rejeição;
13. adulterar assinatura e comprovar rejeição;
14. enviar timestamp antigo e comprovar rejeição.

## 10. Provedor real futuro

Ver:

- `docs/GUIA_RAPIDO_INFINITEPAY_OPTMAMENU_20260927.md`.

A InfinitePay é a primeira referência operacional de provider real, mas não altera o contrato interno do OptmaMenu. Outros adapters (Inter, C6, Mercado Pago etc.) deverão seguir o mesmo princípio.
