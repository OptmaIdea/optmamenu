# Fase 9.14E.24 — Fechamento do grupo uncategorized_review

## Status

Concluída.

Esta etapa fecha documentalmente o grupo `uncategorized_review` da auditoria 9.14E.

## Base validada

Após a 9.14E.23:

- total geral: **120 funções** executáveis por `authenticated`;
- grupo `uncategorized_review`: **32 funções**.

## Resultado acumulado do grupo

O grupo `uncategorized_review` foi reduzido de **37** funções na classificação inicial desta rodada para **32** funções remanescentes.

Redução no bloco:

- **5 funções removidas da superfície authenticated**.

## Funções removidas durante o bloco

Entre as etapas 9.14E.21 e 9.14E.23, foram removidos grants diretos de `authenticated` das seguintes funções:

- `get_user_store_id()`;
- `get_user_display_identity(p_user_id uuid)`;
- `perform_manual_adjustment(p_product_id uuid, p_quantity_change integer, p_reason text, p_password_input text, p_user_id uuid)`;
- `reset_user_pin_with_password(p_password text, p_new_pin text)`;
- `update_store_config_admin(p_store_id uuid, p_config jsonb)`.

## Diretriz aplicada

As revogações foram feitas apenas quando havia evidência de função legada, sensível, duplicada, sem chamada direta operacional atual ou substituída por fluxo mais novo.

Foram preservadas funções com pelo menos um dos critérios abaixo:

- uso direto no frontend/admin;
- helper transversal de owner/role;
- fluxo ativo de login/seleção de loja;
- fluxo ativo de custom roles;
- fluxo ativo de ações sensíveis;
- fluxo ativo de marketing/campanhas;
- fluxo ativo de livro diário/caixa;
- fluxo ativo de dashboard comercial;
- fluxo ativo de mensagens administrativas;
- fluxo ativo de produto/trânsito;
- fluxo ativo de sessão/idle timeout;
- fluxo ativo de senha master;
- recurso legado ainda consumido e sem substituição validada.

## Funções remanescentes por categoria

### Login, loja, owner e role

Preservadas:

- `get_login_store_options()`;
- `get_user_store_by_id(p_user_id uuid)`;
- `validate_store_slug(p_store_id uuid, p_slug text)`;
- `app_current_store_role(p_store_id uuid)`;
- `app_is_store_owner(p_store_id uuid)`;
- `is_store_owner(p_store_id uuid)`;
- `user_owns_store(p_store_id uuid)`.

Motivo:

- `get_login_store_options` é fluxo ativo de login/seleção de loja;
- `get_user_store_by_id` é usado para carregar loja no layout privado;
- `validate_store_slug` é usado em configurações/pedido online;
- helpers owner/role são transversais e podem ser usados por RPCs, policies e validações internas.

### Custom roles

Preservadas:

- `list_store_custom_roles(p_store_id uuid, p_include_inactive boolean)`;
- `create_store_custom_role(...)`;
- `update_store_custom_role(...)`.

Motivo:

- fluxo ativo da tela Segurança;
- necessário para funções personalizadas;
- já possui gates de owner/permissões de custom roles.

### Ações sensíveis

Preservadas:

- `get_sensitive_action_requirement(p_store_id uuid, p_action_code text)`;
- `get_store_sensitive_action_matrix(p_store_id uuid)`;
- `update_store_sensitive_action_rule(...)`.

Motivo:

- fluxo ativo de leitura/edição da matriz de ações sensíveis;
- integra com permissões e tela de Segurança.

### Marketing, campanhas e mensagens

Preservadas:

- `get_marketing_center_safe(p_store_id uuid)`;
- `upsert_promotion_campaign_safe(...)`;
- `build_campaign_recipients_preview_safe(...)`;
- `prepare_campaign_recipients_safe(p_store_id uuid, p_campaign_id uuid, p_limit integer)`;
- `get_campaign_recipients_safe(p_store_id uuid, p_campaign_id uuid)`;
- `mark_campaign_recipient_manual_sent_safe(p_store_id uuid, p_recipient_id uuid)`;
- `send_admin_message(...)`;
- `cleanup_old_messages(p_store_id uuid)`.

Motivo:

- fluxos ativos da Central de Marketing e mensagens administrativas;
- o modelo atual é manual e depende dessas RPCs para preview, preparo, listagem e marcação de envio.

### Livro diário, dashboard e comercial

Preservadas:

- `create_cashbook_entry(...)`;
- `get_cashbook_entries_safe(p_store_id uuid, p_limit integer)`;
- `get_cashbook_summary(p_store_id uuid, p_start_date date, p_end_date date)`;
- `get_commercial_dashboard_safe(p_store_id uuid, p_start_date date, p_end_date date)`.

Motivo:

- fluxos ativos do caixa/livro diário e dashboard comercial.

### Produto, trânsito e recompensa

Preservadas:

- `get_store_config_admin(p_store_id uuid)`;
- `get_product_transit_summary(p_product_id uuid)`;
- `product_has_movements(p_product_id uuid)`;
- `redeem_reward(p_customer_id uuid, p_reward_id uuid)`.

Motivo:

- leitura de configuração ainda possui consumidor ativo;
- trânsito de produto e verificação de movimentos são usados em fluxos de inventário/produto;
- `redeem_reward` ainda possui consumidor no componente de fidelidade e não deve ser revogada sem substituição validada.

### Sessão e senha master

Preservadas:

- `log_user_session_event(...)`;
- `reset_store_master_password(p_store_id uuid, p_new_password text)`.

Motivo:

- `log_user_session_event` é usado por login, layout privado, utilitários de sessão e idle timeout;
- `reset_store_master_password` é usado na tela de Segurança.

## Decisão final do grupo

Não criar nova migration nesta etapa.

O grupo `uncategorized_review` fica fechado como **exceção intencional documentada** com **32 funções remanescentes**, preservadas por uso ativo ou papel transversal.

## Hardening futuro recomendado

Sem bloqueio para esta fase.

Sugestões futuras:

1. Reclassificar essas 32 funções em grupos definitivos no diagnóstico para evitar `uncategorized_review` em auditorias futuras.
2. Avaliar permissões granulares onde ainda houver apenas `is_store_member` ou helper owner genérico.
3. Revisar `redeem_reward` quando o módulo de fidelidade avançada substituir totalmente o componente legado.
4. Revisar se `send_admin_message` e campanhas devem evoluir para backend/service_role quando houver automação real.
5. Confirmar se `get_store_config_admin` continua necessário após consolidação das configurações por seção.
6. Manter `log_user_session_event` enquanto login/idle timeout dependerem dele.

## Próxima etapa recomendada

### 9.14E.25 — Fechamento consolidado da 9.14E parcial

Consolidar o estado atual da auditoria 9.14E:

- total final parcial: **120 funções**;
- blocos fechados/documentados;
- migrations aplicadas e validadas;
- próximos blocos ainda abertos.

### Depois

Avançar para fechamento ou reclassificação dos grupos já documentados como exceções intencionais, antes de decidir se haverá nova rodada em `inventory_stock_transfer`, `commercial_orders_customers_loyalty`, `purchases_suppliers_quotations` ou `settings_configuration`.
