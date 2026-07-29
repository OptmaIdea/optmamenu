# Fase 9.14E.10 — Compras, fornecedores e cotações

## Status

Correção preparada.

Esta frente continua a auditoria incremental dos warnings `authenticated_security_definer_function_executable`, tratando o grupo `purchases_suppliers_quotations`.

## Base atual

Após a 9.14E.8, o diagnóstico retornou **163 funções** ainda executáveis por `authenticated`.

O grupo `purchases_suppliers_quotations` possui **14 funções** no diagnóstico atual.

## Critério desta rodada

Foram buscados usos diretos por `supabase.rpc(...)` e referências operacionais no frontend/admin.

A decisão foi:

- preservar funções usadas em telas/serviços de compras e cotações;
- não mexer nos fluxos ativos de confirmação/cancelamento/listagem/detalhe/cotação;
- remover `authenticated` apenas de funções sem uso direto operacional atual.

## Funções preservadas

### Compras

Funções com uso direto confirmado:

- `cancel_purchase_document(p_document_id uuid, p_reason text)`;
- `cancel_purchase_document(p_document_id uuid, p_reason text, p_master_password text)`;
- `confirm_purchase_document(p_document_id uuid)`.

Uso encontrado:

- `src/pages/private/admin/products/inventory/PurchaseDocumentsPage.tsx`.

Classificação:

- manter `authenticated`;
- exceção operacional intencional;
- funções possuem validação centralizada via `_cancel_purchase_document_core` ou `user_can_purchase_action`;
- a versão com `p_master_password` é o caminho correto para cancelamentos protegidos.

---

### Cotações

Funções com uso direto confirmado:

- `get_purchase_quotations_by_store(p_store_id uuid, p_status text, p_limit integer)`;
- `get_purchase_quotation_detail(p_quotation_id uuid)`;
- `update_purchase_quotation_response(p_quotation_id uuid, p_items jsonb, p_status text, p_sent_channel text, p_responsible_name text, p_notes text)`;
- `get_purchase_suggestions_by_store(p_store_id uuid)`.

Uso encontrado:

- `src/services/stockService.ts`.

Classificação:

- manter `authenticated`;
- exceção operacional intencional;
- funções de leitura/gestão de cotações usadas pelo admin;
- `update_purchase_quotation_response` valida `user_can_purchase_action(..., 'manage_quotation')`.

## Funções candidatas tratadas

### `apply_purchase_document_to_default_location(p_purchase_document_id uuid, p_location_id uuid)`

Achados:

- não foi encontrada chamada direta atual por `supabase.rpc(...)` no frontend/admin;
- função aplica documento de compra ao estoque/local;
- possui efeito colateral sensível em estoque;
- valida `user_can_purchase_action(..., 'apply_stock')`, mas não precisa ficar exposta diretamente a `authenticated` sem uso atual.

Decisão:

- revogar `authenticated`;
- revogar `anon` e `PUBLIC` por garantia;
- preservar `service_role`;
- não dropar a função.

---

### `is_supplier_purchase_eligible(p_supplier_id uuid)`

Achados:

- não foi encontrada chamada direta atual por `supabase.rpc(...)` no frontend/admin;
- função é helper de elegibilidade de fornecedor;
- busca geral encontrou apenas documentação/Advisors;
- não há necessidade de exposição direta para `authenticated`.

Decisão:

- revogar `authenticated`;
- revogar `anon` e `PUBLIC` por garantia;
- preservar `service_role`;
- não dropar a função.

## Migration preparada

Arquivo:

- `supabase/migrations/20260628102500_revoke_authenticated_from_purchase_internal_helpers.sql`

Escopo:

- `REVOKE EXECUTE` de `PUBLIC`, `anon` e `authenticated` em:
  - `apply_purchase_document_to_default_location(uuid, uuid)`;
  - `is_supplier_purchase_eligible(uuid)`;
- `GRANT EXECUTE` para `service_role`.

## Validação esperada

Após aplicar a migration e rodar novamente:

- a contagem deve cair de 163 para 161 funções;
- `apply_purchase_document_to_default_location` deve sair do diagnóstico `authenticated_can_execute=true`;
- `is_supplier_purchase_eligible` deve sair do diagnóstico `authenticated_can_execute=true`;
- funções operacionais de compras/cotações devem permanecer.

## Fora do escopo

- alterar telas de compras;
- alterar `stockService.ts`;
- alterar fluxo de cotação;
- dropar funções;
- mexer em `_cancel_purchase_document_core`;
- mexer em permissões comerciais/estoque nesta rodada.

## Próxima etapa recomendada

### 9.14E.11 — Validação da 9.14E.10

Após aplicar a migration:

- validar queda esperada de 163 para 161;
- confirmar preservação dos fluxos de compra/cotação;
- documentar resultado.

Depois disso, continuar com o grupo `settings_configuration` ou `users_security_permissions`, conforme prioridade.
