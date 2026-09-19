# Fase 10.3A — Política pública de cookies e reabertura de preferências

Data: 2026-08-01

## Objetivo

Complementar o consentimento versionado com uma página pública dedicada à política de cookies e permitir que o usuário revise sua decisão depois do primeiro acesso.

## Entregas

### Página pública

Foi criada a rota pública:

```text
/politica-cookies
```

A página informa:

- o que são cookies e tecnologias locais semelhantes;
- categorias essenciais, analytics e marketing;
- dados mantidos localmente para carrinho, checkout e preferências;
- versionamento da política;
- retenção e limpeza;
- relação com a política de privacidade;
- botão para gerenciar novamente as preferências.

### Reabertura das preferências

O componente global de consentimento passou a ouvir o evento:

```text
optmamenu:open-cookie-preferences
```

Ao receber o evento, o painel:

1. relê a decisão atual do dispositivo;
2. restaura as opções de analytics e marketing;
3. abre diretamente a tela de preferências;
4. permite salvar uma nova decisão versionada.

A página de política de cookies dispara esse evento pelo botão "Gerenciar preferências de cookies".

### Navegação

O banner de consentimento agora aponta para:

- `/politica-privacidade`;
- `/politica-cookies`.

A rota da política de cookies foi exposta no nível superior da aplicação para permanecer disponível independentemente do contexto da loja, área pública institucional ou autenticação.

## Contratos preservados

- cookies essenciais permanecem sempre ativos;
- analytics e marketing continuam desativados sem autorização;
- a decisão continua armazenada em `optmamenu.cookieConsent`;
- a versão atual do consentimento permanece `3.0`;
- integrações futuras continuam dependentes do evento `optmamenu:cookie-consent`;
- nenhum dado de aceite foi persistido no backend nesta entrega.

## Arquivos alterados

```text
src/pages/initial/legal/CookiePolicy.tsx
src/components/common/CookieConsent.tsx
src/App.tsx
docs/FASE_10_3A_POLITICA_COOKIES_PUBLICA_20260801.md
```

## Validação recomendada

1. abrir `/politica-cookies` diretamente;
2. testar navegação a partir do banner de cookies;
3. aceitar somente essenciais;
4. reabrir as preferências pela política;
5. ativar apenas analytics e salvar;
6. recarregar e confirmar que a decisão foi mantida;
7. executar `npm run build`;
8. verificar console e navegação em mobile e desktop.

## Próximos passos legais

- revisar o conteúdo jurídico final com responsável competente;
- alinhar versões de termos, privacidade e cookies;
- criar registro backend de aceite para clientes autenticados;
- disponibilizar histórico de documentos aceitos na área do cliente;
- definir política de atualização e reaceite por versão.
