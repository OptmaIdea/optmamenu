# Fase 9.14E.5 — Validação das auxiliares antigas de reserva e estoque

## Status

Concluída.

Migration validada:

- `supabase/migrations/20260628012500_revoke_authenticated_from_legacy_reservation_helpers.sql`

## Resultado

O diagnóstico retornou **169 funções** ainda executáveis por `authenticated`.

Antes desta etapa eram **173**.

Redução confirmada:

- **4 funções removidas da superfície authenticated**.

## Funções removidas

As funções abaixo não aparecem mais no diagnóstico:

- `cancel_order_reservations(p_store_id uuid, p_order_id uuid, p_created_by uuid)`;
- `cancel_reservation_only(p_store_id uuid, p_order_id uuid, p_created_by uuid)`;
- `confirm_order_stock(p_store_id uuid, p_order_id uuid, p_created_by uuid)`;
- `confirm_reserved_stock(p_store_id uuid, p_order_id uuid, p_created_by uuid)`.

## Interpretação

A etapa foi validada porque:

- removeu apenas auxiliares antigas sem uso direto no frontend atual;
- preservou funções novas e seguras de pedidos;
- não alterou fluxos comerciais ativos;
- manteve `service_role` para compatibilidade operacional.

## Funções seguras preservadas

Permanecem no diagnóstico, conforme esperado:

- `admin_cancel_public_order_safe`;
- `admin_complete_public_order_safe`;
- `confirm_order_payment`;
- `confirm_reserved_public_order`;
- `complete_confirmed_public_order`;
- `extend_reservation`, já endurecida na 9.14E.3.

## Estado acumulado da 9.14E

Até aqui:

- 9.14E.1 reduziu de 184 para 176;
- 9.14E.2 reduziu de 176 para 174;
- 9.14E.3 endureceu `extend_reservation` sem alterar contagem;
- 9.14E.4 reduziu de 174 para 173;
- 9.14E.5 reduziu de 173 para 169.

## Próxima etapa recomendada

Continuar a auditoria por subgrupos pequenos, priorizando agora funções autenticadas que parecem seguras e usadas, para documentação de exceções intencionais ou pequenos hardenings pontuais.

Candidato natural:

- grupo comercial de pedidos/clientes/fidelidade, separando funções `*_safe` que já validam loja/permissão das que ainda são auxiliares internas.
