# Fase 9.14E.19 — Fechamento do bloco Usuários/Segurança

## Status

Concluída.

Esta etapa fecha documentalmente o grupo `users_security_permissions` da auditoria 9.14E.

## Base validada

Após a 9.14E.18:

- total geral: **125 funções** executáveis por `authenticated`;
- grupo `users_security_permissions`: **23 funções**.

## Resultado acumulado do bloco

O grupo `users_security_permissions` foi reduzido de **58** funções na classificação inicial para **23** funções remanescentes.

Redução no bloco:

- **35 funções removidas da superfície authenticated**.

## Diretriz aplicada

As revogações foram feitas apenas quando havia evidência de função legada, duplicada, sem chamada direta operacional atual ou substituída por fluxo mais novo.

Foram preservadas funções com pelo menos um dos critérios abaixo:

- uso direto em hooks, services ou telas;
- helper central usado por múltiplas RPCs `SECURITY DEFINER`;
- gate transversal de RLS/permissões;
- fluxo ativo de Segurança/Usuários;
- função necessária para convites, logs, papéis, permissões ou avatar;
- função de settings de segurança usada pelo módulo Segurança/idle session.

## Funções remanescentes por categoria

### Helpers centrais de vínculo/permissão

Preservadas como exceções intencionais:

- `is_store_member(p_store_id uuid)`;
- `user_has_store_permission(p_store_id uuid, p_permission_code text)`;
- `user_has_store_permission_v2(p_store_id uuid, p_permission_code text)`.

Motivo:

- são gates transversais usados por diversas RPCs administrativas e operacionais;
- remover `authenticated` sem análise global poderia quebrar funções dependentes, guards e políticas;
- devem ser tratados como núcleo do modelo de permissões.

### Permissões do usuário atual e matriz

Preservadas:

- `get_current_user_store_permissions_v2(p_store_id uuid)`;
- `get_store_permission_matrix_v3(p_store_id uuid)`;
- `get_store_member_permission_detail(p_member_id uuid)`;
- `get_store_members_for_permissions(p_store_id uuid)`;
- `update_store_member_permissions(...)`.

Motivo:

- fluxo ativo da tela Segurança/Permissões;
- matriz v3 é o caminho atual;
- permissões efetivas no frontend dependem de `get_current_user_store_permissions_v2`.

### Papéis e funções customizadas

Preservadas:

- `set_store_role_permission_v3(...)`;
- `set_store_role_permissions_bulk_v3(...)`;
- `assign_store_custom_role_to_member(...)`;
- `change_store_member_role(...)`.

Motivo:

- fluxos ativos de edição de permissões por papel;
- fluxos ativos de custom roles;
- já exigem gate de Segurança, vínculo de loja e validação de permissão/catálogo.

### Convites e onboarding ativo

Preservadas:

- `accept_store_member_invite(...)`;
- `decline_my_store_member_invite(...)`;
- `get_my_pending_store_invites()`;
- `get_store_member_invites(p_store_id uuid)`;
- `create_store_member_invite(...)`;
- `cancel_store_member_invite(...)`.

Motivo:

- fluxos ativos de convite pessoal e administrativo;
- necessários para entrada/gestão de membros.

### Logs, histórico e ocorrências ativas

Preservadas:

- `get_store_security_activity_logs(...)`;
- `get_my_visible_activity_logs(...)`;
- `insert_security_log(...)`;
- `get_store_member_full_history(...)`;
- `get_store_member_session_summary(p_store_id uuid)`;
- `create_store_member_occurrence_v2(...)`.

Motivo:

- tela Segurança usa Histórico de atividades;
- Meu Histórico usa logs visíveis;
- `insert_security_log` é usado por tela, utilitários e RPCs internas;
- histórico completo e ocorrências são fluxos ativos da gestão de membros.

### Segurança/settings e avatar

Preservadas:

- `get_store_security_settings(p_store_id uuid)`;
- `update_store_member_avatar_url(...)`.

Motivo:

- `get_store_security_settings` é usado pelo módulo Segurança e pelo fluxo de idle session;
- `update_store_member_avatar_url` é o fluxo ativo de atualização de avatar de membro.

## Funções removidas no bloco

Durante as etapas 9.14E.13 a 9.14E.18, foram removidos grants diretos de `authenticated` de funções legadas/duplicadas/inativas relacionadas a:

- contexto de segurança legado;
- matriz antiga de permissões;
- membros antigos v1/v2;
- onboarding/perfil próprio legado;
- solicitações de alteração de perfil sem uso atual;
- logs antigos;
- helpers de catálogo/permissões sem chamada operacional atual;
- perfil administrativo legado.

## Hardening futuro recomendado

Sem nova migration nesta etapa.

Pontos recomendados para evolução futura:

1. Substituir gates genéricos `is_store_member` por permissões granulares quando o fluxo for sensível.
2. Reforçar leitura de Segurança com `security.view` onde ainda houver apenas vínculo de loja.
3. Reforçar ações de Segurança com `security.manage` ou seções específicas.
4. Revisar se `insert_security_log` deve permanecer chamável diretamente pelo cliente ou migrar parte dos usos para backend/service_role.
5. Mapear dependências internas dos helpers centrais antes de qualquer revogação adicional.

## Decisão final do bloco

Não criar nova migration nesta etapa.

O grupo `users_security_permissions` fica fechado como **exceção intencional documentada** com **23 funções remanescentes**, preservadas por uso ativo ou papel central no sistema.

## Próxima etapa recomendada

### 9.14E.20 — `internal_technical_candidate` remanescente

O diagnóstico ainda mostra 2 funções em `internal_technical_candidate`:

- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`.

Essas já foram classificadas na 9.14E.12 como exceções intencionais, mas podem receber um fechamento curto no consolidado final da 9.14E.

### Depois

Avançar para o grupo `uncategorized_review`, que ainda possui **37 funções** e deve ser tratado em subgrupos pequenos.
