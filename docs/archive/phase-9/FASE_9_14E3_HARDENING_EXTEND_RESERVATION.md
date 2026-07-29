# Fase 9.14E.3 — Hardening de `extend_reservation`

## Status

**Correção preparada.**

Esta frente continua a auditoria incremental dos warnings `authenticated_security_definer_function_executable`, tratando funções ainda usadas pelo frontend.

O primeiro alvo é:

- `extend_reservation(p_order_id uuid, p_minutes integer)`.

---

## Motivo

A função ainda é chamada no painel administrativo de pedidos:

- `src/pages/private/admin/commercial/orders/Orders.tsx`.

A chamada usa:

```ts
supabase.rpc('extend_reservation', {
  p_order_id: orderId,
  p_minutes: extensionMinutes,
});
```

O frontend não depende de retorno, apenas de sucesso/erro.

Por isso é possível endurecer a função mantendo:

- mesmo nome;
- mesmos argumentos;
- `RETURNS void`;
- grant para `authenticated`.

---

## Problema no corpo anterior

A versão anterior:

- não validava `auth.uid()`;
- não validava vínculo com a loja;
- não carregava `store_id` do pedido;
- não limitava `p_minutes`;
- atualizava reservas por `order_id` de forma ampla;
- não garantia status do pedido;
- não restringia a reservas ativas.

---

## Hardening proposto

A nova versão deve:

1. exigir `p_order_id`;
2. exigir `p_minutes` entre 1 e 120;
3. localizar pedido e `store_id`;
4. exigir pedido em status compatível com reserva/prorrogação;
5. exigir `auth.uid()` em chamadas `anon`/`authenticated`;
6. exigir vínculo com a loja via `is_store_member(store_id)`;
7. atualizar apenas reservas ativas do pedido e da loja;
8. lançar erro claro quando não houver reserva ativa;
9. registrar metadados mínimos da prorrogação.

---

## Decisão de permissão

Não revogar `authenticated` nesta etapa.

Motivo:

- a função ainda é consumida pelo admin;
- o hardening interno reduz o risco sem quebrar fluxo;
- uma futura rodada pode substituir a função por uma versão `*_safe` retornando `jsonb`.

---

## Fora do escopo

- alterar `Orders.tsx`;
- criar nova função `extend_reservation_safe`;
- trocar alert por toast;
- adicionar permissão granular nova;
- migrar `create_order_with_reservation`.

---

## Validação esperada

Após aplicar a migration:

- `extend_reservation` deve continuar aparecendo com `authenticated_can_execute=true`;
- assinatura deve continuar `p_order_id uuid, p_minutes integer`;
- resultado deve continuar `void`;
- corpo deve conter validação de `auth.uid()`, `is_store_member`, limite de minutos e filtro por reservas ativas.
