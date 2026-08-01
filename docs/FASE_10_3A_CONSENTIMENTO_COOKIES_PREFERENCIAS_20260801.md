# Fase 10.3A — Consentimento de cookies e preferências

Data: 2026-08-01

## Objetivo

Iniciar o bloco legal e de consentimento da loja pública com uma experiência clara, mobile-first e versionada para cookies essenciais, analytics e marketing.

## Estado anterior

O componente global `CookieConsent` oferecia apenas duas decisões:

- aceitar todos os cookies;
- rejeitar cookies não essenciais.

O consentimento era salvo em chaves simples do `localStorage`, sem detalhamento por categoria, data da decisão ou objeto versionado.

## Entrega

O componente foi evoluído para oferecer:

1. **Só essenciais**;
2. **Preferências**;
3. **Aceitar todos**.

Na área de preferências, o usuário pode controlar separadamente:

- analytics;
- marketing.

Cookies essenciais permanecem sempre ativos porque sustentam funções como:

- carrinho persistente;
- autenticação;
- segurança da sessão;
- preferências básicas do dispositivo.

## Persistência

O consentimento passa a ser salvo em:

```text
optmamenu.cookieConsent
```

Formato:

```json
{
  "version": "3.0",
  "essential": true,
  "analytics": false,
  "marketing": false,
  "decidedAt": "2026-08-01T00:00:00.000Z"
}
```

Quando a versão muda, o banner é exibido novamente para nova decisão.

As chaves legadas `APP_COOKIE_CONSENT` e `APP_COOKIE_CONSENT_VERSION` continuam sendo preenchidas temporariamente para compatibilidade.

## Evento de integração

Após salvar a decisão, o frontend dispara:

```text
optmamenu:cookie-consent
```

Esse evento poderá ser usado futuramente para inicializar ou bloquear serviços de analytics e marketing somente depois do consentimento correspondente.

## Limpeza de cookies opcionais

Quando analytics ou marketing não são autorizados, o componente tenta remover os cookies opcionais conhecidos dessas categorias.

Essa limpeza não substitui o bloqueio preventivo: integrações futuras deverão consultar o consentimento antes de carregar scripts externos.

## Links legais

O banner aponta para a política pública de privacidade já existente.

A política de cookies ainda não possui rota pública dedicada nesta branch. Por isso, o link informativo atual utiliza a seção `#cookies` da política de privacidade, evitando rota inexistente.

## Pendências do bloco legal

- criar documento público dedicado de política de cookies;
- versionar termos, política de privacidade e política de cookies no backend;
- registrar aceite na conta do cliente autenticado;
- permitir revisão posterior das preferências fora do banner;
- bloquear tecnicamente scripts opcionais antes do consentimento;
- definir retenção e auditoria dos aceites;
- adaptar textos legais por loja quando aplicável, preservando a camada geral do OptmaMenu.

## Arquivo alterado

```text
src/components/common/CookieConsent.tsx
```

## Validação recomendada

1. limpar `optmamenu.cookieConsent` no `localStorage`;
2. recarregar a página e confirmar a abertura do banner;
3. testar `Só essenciais`;
4. testar seleção individual em `Preferências`;
5. confirmar o JSON salvo e a versão `3.0`;
6. alterar manualmente a versão armazenada e confirmar nova exibição;
7. verificar comportamento em mobile e desktop;
8. executar build e observar o console.
