# Fase 9.13.1I — Configurações de Mensagens e Atendimento

## Status

**Em execução.**

Documento principal da frente:

- `docs/FASE_9_13_1I_MENSAGENS_ATENDIMENTO.md`

Este arquivo permanece como registro de compatibilidade do início da etapa e aponta para o documento principal atualizado.

---

## Resumo da frente

A frente 9.13.1I transforma a área **Configurações da Loja → Mensagens** em uma tela de governança de comunicação operacional e atendimento, com foco em pequenos lojistas.

A etapa respeita a identidade construída para o OptmaMenu:

- simplicidade para o lojista;
- atendimento acolhedor;
- comunicação responsável;
- segurança de dados;
- separação entre mensagens operacionais e marketing;
- cuidado com WhatsApp, LGPD e reputação da loja.

---

## Decisões consolidadas

- Mensagens operacionais entram nesta etapa.
- Promoções, campanhas e disparos em massa ficam para a Central de Marketing.
- Mascote/personagem fica para módulo futuro de Identidade de Comunicação.
- O WhatsApp permanece como canal principal, mas o envio automático depende de integração oficial futura.
- Status entregue/lido não deve ser prometido sem API oficial ou marcação manual.
- Não criar SQL, migrations, tabelas ou RPCs sem confirmação explícita.

---

## Arquivo principal ajustado

- `src/pages/private/admin/settings/messages/MessageSettings.tsx`

A tela foi evoluída para conter:

- cards de orientação e risco;
- texto de consentimento;
- grupos de mensagens;
- editor com textarea;
- contador de caracteres;
- variáveis clicáveis;
- prévia com dados fictícios;
- classificação de risco;
- botões de restauração de padrão;
- persistência em `stores.config.message_settings`;
- compatibilidade com `stores.config.custom_consent_text`;
- token SMS em `stores.sms_gateway_token`;
- comportamento de leitura quando o usuário não tem permissão de edição.

---

## Persistência atual

Sem migrations novas.

Usa:

- `stores.config.message_settings` para mensagens e consentimento;
- `stores.config.custom_consent_text` para compatibilidade com fluxos já existentes;
- `stores.sms_gateway_token` para OptmaSMSGate.

---

## Permissões atuais e futuras

Compatibilidade atual:

- `messages.view`
- `messages.manage`

A tela já reconhece a permissão futura:

- `settings.messages.manage`

Recomendação futura:

- criar `settings.messages.view`;
- criar `settings.messages.manage`;
- manter `messages.view/manage` para Central de Mensagens, envio manual e marketing.

Essa criação depende de SQL/backfill aprovado em rodada própria.

---

## Pendências para fechamento funcional

- Integrar o componente real na aba `/admin/settings?tab=messages`, substituindo o placeholder atual de `StoreSettings.tsx`.
- Validar `npm run build` local.
- Validar console limpo.
- Validar owner/editável.
- Validar usuário com `view=true/manage=false` em leitura.
- Validar usuário sem view sem acesso à aba.
- Avaliar criação de `settings.messages.view/manage` em rodada SQL separada.

---

## Observação técnica

Existe uma migration antiga chamada `supabase/migrations/Update Store Message Settings.sql` com a RPC `update_store_message_settings_admin`, mas ela assume `auth.uid() = store_id`, o que não representa o modelo atual de lojas/membros. Por isso a implementação desta frente não depende dessa RPC.

A eventual remoção, substituição ou hardening dessa RPC deve ficar para uma rodada própria de backend/Supabase, sem misturar com a entrega funcional da tela.
