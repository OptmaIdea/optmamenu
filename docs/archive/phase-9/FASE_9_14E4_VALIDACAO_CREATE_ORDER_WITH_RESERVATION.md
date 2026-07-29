# Fase 9.14E.4 — Validação

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628001500_revoke_authenticated_from_create_order_with_reservation.sql`

## Resultado

O diagnóstico retornou **173 funções**.

Antes desta etapa eram **174**.

A função legada `create_order_with_reservation` não aparece mais no resultado.

## Frontend

Antes da migration, o layout público foi ajustado no arquivo:

- `src/components/layouts/StoreLayout.tsx`

Commit:

- `f46d5a5319cd3075c80d9e8951ff90a509d18b81`

Motivo:

- o fluxo público atual usa `Catalog.tsx` com `PublicOrderService.createPublicOrder`;
- o fluxo novo usa `create_public_order_by_slug`;
- o `CartDrawer` legado era o único ponto com chamada direta para `create_order_with_reservation`;
- esse componente foi desacoplado do layout público.

## Interpretação

A etapa foi validada porque:

- removeu o caminho legado do resultado do diagnóstico;
- preservou o fluxo público novo;
- não alterou `create_public_order_by_slug`;
- manteve compatibilidade operacional via `service_role`.

## Próxima etapa

### 9.14E.5 — Auxiliares antigas de reserva e estoque

Candidatas iniciais:

- `cancel_order_reservations`;
- `cancel_reservation_only`;
- `confirm_order_stock`;
- `confirm_reserved_stock`.

Diretriz:

- buscar uso no frontend;
- verificar se são auxiliares internas;
- tratar apenas funções sem uso direto e com alternativa segura.
