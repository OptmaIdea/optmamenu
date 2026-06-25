# Fase 9.13.1I — Mensagens em Configurações

## Status

**Em execução.**

Esta frente iniciou a transformação da área **Mensagens** de Configurações da Loja em uma tela funcional, reutilizando estruturas já existentes e sem criar novas tabelas, migrations ou RPCs.

---

## Objetivo

Organizar as configurações de mensagens da loja para padronizar:

- texto de consentimento exibido ao cliente;
- mensagens padrão para WhatsApp/SMS;
- assinatura das mensagens;
- texto de confirmação de pedido;
- texto de pedido pronto para retirada;
- texto de atualização de entrega;
- mensagem de aniversariantes;
- ativação do OptmaSMSGate;
- token do gateway de SMS.

A frente mantém a decisão de produto já registrada: a central de mensagens segue manual por enquanto. Status como enviado, entregue e lido dependem de integração oficial futura ou marcação manual.

---

## Estruturas usadas

A implementação atual usa estruturas já existentes:

- `stores.config` para textos e flags de mensagens;
- `stores.sms_gateway_token` para token do OptmaSMSGate;
- `get_store_settings_center` para carregar a loja ativa;
- update controlado em `stores` para persistir as configurações.

Não foram criadas novas migrations nesta etapa.

---

## Arquivo principal ajustado

- `src/pages/private/admin/settings/messages/MessageSettings.tsx`

A tela antiga foi reaproveitada e saneada para:

- usar loja ativa via `getActiveStoreId`/contexto de segurança;
- deixar de depender da RPC antiga `update_store_message_settings_admin`;
- respeitar `messages.manage` internamente;
- funcionar em modo leitura quando o usuário tem `messages.view` sem `messages.manage`;
- ocultar o botão de salvar quando não há permissão de edição;
- preservar textos existentes em `stores.config`;
- salvar apenas as chaves de mensagens sem sobrescrever o restante de `stores.config`.

---

## Campos persistidos em `stores.config`

- `custom_consent_text`
- `use_sms_gateway`
- `default_whatsapp_message`
- `order_confirmation_message`
- `order_ready_message`
- `delivery_update_message`
- `birthday_message_template`
- `manual_message_signature`

Campo persistido diretamente em `stores`:

- `sms_gateway_token`

---

## Permissões

A tela usa:

- `messages.view` para visualização;
- `messages.manage` para edição.

O comportamento esperado segue o padrão consolidado da 9.13:

- `view=false`: rota/tela inacessível;
- `view=true` + `manage=false`: leitura, campos desabilitados e botão de salvar oculto;
- `manage=true`: edição e salvamento liberados.

---

## Estado atual da integração

Concluído nesta etapa:

- tela funcional `/admin/messages` saneada;
- carregamento pela loja ativa;
- persistência de consentimento/textos/token;
- proteção interna por `messages.manage`;
- mensagem clara de leitura quando o usuário não pode editar.

Pendente para fechamento completo da aba dentro de Configurações:

- substituir o placeholder de `/admin/settings?tab=messages` pelo componente `MessageSettings` com `withoutHeader=true` e `disabled={!canManageCurrentTab}`;
- validar build local;
- validar fluxo visual para `messages.view=true/manage=false` dentro de Configurações;
- atualizar `docs/README.md` e `docs/PERMISSOES_USUARIOS.md` quando a aba interna estiver concluída funcionalmente.

---

## Observação técnica

Existe uma migration antiga chamada `supabase/migrations/Update Store Message Settings.sql` com a RPC `update_store_message_settings_admin`, mas ela assume `auth.uid() = store_id`, o que não representa o modelo atual de lojas/membros. Por isso a implementação desta frente não depende dessa RPC.

A eventual remoção, substituição ou hardening dessa RPC deve ficar para uma rodada própria de backend/Supabase, sem misturar com a entrega funcional da tela.
