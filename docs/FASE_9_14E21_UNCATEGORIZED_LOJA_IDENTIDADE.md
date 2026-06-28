# Fase 9.14E.21 — Uncategorized: loja, owner e identidade

## Status

Correção preparada.

Esta etapa inicia a auditoria incremental do grupo `uncategorized_review`.

## Base atual

Após a 9.14E.20:

- total geral: **125 funções** executáveis por `authenticated`;
- grupo `uncategorized_review`: **37 funções**.

## Recorte desta rodada

Foram avaliadas funções relacionadas a:

- seleção de loja no login;
- identificação da loja do usuário;
- validação de slug;
- helpers de dono/owner;
- helpers de identidade de usuário.

## Funções preservadas

### Fluxos ativos

- `get_login_store_options()`;
- `get_user_store_by_id(p_user_id uuid)`;
- `validate_store_slug(p_store_id uuid, p_slug text)`.

Motivo:

- `get_login_store_options` é usado no fluxo de login;
- `get_user_store_by_id` é usado no layout privado para carregar loja do usuário autenticado;
- `validate_store_slug` é usado nas configurações comerciais/pedido online.

### Helpers centrais preservados

- `app_is_store_owner(p_store_id uuid)`;
- `is_store_owner(p_store_id uuid)`;
- `user_owns_store(p_store_id uuid)`;
- `app_current_store_role(p_store_id uuid)`.

Motivo:

- são helpers transversais de owner/role;
- podem ser usados por RPCs `SECURITY DEFINER`, policies ou validações internas;
- não devem ser revogados sem uma auditoria global de dependências de banco/policies.

## Funções candidatas tratadas

Sem uso direto operacional atual identificado no frontend/admin:

- `get_user_store_id()`;
- `get_user_display_identity(p_user_id uuid)`.

## Motivo da decisão

### `get_user_store_id()`

Helper antigo para retornar uma loja associada ao `auth.uid()`.

Foi considerado legado porque:

- não há chamada direta atual por `supabase.rpc(...)` no frontend/admin;
- fluxos atuais usam seleção de loja/login e/ou contexto privado mais explícitos.

### `get_user_display_identity(p_user_id uuid)`

Função lê `auth.users` e retorna nome/e-mail de um usuário arbitrário informado por parâmetro.

Foi considerada sensível para chamada direta por `authenticated` porque:

- expõe identidade/e-mail a partir de `p_user_id`;
- não há chamada direta operacional atual identificada;
- deve permanecer disponível apenas para `service_role` ou uso interno controlado.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628192000_revoke_authenticated_from_legacy_user_identity_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 2 funções listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **125** para **123**;
- `uncategorized_review` deve cair de **37** para **35**;
- `get_user_store_id` deve sair do diagnóstico;
- `get_user_display_identity` deve sair do diagnóstico;
- funções preservadas de login, loja, owner e slug devem permanecer.

## Fora do escopo

- revogar helpers owner/role (`app_is_store_owner`, `is_store_owner`, `user_owns_store`, `app_current_store_role`);
- mexer no fluxo de login;
- mexer no layout privado;
- mexer em `validate_store_slug`;
- alterar policies/RLS.

## Próxima etapa recomendada

### 9.14E.22 — Uncategorized: caixa/comercial/marketing

Continuar o grupo `uncategorized_review` em novo recorte:

- livro diário/caixa;
- dashboard comercial;
- marketing/campanhas;
- mensagens administrativas;
- promoções.
