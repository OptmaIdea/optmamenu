# Fase 9.14E.1 — Validação do hardening técnico

## Status

**Concluída.**

Esta validação confirma o resultado da migration:

- `supabase/migrations/20260627214500_revoke_authenticated_from_internal_technical_functions.sql`

---

## Resultado pós-migration

O diagnóstico `docs/sql_diagnostics/diagnose_advisors_914e_authenticated_functions.sql` retornou agora **176 funções** `SECURITY DEFINER` ainda executáveis por `authenticated`.

Antes da migration 9.14E.1 eram **184 funções**.

Redução confirmada:

- **8 funções removidas da superfície `authenticated`**.

---

## Funções técnicas removidas do resultado

As seguintes funções não aparecem mais no diagnóstico de `authenticated_can_execute=true`:

- `register_stock_movement()`;
- `register_store_permission_v3(...)`;
- `seed_store_role_permissions_for_new_store_v3()`;
- `sync_permission_catalog_v3()`;
- `touch_store_permission_version(uuid, text)`;
- `trg_touch_store_permission_version()`;
- `sync_supplier_metrics_document(uuid)`;
- `sync_supplier_price_history_for_document(uuid)`.

Isso confirma que a migration 9.14E.1 cumpriu o objetivo sem mexer em funções operacionais/admin.

---

## Funções preservadas corretamente

As funções abaixo continuam executáveis por `authenticated`, conforme planejado:

- `set_store_role_permission_v3(...)`;
- `set_store_role_permissions_bulk_v3(...)`.

Motivo:

- fazem parte do fluxo administrativo de permissões por papel;
- validam `auth.uid()`;
- validam `can_access_security_section_v3(p_store_id, 'roles', true)`;
- registram log de segurança.

---

## Distribuição atual por grupo

| Grupo | Quantidade |
|---|---:|
| `users_security_permissions` | 58 |
| `uncategorized_review` | 37 |
| `inventory_stock_transfer` | 34 |
| `commercial_orders_customers_loyalty` | 23 |
| `purchases_suppliers_quotations` | 14 |
| `settings_configuration` | 8 |
| `internal_technical_candidate` | 2 |

---

## Interpretação

A primeira redução da 9.14E foi bem-sucedida.

O grupo `internal_technical_candidate` caiu para 2 itens, mas esses 2 itens são falsos positivos da classificação automática:

- `set_store_role_permission_v3(...)`;
- `set_store_role_permissions_bulk_v3(...)`.

Eles permanecem autenticados por necessidade funcional.

---

## Próxima etapa recomendada

### 9.14E.2 — Auditoria de funções legadas de pedidos/reservas

Primeiros candidatos identificados:

- `cancel_order(p_order_id uuid)`;
- `complete_order(p_order_id uuid)`;
- `extend_reservation(p_order_id uuid, p_minutes integer)`;
- `create_order_with_reservation(...)`.

Observações iniciais:

- `cancel_order` e `complete_order` não apareceram em busca direta por `rpc(...)` no frontend atual;
- `extend_reservation` aparece em uso no painel administrativo de pedidos e não deve ser removida sem hardening;
- `create_order_with_reservation` aparece em uso no componente público antigo `CartDrawer` e precisa ser tratado com cuidado, pois o fluxo público principal mais recente é `create_public_order_by_slug`.

Diretriz:

- não revogar em massa;
- separar legado sem uso de funções ainda consumidas;
- preferir hardening de corpo quando houver uso funcional;
- só revogar `authenticated` de funções comprovadamente legadas e sem uso atual.
