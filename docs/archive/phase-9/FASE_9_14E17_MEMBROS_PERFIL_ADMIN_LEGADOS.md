# Fase 9.14E.17 — Membros e perfil administrativo legados

## Status

Correção preparada.

Esta etapa continua a auditoria incremental do grupo `users_security_permissions`.

## Base atual

Após a 9.14E.16:

- total geral: **136 funções** executáveis por `authenticated`;
- grupo `users_security_permissions`: **34 funções**.

## Recorte desta rodada

Foram avaliadas funções de membros, perfil administrativo, solicitações cadastrais administrativas e helpers sem uso direto atual identificado no frontend/admin.

## Funções preservadas

Mantidas por uso direto ou papel operacional ativo:

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
- `update_store_member_permissions(...)`;
- `change_store_member_role(...)`.

## Funções candidatas tratadas

Sem uso direto operacional atual identificado como RPC ativa:

- `get_my_store_memberships()`;
- `get_store_member_access_timeline(p_store_id uuid, p_member_id uuid)`;
- `can_manage_user_avatar(p_target_user_id uuid)`;
- `list_store_profile_change_requests(p_store_id uuid, p_status text, p_request_type text, p_limit integer, p_offset integer)`;
- `propose_store_profile_change_request(p_request_id uuid, p_proposed_changes jsonb, p_admin_notes text)`;
- `review_store_profile_change_request(p_request_id uuid, p_decision text, p_admin_notes text)`;
- `update_store_member_profile_details(...)`;
- `update_store_member_status(p_member_id uuid, p_status text, p_reason text)`.

## Decisão

Remover acesso direto por `authenticated` das 8 funções acima.

Atenção:

- a migration não dropa funções;
- preserva `service_role`;
- não altera telas;
- não mexe em convites ativos;
- não mexe em histórico administrativo ativo;
- não mexe em permissões individuais ou papéis;
- não mexe em helpers centrais `is_store_member` e `user_has_store_permission*`.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628182500_revoke_authenticated_from_legacy_member_profile_admin_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 8 funções listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **136** para **128**;
- as 8 funções tratadas devem sair do diagnóstico;
- convites ativos, logs ativos, histórico administrativo ativo, avatar ativo, permissões e papéis devem permanecer.

## Fora do escopo

- `is_store_member`;
- `user_has_store_permission`;
- `user_has_store_permission_v2`;
- `get_current_user_store_permissions_v2`;
- `get_effective_store_member_permissions_v2`;
- `get_store_permission_catalog`;
- `get_store_permission_matrix_v3`;
- `set_store_role_permission_v3`;
- `set_store_role_permissions_bulk_v3`.

## Próxima etapa recomendada

### 9.14E.18 — Helpers centrais e permissões remanescentes

Continuar o grupo `users_security_permissions` com foco em:

- helpers centrais de vínculo/permissão;
- catálogo/matriz de permissões;
- permissões efetivas por usuário;
- funções ativas de papéis e funções personalizadas.
