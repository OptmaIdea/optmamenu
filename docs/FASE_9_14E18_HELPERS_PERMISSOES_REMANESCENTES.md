# Fase 9.14E.18 — Helpers centrais e permissões remanescentes

## Status

Correção preparada.

Esta etapa continua o fechamento incremental do grupo `users_security_permissions`.

## Base atual

Após a 9.14E.17:

- total geral: **128 funções** executáveis por `authenticated`;
- grupo `users_security_permissions`: **26 funções**.

## Recorte desta rodada

Foram avaliadas funções remanescentes de permissões, catálogo, matriz, helpers centrais e visibilidade de logs.

## Funções preservadas

Mantidas por uso direto, papel central ou dependência transversal do sistema:

### Helpers centrais

- `is_store_member(p_store_id uuid)`;
- `user_has_store_permission(p_store_id uuid, p_permission_code text)`;
- `user_has_store_permission_v2(p_store_id uuid, p_permission_code text)`.

Motivo: são gates usados em múltiplas RPCs `SECURITY DEFINER` e fluxos de RLS/permissões. Revogar direto sem análise global poderia quebrar guards, hooks ou funções internas.

### Permissões do usuário atual

- `get_current_user_store_permissions_v2(p_store_id uuid)`.

Motivo: chamada direta ativa no `permissionService`, usada para resolver permissões efetivas no frontend.

### Matriz/membros/permissões

- `get_store_permission_matrix_v3(p_store_id uuid)`;
- `get_store_member_permission_detail(p_member_id uuid)`;
- `get_store_members_for_permissions(p_store_id uuid)`;
- `update_store_member_permissions(...)`.

Motivo: fluxos ativos da tela de Segurança/Permissões.

### Papéis/funções customizadas

- `assign_store_custom_role_to_member(...)`;
- `change_store_member_role(...)`;
- `set_store_role_permission_v3(...)`;
- `set_store_role_permissions_bulk_v3(...)`.

Motivo: fluxos ativos de papéis, funções personalizadas e edição de permissões por papel.

### Convites, logs e usuário

- `accept_store_member_invite(...)`;
- `decline_my_store_member_invite(...)`;
- `get_my_pending_store_invites()`;
- `get_store_member_invites(p_store_id uuid)`;
- `cancel_store_member_invite(...)`;
- `create_store_member_invite(...)`;
- `get_store_member_session_summary(p_store_id uuid)`;
- `get_store_member_full_history(...)`;
- `create_store_member_occurrence_v2(...)`;
- `update_store_member_avatar_url(...)`;
- `get_store_security_activity_logs(...)`;
- `get_store_security_settings(p_store_id uuid)`;
- `insert_security_log(...)`.

Motivo: fluxos ativos já preservados em etapas anteriores.

## Funções candidatas tratadas

Sem uso direto operacional atual identificado como RPC ativa:

- `get_effective_store_member_permissions_v2(p_store_id uuid, p_member_id uuid)`;
- `get_store_permission_catalog()`;
- `update_security_log_member_visibility(p_log_id uuid, p_visible_to_member boolean, p_sensitive boolean)`.

## Decisão

Remover acesso direto por `authenticated` das 3 funções acima.

Atenção:

- a migration não dropa funções;
- preserva `service_role`;
- não altera hooks/telas;
- não mexe em helpers centrais;
- não altera matriz v3;
- não altera convites, logs ativos ou permissões ativas.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628185000_revoke_authenticated_from_unused_permission_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 3 funções listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **128** para **125**;
- as 3 funções tratadas devem sair do diagnóstico;
- helpers centrais e fluxos ativos de usuários/segurança/permissões devem permanecer.

## Resultado esperado para o grupo

O grupo `users_security_permissions` deve cair de **26** para **23** funções.

As funções restantes devem ser documentadas como exceções intencionais, pois representam gates centrais ou fluxos ativos.

## Próxima etapa recomendada

### 9.14E.19 — Fechamento do bloco usuários/segurança

Documentar as exceções intencionais remanescentes do grupo `users_security_permissions` e encerrar este grupo sem novas revogações agressivas.

Critério:

- manter funções usadas diretamente;
- manter helpers transversais;
- manter funções internas necessárias para RPCs `SECURITY DEFINER`;
- registrar hardening futuro apenas onde houver gate ainda genérico por `is_store_member`.
