# Fase 9.14E.3 — Validação de extend_reservation

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260627231500_harden_extend_reservation.sql`

---

## Resultado

O diagnóstico retornou **174 funções** ainda executáveis por `authenticated`.

Esse número era esperado, pois esta etapa não removeu grant da função. O objetivo foi endurecer o corpo mantendo compatibilidade com o admin.

---

## Função validada

`extend_reservation(p_order_id uuid, p_minutes integer)` segue com:

- `anon_can_execute=false`;
- `authenticated_can_execute=true`;
- `service_role_can_execute=true`;
- retorno `void`.

---

## Reforços confirmados

A função agora:

- valida pedido informado;
- valida minutos entre 1 e 120;
- localiza pedido e loja;
- exige usuário autenticado;
- exige vínculo com a loja;
- aceita apenas pedidos reservados ou confirmados;
- altera apenas reservas ativas do mesmo pedido e da mesma loja;
- registra metadados da prorrogação;
- falha quando não existe reserva ativa.

---

## Compatibilidade

Compatibilidade preservada com:

- `src/pages/private/admin/commercial/orders/Orders.tsx`.

A tela envia `p_order_id` e `p_minutes` e não depende de retorno.

---

## Próxima etapa

### 9.14E.4 — create_order_with_reservation

A próxima análise deve tratar o fluxo legado ainda referenciado pelo `CartDrawer`, avaliando migração para `create_public_order_by_slug` antes de alterar grants da função antiga.
