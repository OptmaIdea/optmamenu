# Fase 9.14E.13 — Segurança: contextos e gates legados

## Status

Correção preparada.

Esta frente iniciou a auditoria incremental do grupo `users_security_permissions`, que após a 9.14E.11 possui **56 funções** no diagnóstico.

## Base atual

Após a 9.14E.11:

- total geral: **158 funções** executáveis por `authenticated`;
- grupo `users_security_permissions`: **56 funções**.

## Recorte desta rodada

Foram avaliadas funções antigas de contexto e gates de Segurança sem uso direto atual por `supabase.rpc(...)` no frontend/admin.

## Funções candidatas tratadas

- `can_access_security_section(p_store_id uuid, p_section text, p_manage boolean)`;
- `can_access_security_section_v3(p_store_id uuid, p_section text, p_manage boolean)`;
- `get_current_user_security_context()`;
- `get_current_user_security_context_v2()`;
- `get_effective_store_permissions(p_store_id uuid)`.

## Achados

As buscas por chamada direta `supabase.rpc(...)` não encontraram uso atual dessas funções no frontend/admin.

Interpretação:

- `can_access_security_section` e `can_access_security_section_v3` são helpers/gates internos;
- `get_current_user_security_context` e `get_current_user_security_context_v2` são contextos legados sem consumidor atual identificado;
- `get_effective_store_permissions` foi substituída operacionalmente por fluxos v2/v3 e hooks mais recentes.

## Decisão

Preparar migration pequena para remover acesso direto por `authenticated`, mantendo compatibilidade interna.

Atenção:

- a remoção do grant direto não dropa as funções;
- `service_role` permanece;
- funções `SECURITY DEFINER` que chamam helpers internamente continuam podendo usá-los pelo contexto do owner/definer;
- não altera frontend, guards ou UX.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628145500_revoke_authenticated_from_legacy_security_context_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 5 funções listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **158** para **153**;
- as 5 funções tratadas devem sair do diagnóstico;
- funções ativas de Segurança/Usuários/Permissões devem permanecer.

## Fora do escopo

- mexer em `set_store_role_permission_v3`;
- mexer em `set_store_role_permissions_bulk_v3`;
- alterar telas de Segurança;
- alterar hooks de permissões;
- alterar catálogo/template de permissões;
- alterar `security.view`.

## Próxima etapa recomendada

### 9.14E.14 — Segurança/Usuários ativos

Continuar o bloco `users_security_permissions` por subgrupos:

- convites e membros;
- perfil próprio/meus dados;
- logs e histórico;
- permissões e matriz;
- helpers `user_has_store_permission*` e `is_store_member`.
