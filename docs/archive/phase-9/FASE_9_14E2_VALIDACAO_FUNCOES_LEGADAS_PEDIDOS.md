# Fase 9.14E.2 — Validação das funções legadas de pedidos

## Status

**Concluída.**

Esta validação confirma o resultado da migration:

- `supabase/migrations/20260627224500_revoke_authenticated_from_legacy_order_functions.sql`

---

## Resultado pós-migration

O diagnóstico `docs/sql_diagnostics/diagnose_advisors_914e_authenticated_functions.sql` retornou agora **174 funções** `SECURITY DEFINER` ainda executáveis por `authenticated`.

Antes da 9.14E.2, após a 9.14E.1, eram **176 funções**.

Redução confirmada:

- **2 funções legadas removidas da superfície `authenticated`**.

---

## Funções removidas do resultado

As seguintes funções não aparecem mais no diagnóstico de `authenticated_can_execute=true`:

- `cancel_order(p_order_id uuid)`;
- `complete_order(p_order_id uuid)`.

Isso confirma que a migration removeu corretamente o acesso direto por `authenticated` dessas funções antigas.

---

## Funções preservadas corretamente

As seguintes funções continuam aparecendo no diagnóstico, conforme planejado:

- `extend_reservation(p_order_id uuid, p_minutes integer)`;
- `create_order_with_reservation(...)`.

Motivo:

- `extend_reservation` ainda é usada no painel administrativo de pedidos;
- `create_order_with_reservation` ainda é referenciada pelo componente público legado `CartDrawer`;
- ambas exigem tratamento específico antes de qualquer revogação.

---

## Interpretação

A 9.14E.2 foi bem-sucedida porque reduziu a superfície autenticada sem mexer em funções ainda consumidas pelo frontend.

As funções removidas eram candidatas seguras porque:

- não havia chamada direta atual por `supabase.rpc(...)` no frontend;
- não validavam `auth.uid()`;
- não validavam vínculo com loja;
- não validavam permissão granular;
- possuíam alternativas administrativas mais seguras.

---

## Próxima etapa recomendada

### 9.14E.3 — Hardening de funções ainda usadas

Prioridade:

1. `extend_reservation(p_order_id uuid, p_minutes integer)`;
2. `create_order_with_reservation(...)`.

Diretriz:

- não revogar enquanto houver uso no frontend;
- aplicar hardening de corpo onde possível;
- migrar o fluxo legado de `create_order_with_reservation` para `create_public_order_by_slug` antes de remover grants;
- preservar compatibilidade de assinatura quando a função ainda for usada.
