# Fase 9.14E.16 — Logs de Segurança e helpers

## Status

Correção preparada.

Esta etapa continua a auditoria incremental do grupo `users_security_permissions`.

## Base atual

Após a 9.14E.15:

- total geral: **138 funções** executáveis por `authenticated`;
- grupo `users_security_permissions`: **36 funções**.

## Recorte desta rodada

Foram avaliadas funções de logs de Segurança e helpers de formatação/tradução de ações.

## Funções preservadas

Mantidas por uso direto ou papel operacional ativo:

- `get_store_security_activity_logs(p_store_id uuid, p_start_date date, p_end_date date, p_user_filter text, p_action_filter text, p_outcome text)`;
- `get_my_visible_activity_logs(p_store_id uuid, p_start_date date, p_end_date date, p_action text, p_outcome text)`;
- `insert_security_log(p_store_id uuid, p_user_id uuid, p_user_email text, p_action text, p_details jsonb, p_outcome text)`.

Motivos:

- `get_store_security_activity_logs` é o fluxo atual da aba Histórico de atividades em Segurança;
- `get_my_visible_activity_logs` é usado pelo serviço Meu Histórico;
- `insert_security_log` ainda possui chamadas diretas no frontend/utilitários e também é usado por funções internas.

## Funções candidatas tratadas

Sem uso direto operacional atual identificado como RPC ativa:

- `get_store_security_logs(p_limit integer)`;
- `get_store_security_logs(p_store_id uuid, p_limit integer, p_date_from date, p_date_to date, p_user text, p_action text, p_outcome text)`;
- `translate_security_action_ptbr(p_action text)`.

## Decisão

Remover acesso direto por `authenticated` das 3 funções acima.

Atenção:

- a migration não dropa funções;
- preserva `service_role`;
- não altera telas;
- não altera logs atuais;
- funções `SECURITY DEFINER` que chamam `translate_security_action_ptbr` internamente continuam compatíveis pelo contexto do definer.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628181000_revoke_authenticated_from_legacy_security_log_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 3 assinaturas listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **138** para **135**;
- as duas assinaturas de `get_store_security_logs` devem sair do diagnóstico;
- `translate_security_action_ptbr` deve sair do diagnóstico;
- `get_store_security_activity_logs`, `get_my_visible_activity_logs` e `insert_security_log` devem permanecer.

## Fora do escopo

- mexer em `insert_security_log`;
- mexer em `get_store_security_activity_logs`;
- mexer em `get_my_visible_activity_logs`;
- alterar a tela de Segurança;
- alterar a tela Meu Histórico;
- mexer em `is_store_member` ou `user_has_store_permission*`.

## Próxima etapa recomendada

### 9.14E.17 — Convites e membros ativos

Continuar o grupo `users_security_permissions` em subgrupos pequenos:

- convites pendentes;
- aceitar/recusar convite;
- listar memberships;
- alteração administrativa de membro;
- helpers centrais de permissão.
