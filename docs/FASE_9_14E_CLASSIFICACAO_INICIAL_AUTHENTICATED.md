# Fase 9.14E — Classificação inicial de funções autenticadas

## Status

**Classificação inicial concluída.**

Este documento registra a primeira leitura do resultado de `docs/sql_diagnostics/diagnose_advisors_914e_authenticated_functions.sql`.

---

## Resultado recebido

O diagnóstico retornou **184 funções** `SECURITY DEFINER` com:

- `anon_can_execute=false`;
- `authenticated_can_execute=true`;
- `service_role_can_execute=true`.

Essas funções correspondem aos warnings `authenticated_security_definer_function_executable` do Advisor.

---

## Distribuição por grupo preliminar

| Grupo | Quantidade |
|---|---:|
| `users_security_permissions` | 58 |
| `uncategorized_review` | 37 |
| `inventory_stock_transfer` | 34 |
| `commercial_orders_customers_loyalty` | 23 |
| `purchases_suppliers_quotations` | 14 |
| `internal_technical_candidate` | 10 |
| `settings_configuration` | 8 |

---

## Leitura geral

A maior parte das funções autenticadas é funcionalmente intencional.

Muitas delas são RPCs do frontend/admin que encapsulam:

- validação de `auth.uid()`;
- validação de vínculo com loja;
- validação de permissões granulares;
- operações multi-tabela;
- regras de estoque, compras, pedidos, clientes e segurança.

Portanto, não é seguro nem desejável remover `authenticated` em massa.

---

## Grupo de menor risco imediato

O grupo inicial mais seguro para redução de warnings é `internal_technical_candidate`.

Funções listadas pelo diagnóstico:

- `register_stock_movement()`;
- `register_store_permission_v3(...)`;
- `seed_store_role_permissions_for_new_store_v3()`;
- `set_store_role_permission_v3(...)`;
- `set_store_role_permissions_bulk_v3(...)`;
- `sync_permission_catalog_v3()`;
- `sync_supplier_metrics_document(p_purchase_document_id uuid)`;
- `sync_supplier_price_history_for_document(p_purchase_document_id uuid)`;
- `touch_store_permission_version(p_store_id uuid, p_reason text)`;
- `trg_touch_store_permission_version()`.

---

## Ajuste da classificação do grupo interno

Nem todas as funções classificadas automaticamente como internas devem perder `authenticated`.

### Manter `authenticated`

#### `set_store_role_permission_v3(...)`

Motivo:

- é usada pelo fluxo administrativo de permissões por papel;
- valida `auth.uid()`;
- valida `can_access_security_section_v3(p_store_id, 'roles', true)`;
- registra log de segurança.

#### `set_store_role_permissions_bulk_v3(...)`

Motivo:

- é usada pelo fluxo administrativo de matriz/permissões por papel;
- valida `auth.uid()`;
- valida `can_access_security_section_v3(p_store_id, 'roles', true)`;
- registra log de segurança.

Essas funções não devem ser corrigidas na primeira migration da 9.14E.

---

### Candidatas a perder `authenticated`

#### `register_stock_movement()`

Motivo:

- função de trigger;
- não deve ser chamada diretamente pelo frontend.

#### `seed_store_role_permissions_for_new_store_v3()`

Motivo:

- função de trigger para seed de permissões em nova loja;
- não deve ser chamada diretamente pelo frontend.

#### `sync_permission_catalog_v3()`

Motivo:

- função de trigger/sincronização do catálogo;
- não deve ser chamada diretamente pelo frontend.

#### `trg_touch_store_permission_version()`

Motivo:

- função de trigger;
- não deve ser chamada diretamente pelo frontend.

#### `touch_store_permission_version(p_store_id uuid, p_reason text)`

Motivo:

- função técnica de versionamento/realtime de permissões;
- chamada por trigger/RPCs internas;
- não deve ser chamada diretamente pelo frontend.

#### `register_store_permission_v3(...)`

Motivo:

- função técnica de cadastro/sincronização do catálogo de permissões;
- uso esperado por migrations/seed;
- busca no repositório não indicou uso direto no frontend.

#### `sync_supplier_metrics_document(p_purchase_document_id uuid)`

Motivo:

- rotina técnica de sincronização de métricas/preço de fornecedor;
- busca no repositório não indicou uso direto no frontend.

#### `sync_supplier_price_history_for_document(p_purchase_document_id uuid)`

Motivo:

- rotina técnica de sincronização de histórico de preço;
- busca no repositório não indicou uso direto no frontend.

---

## Primeira migration recomendada da 9.14E

Escopo seguro:

- revogar `authenticated` apenas das funções técnicas/trigger acima;
- preservar `service_role`;
- preservar `postgres`/owner;
- não mexer nas funções de operação/admin;
- não mexer em `set_store_role_permission_v3` nem `set_store_role_permissions_bulk_v3`.

---

## Grupos a manter para rodadas futuras

### `users_security_permissions`

Muitas funções são intencionais e usadas por Segurança, Usuários, Meus Dados e permissões.

Direção:

- auditar por subgrupo;
- manter `authenticated` nas funções consumidas pelo frontend;
- ajustar corpo apenas quando faltar validação granular.

### `inventory_stock_transfer`

Grande parte é operação real de estoque/transferência.

Direção:

- preservar funções em uso;
- procurar legado como `cancel_order`, `complete_order`, `extend_reservation`, `create_order_with_reservation`, antes de remover.

### `commercial_orders_customers_loyalty`

Inclui funções seguras recentes, mas também legados como `cancel_order` e `complete_order`.

Direção:

- não revogar em massa;
- priorizar identificação de legados substituídos por versões `*_safe`.

### `purchases_suppliers_quotations`

Funções operacionais de compras/cotações/fornecedores.

Direção:

- manter enquanto usadas no frontend;
- auditar permissões e status.

### `settings_configuration`

Funções de Configurações.

Direção:

- manter `authenticated` quando exigirem `settings.view/manage`;
- verificar duplicidades `update_store_message_settings` e `update_store_message_settings_admin`.

### `uncategorized_review`

Grupo heterogêneo.

Direção:

- separar manualmente entre segurança, marketing, caixa, funções auxiliares e legado.

---

## Próxima ação

Criar migration 9.14E.1 para remover `authenticated` apenas das funções técnicas de baixo risco.

Após aplicar, rodar novamente o diagnóstico e confirmar:

- funções técnicas com `authenticated_can_execute=false`;
- funções administrativas/operacionais preservadas;
- nenhum fluxo do frontend quebrado.
