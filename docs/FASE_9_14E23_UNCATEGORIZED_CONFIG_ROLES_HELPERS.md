# Fase 9.14E.23 — Uncategorized: custom roles, ações sensíveis e config admin

## Status

Correção preparada.

Esta etapa continua a auditoria incremental do grupo `uncategorized_review`.

## Base atual

Após a 9.14E.22:

- total geral: **121 funções** executáveis por `authenticated`;
- grupo `uncategorized_review`: **33 funções**.

## Recorte desta rodada

Foram avaliadas funções relacionadas a:

- custom roles;
- ações sensíveis;
- configuração administrativa de loja;
- helpers de produto/trânsito;
- fidelidade/recompensa legada;
- logs de sessão.

## Funções preservadas

### Custom roles

Preservadas por uso direto:

- `list_store_custom_roles(p_store_id uuid, p_include_inactive boolean)`;
- `create_store_custom_role(...)`;
- `update_store_custom_role(...)`.

Motivo:

- usadas por `useStoreCustomRoles` e pela tela de Segurança;
- fazem parte do fluxo atual de funções personalizadas;
- possuem gates por owner/permissões de `security.custom_roles.*`.

### Ações sensíveis

Preservadas por uso direto:

- `get_sensitive_action_requirement(p_store_id uuid, p_action_code text)`;
- `get_store_sensitive_action_matrix(p_store_id uuid)`;
- `update_store_sensitive_action_rule(...)`.

Motivo:

- usadas por serviços/hook de permissões e tela de Segurança;
- fazem parte do fluxo atual de regras de ação sensível;
- revogar `authenticated` quebraria leitura/edição da matriz de ações sensíveis.

### Configuração administrativa — leitura

Preservada:

- `get_store_config_admin(p_store_id uuid)`.

Motivo:

- há uso direto no frontend/admin;
- a função de leitura deve permanecer enquanto houver consumidor operacional.

### Produto/trânsito e exclusão

Preservadas:

- `get_product_transit_summary(p_product_id uuid)`;
- `product_has_movements(p_product_id uuid)`.

Motivo:

- usadas nos fluxos de inventário/produtos;
- `product_has_movements` participa de validação de exclusão/impacto de produto.

### Fidelidade/recompensa legada ainda consumida

Preservada:

- `redeem_reward(p_customer_id uuid, p_reward_id uuid)`.

Motivo:

- ainda há chamada direta em componente de fidelidade;
- não remover nesta rodada sem avaliar substituição funcional.

### Segurança de sessão e senha master

Preservadas:

- `log_user_session_event(...)`;
- `reset_store_master_password(p_store_id uuid, p_new_password text)`.

Motivo:

- `log_user_session_event` é usado por utilitários de sessão, login e timeout;
- `reset_store_master_password` é usado na tela de Segurança.

## Função candidata tratada

Sem uso direto operacional atual identificado:

- `update_store_config_admin(p_store_id uuid, p_config jsonb)`.

## Motivo da decisão

A função `update_store_config_admin` foi considerada legada/inativa porque:

- não foi encontrada chamada direta atual por `supabase.rpc(...)` no frontend/admin;
- os resultados encontrados apontam para documentação/Advisor e backup de migration;
- a leitura de configuração (`get_store_config_admin`) permanece ativa, mas a escrita por esta RPC não possui consumidor operacional atual;
- configurações atuais seguem por serviços/RPCs específicas já auditadas em etapas anteriores.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628201000_revoke_authenticated_from_unused_store_config_admin.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` de `update_store_config_admin(p_store_id uuid, p_config jsonb)`;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **121** para **120**;
- `uncategorized_review` deve cair de **33** para **32**;
- `update_store_config_admin` deve sair do diagnóstico;
- funções ativas de custom roles, ações sensíveis, leitura de config, produto/trânsito, sessão e senha master devem permanecer.

## Fora do escopo

- mexer em custom roles;
- mexer em matriz de ações sensíveis;
- mexer em `get_store_config_admin`;
- mexer em `reset_store_master_password`;
- mexer em `log_user_session_event`;
- mexer em helpers de owner/role;
- mexer em fluxos de produto/trânsito.

## Próxima etapa recomendada

### 9.14E.24 — Fechamento do grupo `uncategorized_review`

Com a redução esperada para 32 funções, o grupo deve ser reavaliado para fechamento documental ou nova rodada pontual se ainda houver função claramente legada.
