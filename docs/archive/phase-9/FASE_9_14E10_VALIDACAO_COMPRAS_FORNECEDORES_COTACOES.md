# Fase 9.14E.10 — Validação de compras, fornecedores e cotações

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628102500_revoke_authenticated_from_purchase_internal_helpers.sql`

## Resultado

O diagnóstico retornou **161 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **163**.

Redução confirmada:

- **2 funções removidas da superfície authenticated**.

## Funções removidas

As funções abaixo não aparecem mais no diagnóstico:

- `apply_purchase_document_to_default_location(p_purchase_document_id uuid, p_location_id uuid)`;
- `is_supplier_purchase_eligible(p_supplier_id uuid)`.

## Funções operacionais preservadas

Permanecem no diagnóstico, conforme esperado:

- `cancel_purchase_document(p_document_id uuid, p_reason text)`;
- `cancel_purchase_document(p_document_id uuid, p_reason text, p_master_password text)`;
- `confirm_purchase_document(p_document_id uuid)`;
- `convert_purchase_quotation_to_draft(p_quotation_id uuid)`;
- `create_purchase_document_draft_batch(...)`;
- `create_purchase_quotation(...)`;
- `delete_purchase_document_draft(p_document_id uuid)`;
- `get_purchase_quotation_detail(p_quotation_id uuid)`;
- `get_purchase_quotations_by_store(p_store_id uuid, p_status text, p_limit integer)`;
- `get_purchase_suggestions_by_store(p_store_id uuid)`;
- `update_purchase_quotation_response(...)`;
- `user_can_purchase_action(p_store_id uuid, p_action text)`.

## Interpretação

A etapa foi validada porque:

- removeu apenas funções sem uso direto operacional atual identificado;
- preservou fluxos ativos de compras, documentos e cotações;
- manteve funções de confirmação/cancelamento/listagem/detalhe usadas pelo frontend/admin;
- manteve `service_role` para compatibilidade operacional.

## Distribuição atual por grupo

Com base no diagnóstico validado:

- `users_security_permissions`: 58;
- `uncategorized_review`: 37;
- `inventory_stock_transfer`: 28;
- `commercial_orders_customers_loyalty`: 16;
- `purchases_suppliers_quotations`: 12;
- `settings_configuration`: 8;
- `internal_technical_candidate`: 2.

Total:

- **161 funções**.

## Estado acumulado da 9.14E

Até aqui:

- 9.14E.1 reduziu de 184 para 176;
- 9.14E.2 reduziu de 176 para 174;
- 9.14E.3 endureceu `extend_reservation` sem alterar contagem;
- 9.14E.4 reduziu de 174 para 173;
- 9.14E.5 reduziu de 173 para 169;
- 9.14E.6 reduziu de 169 para 164;
- 9.14E.7 documentou comercial restante, sem alterar contagem;
- 9.14E.8 reduziu de 164 para 163;
- 9.14E.9 documentou estoque/transferências restantes, sem alterar contagem;
- 9.14E.10 reduziu de 163 para 161.

## Próxima etapa recomendada

### 9.14E.11 — Configurações

Auditar o grupo `settings_configuration`, atualmente com 8 funções.

Diretriz:

- preservar funções usadas pelo centro de configurações;
- documentar exceções intencionais quando validarem `auth.uid()`, loja e permissão;
- revogar `authenticated` apenas de auxiliares internas sem uso direto;
- não alterar UX de configurações nesta rodada.
