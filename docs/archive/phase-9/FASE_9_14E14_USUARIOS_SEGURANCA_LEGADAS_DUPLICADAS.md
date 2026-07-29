# Fase 9.14E.14 — Usuários/Segurança: legadas duplicadas

## Status

Correção preparada.

Esta frente continua a auditoria incremental do grupo `users_security_permissions`.

## Base atual

Após a 9.14E.13:

- total geral: **153 funções** executáveis por `authenticated`;
- grupo `users_security_permissions`: **51 funções**.

## Recorte desta rodada

Foram avaliadas funções antigas/duplicadas que possuem caminhos v2/v3 ou substitutos operacionais no frontend/admin.

## Funções preservadas

Caminhos atuais confirmados:

- `get_store_permission_matrix_v3(p_store_id uuid)`;
- `set_store_role_permission_v3(...)`;
- `set_store_role_permissions_bulk_v3(...)`;
- `get_store_members_for_permissions(p_store_id uuid)`;
- `change_store_member_role(...)`;
- `create_store_member_invite(...)`.

Principais locais encontrados:

- `src/hooks/security/useSecurityPermissionsAdmin.ts`;
- `src/store/useUsersStore.ts`;
- `src/pages/private/admin/users/Users.tsx`;
- `src/services/storeMemberInviteService.ts`.

## Funções candidatas tratadas

Sem uso direto atual por `supabase.rpc(...)` no frontend/admin:

- `get_store_permission_matrix(p_store_id uuid)`;
- `update_store_role_permission_template(p_store_id uuid, p_role text, p_permission_code text, p_allowed boolean, p_reason text)`;
- `get_store_members(p_store_id uuid)`;
- `get_store_members_v2(p_store_id uuid)`;
- `update_store_member_role(p_member_id uuid, p_role text, p_reason text)`;
- `add_store_member_by_email(p_store_id uuid, p_email text, p_role text, p_status text, p_permissions jsonb, p_sensitive_actions jsonb)`.

## Decisão

Remover o acesso direto por `authenticated` dessas funções legadas/duplicadas.

Atenção:

- a migration não dropa funções;
- preserva `service_role`;
- não altera hooks/telas;
- preserva os caminhos novos usados pelo frontend/admin.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628152000_revoke_authenticated_from_legacy_users_security_duplicates.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 6 funções listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **153** para **147**;
- as 6 funções legadas devem sair do diagnóstico;
- as funções v3/ativas devem permanecer.

## Fora do escopo

- mexer em `is_store_member`;
- mexer em `user_has_store_permission*`;
- mexer em matriz v3;
- mexer em edição de papéis v3;
- alterar telas de Segurança/Usuários;
- alterar convites ativos.

## Próxima etapa recomendada

### 9.14E.15 — Usuários: membros, convites e perfil próprio

Auditar os fluxos ainda ativos:

- convites;
- onboarding;
- alteração de perfil próprio;
- histórico visível do membro;
- solicitações de alteração de perfil;
- logs e ocorrências.
