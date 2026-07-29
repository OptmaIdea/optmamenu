# Fase 9.14E.22 — Uncategorized: comercial, mensagens e helpers sensíveis

## Status

Correção preparada.

Esta etapa continua a auditoria incremental do grupo `uncategorized_review`.

## Base atual

Após a 9.14E.21:

- total geral: **123 funções** executáveis por `authenticated`;
- grupo `uncategorized_review`: **35 funções**.

## Recorte desta rodada

Foram avaliadas funções relacionadas a:

- Central de Marketing;
- campanhas e destinatários;
- livro diário/caixa;
- dashboard comercial;
- mensagens administrativas;
- helpers legados/sensíveis remanescentes.

## Funções preservadas

### Central de Marketing e campanhas

Preservadas por uso direto no frontend/admin:

- `get_marketing_center_safe(p_store_id uuid)`;
- `upsert_promotion_campaign_safe(...)`;
- `build_campaign_recipients_preview_safe(...)`;
- `prepare_campaign_recipients_safe(p_store_id uuid, p_campaign_id uuid, p_limit integer)`;
- `get_campaign_recipients_safe(p_store_id uuid, p_campaign_id uuid)`;
- `mark_campaign_recipient_manual_sent_safe(p_store_id uuid, p_recipient_id uuid)`.

Motivo:

- todas fazem parte do fluxo ativo da Central de Marketing;
- a central é manual, com envio/registro controlado pelo lojista;
- revogar `authenticated` quebraria listagem, criação/edição de campanhas, preview/preparo de destinatários e marcação manual de envio.

### Livro diário/caixa

Preservadas por uso direto:

- `create_cashbook_entry(...)`;
- `get_cashbook_entries_safe(p_store_id uuid, p_limit integer)`;
- `get_cashbook_summary(p_store_id uuid, p_start_date date, p_end_date date)`.

Motivo:

- fluxos ativos do livro diário/caixa.

### Dashboard comercial

Preservada:

- `get_commercial_dashboard_safe(p_store_id uuid, p_start_date date, p_end_date date)`.

Motivo:

- fluxo ativo do dashboard comercial.

### Mensagens administrativas

Preservadas por uso direto:

- `send_admin_message(...)`;
- `cleanup_old_messages(p_store_id uuid)`.

Motivo:

- usadas na tela administrativa de mensagens comerciais/avisos;
- fazem parte do fluxo manual atual.

## Funções candidatas tratadas

Sem uso direto operacional atual identificado e com perfil sensível/legado:

- `perform_manual_adjustment(p_product_id uuid, p_quantity_change integer, p_reason text, p_password_input text, p_user_id uuid)`;
- `reset_user_pin_with_password(p_password text, p_new_pin text)`.

## Motivo da decisão

### `perform_manual_adjustment`

Função antiga de ajuste de estoque que recebe senha e `p_user_id` por parâmetro.

Foi considerada legada/sensível porque:

- não há chamada direta atual por `supabase.rpc(...)` no frontend/admin;
- os fluxos atuais de estoque usam funções mais novas como `create_manual_stock_adjustment` e `adjust_stock_to_physical_count`;
- o desenho antigo aumenta superfície de risco por aceitar `p_user_id` e senha no payload.

### `reset_user_pin_with_password`

Função de reset de PIN que valida senha contra `auth.users` e grava `user_pins`.

Foi considerada sensível porque:

- não há chamada direta atual identificada;
- acessa `auth.users.encrypted_password` via `SECURITY DEFINER`;
- altera credencial auxiliar do usuário;
- deve permanecer disponível apenas para `service_role` até existir fluxo formal e revisado de PIN.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628193500_revoke_authenticated_from_legacy_sensitive_uncategorized_helpers.sql`

Escopo:

- revogar `PUBLIC`, `anon` e `authenticated` das 2 funções listadas;
- conceder `EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente o diagnóstico:

- contagem deve cair de **123** para **121**;
- `uncategorized_review` deve cair de **35** para **33**;
- `perform_manual_adjustment` deve sair do diagnóstico;
- `reset_user_pin_with_password` deve sair do diagnóstico;
- funções ativas de marketing, campanhas, caixa, dashboard e mensagens devem permanecer.

## Fora do escopo

- mexer na Central de Marketing;
- mexer no livro diário/caixa;
- mexer no dashboard comercial;
- mexer em mensagens administrativas;
- mexer em helpers de owner/role;
- alterar funções modernas de estoque.

## Próxima etapa recomendada

### 9.14E.23 — Uncategorized: custom roles, configurações sensíveis e helpers restantes

Continuar o grupo `uncategorized_review` em novo recorte:

- custom roles;
- ações sensíveis;
- store config admin;
- helpers de produto/trânsito;
- recompensas/fidelidade legada.
