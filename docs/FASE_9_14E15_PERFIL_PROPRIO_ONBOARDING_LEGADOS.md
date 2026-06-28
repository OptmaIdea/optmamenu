# Fase 9.14E.15 — Perfil próprio e onboarding legados

## Status

Correção preparada.

Esta etapa continua a auditoria incremental do grupo `users_security_permissions`.

## Base atual

Após a 9.14E.14:

- total geral: **147 funções** executáveis por `authenticated`;
- grupo `users_security_permissions`: **45 funções**.

## Advisor base

Foi considerado o `docs/ADVISORS.md` informado no commit:

- `1f48d21aba3e6944c7b421cdfec8e41bd789b0dc`.

O aviso `Leaked Password Protection Disabled` permanece fora do escopo, conforme regra do projeto.

## Recorte desta rodada

Foram avaliadas funções de perfil próprio, onboarding, solicitações de alteração de perfil e histórico visível do membro que permaneciam no diagnóstico, mas não tinham chamada direta atual por `supabase.rpc(...)` no frontend/admin.

## Funções candidatas tratadas

Sem uso direto operacional atual identificado:

- `complete_my_store_member_onboarding(...)`;
- `update_my_store_member_profile(...)`;
- `update_my_store_member_alias(p_store_id uuid, p_internal_alias text)`;
- `create_my_profile_change_request(...)`;
- `create_my_profile_change_request_v2(...)`;
- `list_my_profile_change_requests(p_store_id uuid, p_limit integer)`;
- `respond_my_profile_change_request(p_request_id uuid, p_decision text, p_member_feedback text)`;
- `cancel_my_profile_change_request(p_request_id uuid, p_reason text)`;
- `get_my_visible_store_member_history(p_store_id uuid, p_limit integer)`.

## Decisão

Remover o acesso direto por `authenticated` dessas funções legadas/inativas.

Atenção:

- a migration não dropa funções;
- preserva `service_role`;
- não altera hooks/telas;
- não mexe em convites ativos;
- não mexe na administração de usuários;
- não altera funções centrais de permissão.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628154500_revoke_authenticated_from_legacy_profile_onboarding_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 9 funções listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **147** para **138**;
- as 9 funções tratadas devem sair do diagnóstico;
- funções ativas de usuários, convites, papéis, permissões e logs devem permanecer.

## Fora do escopo

- `accept_store_member_invite`;
- `decline_my_store_member_invite`;
- `get_my_pending_store_invites`;
- `get_my_store_memberships`;
- `create_store_member_invite`;
- `cancel_store_member_invite`;
- `change_store_member_role`;
- `update_store_member_status`;
- `update_store_member_permissions`;
- `is_store_member`;
- `user_has_store_permission*`.

## Próxima etapa recomendada

### 9.14E.16 — Convites, membros e logs ativos

Continuar em subgrupos pequenos:

- convites e aceite/recusa;
- edição administrativa de membro;
- logs e histórico;
- helpers centrais de permissão.
