# Credenciais OptmaPay Sandbox — configuração segura

**Data:** 27/09/2026  
**Uso:** OptmaMenu ↔ OptmaPay Sandbox

As credenciais do OptmaPay não devem ser enviadas por chat, gravadas em Git, `public_config`, `metadata`, `localStorage` ou logs.

O OptmaMenu usa o **Supabase Vault** para armazenar:

- API key `sk_test_optmapay_...`;
- webhook secret `whsec_optmapay_...`.

O banco público mantém apenas referências determinísticas aos secrets.

## Fluxo para a loja

1. No OptmaPay, abra **Painel do Desenvolvedor**.
2. Gere uma API key Sandbox com, no mínimo, `account:read` para o teste de conexão. Para as próximas etapas, manter também os escopos que forem efetivamente homologados.
3. Cadastre o endpoint de webhook que o OptmaMenu exibe na tela **Financeiro → Pagamentos online → Provedores**.
4. Copie a API key e o webhook secret quando forem exibidos pelo OptmaPay — ambos aparecem integralmente apenas no momento da geração/rotação.
5. Cole os valores diretamente no formulário seguro do OptmaMenu. Não envie esses valores por WhatsApp, e-mail ou chat.
6. Selecione a conta financeira de liquidação da loja.
7. Salve e execute **Testar conexão**.

## Segurança

- O formulário exige usuário autenticado com permissão `payments.online.credentials.manage` ou owner.
- O browser envia os segredos apenas à Edge Function autenticada `optmapay-credentials`.
- A Edge Function não registra os segredos em logs.
- O PostgreSQL persiste os valores exclusivamente no Supabase Vault.
- O adapter e o receiver de webhook recuperam o secret somente server-side.
- A UI recebe somente flags `apiKeyConfigured` e `webhookSecretConfigured`.

## Rotação

Para rotacionar:

1. gere/rotacione no OptmaPay;
2. cole apenas o novo valor no campo correspondente;
3. deixe o outro campo vazio para preservá-lo;
4. salve novamente;
5. teste a conexão;
6. para webhook secret, valide um evento assinado depois da rotação.

## Endpoint de webhook

A URL é derivada do próprio projeto Supabase do OptmaMenu:

`<SUPABASE_URL>/functions/v1/optmapay-sandbox-webhook`

A tela administrativa mostra o valor exato para copiar.
