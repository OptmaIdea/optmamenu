# Fase 9.14E.2 — Funções legadas de pedidos e reservas

## Status

**Classificação concluída com primeira correção segura preparada.**

Esta frente continua a auditoria incremental dos warnings `authenticated_security_definer_function_executable`, focando em funções de pedidos/reservas com maior chance de legado ou necessidade de hardening.

---

## Funções avaliadas

- `cancel_order(p_order_id uuid)`;
- `complete_order(p_order_id uuid)`;
- `extend_reservation(p_order_id uuid, p_minutes integer)`;
- `create_order_with_reservation(...)`.

---

## Critério usado

Foram verificados:

- presença no diagnóstico 9.14E;
- uso direto por `supabase.rpc(...)` no frontend atual;
- corpo da função;
- risco de bypass por `SECURITY DEFINER`;
- existência de alternativas mais seguras.

---

## Resultado da busca no frontend

### Sem chamada direta encontrada

- `cancel_order`;
- `complete_order`.

### Chamada direta encontrada

- `extend_reservation` em `src/pages/private/admin/commercial/orders/Orders.tsx`;
- `create_order_with_reservation` em `src/pages/store/components/CartDrawer.tsx`.

---

## Classificação

### 1. Revogar `authenticated` agora

#### `cancel_order(p_order_id uuid)`

Achados:

- não apareceu uso direto atual por `rpc('cancel_order')`;
- função antiga e ampla;
- não valida `auth.uid()`;
- não valida vínculo com loja;
- não valida permissão granular;
- atualiza pedido por `id` diretamente;
- remove reservas por `order_id` diretamente.

Alternativa segura existente:

- `admin_cancel_public_order_safe(p_order_id uuid, p_reason text)`.

Decisão:

- revogar `authenticated`;
- preservar `service_role`/postgres;
- não dropar nesta etapa.

---

#### `complete_order(p_order_id uuid)`

Achados:

- não apareceu uso direto atual por `rpc('complete_order')`;
- função antiga e ampla;
- não valida `auth.uid()`;
- não valida vínculo com loja;
- não valida permissão granular;
- marca pedido como `completed` diretamente.

Alternativas seguras existentes:

- `admin_complete_public_order_safe(p_order_id uuid)`;
- `complete_confirmed_public_order(p_order_id uuid)`.

Decisão:

- revogar `authenticated`;
- preservar `service_role`/postgres;
- não dropar nesta etapa.

---

### 2. Não revogar agora — função em uso

#### `extend_reservation(p_order_id uuid, p_minutes integer)`

Achados:

- aparece em uso no painel administrativo de pedidos;
- corpo atual é simples demais;
- não valida vínculo com loja;
- não valida `auth.uid()`;
- não valida permissão comercial/estoque;
- atualiza reservas por `order_id` diretamente.

Decisão:

- não revogar nesta rodada, para não quebrar o admin;
- precisa de hardening interno em rodada posterior.

Hardening recomendado:

- localizar pedido e `store_id`;
- exigir `auth.uid()`;
- exigir membro da loja;
- idealmente exigir permissão comercial/gestão de pedidos;
- limitar `p_minutes` a faixa segura;
- atualizar apenas reservas ativas do pedido e da loja;
- retornar `jsonb` com status ou manter assinatura se o frontend depender de `void`.

---

#### `create_order_with_reservation(...)`

Achados:

- aparece em uso no componente público antigo `CartDrawer`;
- função cria pedido e reserva/baixa estoque de modo legado;
- não exige loja pública habilitada;
- não valida canal/método público como `create_public_order_by_slug`;
- usa `p_total` vindo do cliente;
- no erro retorna `SQLERRM`;
- fluxo público mais novo e mais seguro é `create_public_order_by_slug`.

Decisão:

- não revogar nesta rodada, para não quebrar fluxo ainda referenciado;
- recomendar migração do frontend para `create_public_order_by_slug`;
- depois revogar `authenticated` e/ou `anon` se aplicável;
- se precisar manter temporariamente, aplicar hardening forte.

---

## Migration preparada

Arquivo proposto:

- `supabase/migrations/20260627224500_revoke_authenticated_from_legacy_order_functions.sql`

Escopo:

- revogar `authenticated` de `cancel_order(uuid)`;
- revogar `authenticated` de `complete_order(uuid)`;
- preservar `service_role`;
- não mexer em `extend_reservation`;
- não mexer em `create_order_with_reservation`.

---

## Validação esperada

Após aplicar a migration e rodar novamente:

- `cancel_order` não deve aparecer mais no diagnóstico `authenticated_can_execute=true`;
- `complete_order` não deve aparecer mais no diagnóstico `authenticated_can_execute=true`;
- `extend_reservation` deve continuar aparecendo;
- `create_order_with_reservation` deve continuar aparecendo.

---

## Próxima etapa recomendada

### 9.14E.3 — Hardening de funções ainda usadas

Prioridade:

1. `extend_reservation` — hardening sem quebrar assinatura;
2. `create_order_with_reservation` — preferir migração do frontend para `create_public_order_by_slug`; se não for possível, endurecer temporariamente.
