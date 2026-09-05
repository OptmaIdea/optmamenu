# Ciclo de pedido: pagamento, reserva e entrega

Data: 27/08/2026

## Regra operacional

O OptmaMenu trata os três fatos separadamente:

1. **Pagamento confirmado**: registra a baixa financeira na conta configurada e suspende o prazo da reserva. Não movimenta o estoque físico.
2. **Retirada**: ao concluir a retirada, consome a reserva e conclui o pedido.
3. **Delivery**: ao marcar **Saiu para entrega**, consome a reserva e muda o pedido para `out_for_delivery`. A confirmação de entrega apenas conclui o pedido; não repete a movimentação de estoque.

Pedidos de entrega não usam timer. Em retirada, o timer vale somente enquanto o pagamento estiver pendente.

## RPCs

- `expire_public_order_reservations()`: expira somente retirada ainda não paga.
- `admin_dispatch_public_order_safe(p_order_id uuid)`: ação protegida por `orders.manage`; consome a reserva de pedido delivery e marca `out_for_delivery`.
- `admin_complete_public_order_safe(p_order_id uuid)`: agora conclui também pedidos já despachados, sem uma segunda baixa de estoque.

A trigger interna `trg_enforce_order_reservation_lifecycle` garante que pagamento confirmado ou delivery removam `expires_at`, inclusive para fluxos automáticos por webhook e confirmação manual.
