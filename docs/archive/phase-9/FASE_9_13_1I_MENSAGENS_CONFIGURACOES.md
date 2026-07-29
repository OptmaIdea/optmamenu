# Fase 9.13.1I — Configurações de Mensagens e Atendimento

## Status

**Concluída funcionalmente.**

Documento principal da frente:

- `docs/FASE_9_13_1I_MENSAGENS_ATENDIMENTO.md`

Este arquivo permanece como registro de compatibilidade do início da etapa e aponta para o documento principal atualizado.

---

## Resumo da frente

A frente 9.13.1I transformou a área **Configurações da Loja → Mensagens** em uma tela de governança de comunicação operacional e atendimento, com foco em pequenos lojistas.

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
- A área de Configurações usa permissões próprias `settings.messages.view/manage`.
- Permissões antigas `messages.view/manage` ficam reservadas para Central de Mensagens/Marketing, se necessário em módulo futuro.

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
- comportamento de leitura quando o usuário não tem permissão de edição;
- leitura direta de `stores.config` para garantir persistência após reload.

---

## Persistência atual

Sem tabelas ou RPCs novas para mensagens.

Usa:

- `stores.config.message_settings` para mensagens e consentimento;
- `stores.config.custom_consent_text` para compatibilidade com fluxos já existentes;
- `stores.sms_gateway_token` para OptmaSMSGate.

---

## Permissões finais

Foram criadas permissões dedicadas em migration própria:

- `settings.messages.view`
- `settings.messages.manage`

Migration:

- `supabase/migrations/20260625133000_add_settings_messages_permissions.sql`

A entrega também exigiu ajuste no frontend de Segurança:

- `PERMISSION_GROUP_DEFINITIONS` com prefixo `settings.messages.`;
- `ROLE_PERMISSION_TREE` com item `settings_messages`;
- ordenação visual manual no grupo Configurações.

O aprendizado foi consolidado em:

- `docs/CHECKLIST_NOVAS_PERMISSOES.md`

---

## Validações realizadas

- Build local sem erros.
- Console limpo.
- Persistência em `stores.config.message_settings` validada após reload.
- Aba `/admin/settings?tab=messages` integrada ao componente real.
- Owner/admin/manager validados para edição.
- Permissão Mensagens exibida na matriz de Segurança.
- `MessageSettings.tsx` usando `settings.messages.manage` como padrão final.

---

## Pendências fora da frente

As pendências abaixo pertencem a uma próxima rodada de Segurança/Funções personalizadas:

- revisar realtime/listener para refletir alterações de permissões entre usuários sem reload em todos os fluxos;
- revisar exibição de nome de colaborador quando cai para e-mail;
- revisar atribuição/revogação de permissões em funções personalizadas;
- validar herança de papel base e overrides de `store_custom_roles.permissions`;
- garantir versionamento em `store_permission_versions` quando funções personalizadas forem alteradas.

---

## Observação técnica

Existe uma migration antiga chamada `supabase/migrations/Update Store Message Settings.sql` com a RPC `update_store_message_settings_admin`, mas ela assume `auth.uid() = store_id`, o que não representa o modelo atual de lojas/membros. Por isso a implementação desta frente não depende dessa RPC.

A eventual remoção, substituição ou hardening dessa RPC deve ficar para uma rodada própria de backend/Supabase, sem misturar com a entrega funcional da tela.
