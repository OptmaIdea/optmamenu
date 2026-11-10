# Clientes — coerência de expiração Pix, reserva e pedido (18/10/2026)

## Reprodução concreta
No teste de pagamento antecipado da Gelinhares, o pedido `PED-20261017-232115-498E` foi criado às 23:21:15 e teve sucessivas instruções Pix Sandbox.
A última instrução Pix venceu em 18/10 às **00:07:25**, mas o cancelamento estava agendado para **00:12:25**, incluindo tolerância de 5 minutos para confirmação. Antes da tolerância expirar:
- `orders.status = reserved`, `payment_status = pending`;
- `stock_reservations.status = active`, `expires_at = 00:07:25`;
- `orders.cancellation_grace_until = 00:12:25`.
A função `reconcile_inventory_reservations` soma ao estoque reservado **apenas reservas ainda não expiradas**, enquanto `cancel_expired_reservations()` usa o vencimento efetivo `coalesce(order.cancellation_grace_until, order.expires_at, reservation.expires_at)`. Logo, o estoque poderia ficar disponível antes de o pedido ser cancelado, abrindo risco de dupla promessa de estoque.

Às **00:13:13**, após o cron de 00:13, o pedido foi observado como `cancelled`, pagamento ainda `pending`, reserva `cancelled` e causa `reservation_expired`. Não havia nenhuma intenção Pix paga. A consulta após o cancelamento não encontrou pedidos criados nas últimas 24h e vencidos há mais que a tolerância ainda abertos.

## Correção aplicada (sem mutação retroativa de pedidos)
- `20261018045500_customer_pix_reservation_sync_with_grace.sql`: `create_or_reuse_optmapay_public_pix_intent_v2_internal` passa a manter `stock_reservations.expires_at = v_grace_until`, preservando `payment_instruction_expires_at = p_expires_at` separado em metadata. A rotação não pode reaproveitar reserva já expirada.
- `20261018045600_customer_order_tracking_effective_hold_until.sql`: adiciona `cancellation_grace_until` como data pública não sensível à resposta por token.
- `src/pages/store/PublicOrderTracking.tsx`: enquanto o QR ainda vale, mostra "Aguardando confirmação". Depois do vencimento do QR, exibe "Prazo do Pix encerrado — conferindo confirmação" e a tolerância até o encerramento operacional; após o cancelamento, não apresenta o aviso de pedido em aberto.
- `src/services/publicOrderService.ts`: tipagem da nova data.

Essas alterações não alteram estoque/pagamentos nem recriam reservas do pedido histórico. Não antecipam cancelamento antes da janela segura de confirmação do provedor.

## Teste técnico regressivo
```sql
select
 position('set expires_at=v_grace_until' in lower(pg_get_functiondef(oid))) > 0 as hold_matches_cancel_deadline,
 position('sr.expires_at,''infinity''::timestamptz)>now()' in lower(pg_get_functiondef(oid))) > 0 as reject_expired_reservation_reuse
from pg_proc where proname='create_or_reuse_optmapay_public_pix_intent_v2_internal'
  and pronamespace='public'::regnamespace;
```
Ambos verdadeiros na inspeção SQL. Cron `cancel-expired-orders-every-minute` ativo a cada minuto, com execuções `succeeded`.

## Aceite manual necessário
1. Criar **novo pedido Pix Sandbox** na slug em conta autenticada, deixar a instrução vencer sem pagar.
2. Verificar que, durante tolerância, o QR fica identificado como expirado e o pedido continua em conferência; a disponibilidade **não** é liberada antes do cancelamento final.
3. Após a tolerância + próxima execução do cron: `orders.status=cancelled`, `stock_reservations.status=cancelled`, produto disponível e a fila "Aguardando pagamento" não inclui o pedido.
4. Tentar abrir o link do pedido após o cancelamento: confirmar que não oferece pagar novamente em pedido já cancelado.
5. Em teste separado, confirmar Pix **antes** do vencimento: pedido fica pago e reserva não expira, seguindo ao atendimento.

## Dependência descoberta e não resolvida neste patch
`prepayment_hold_minutes` configurado como **5 minutos** limita inicialmente a reserva, mas a emissão/rotação de instruções Pix Sandbox pode aumentar o prazo até expiração do último QR + tolerância, como ocorreu no exemplo. **O prazo configurado ainda não é garantido como teto absoluto de todas as rotações Pix.** A integração de checkout/pagamentos deve reconciliar a duração válida do QR, o limite comercial da loja e a possibilidade de confirmação tardia antes de afirmar SLA de 5 minutos. Não alterar indiscriminadamente o motor de pagamento nem cancelar pedidos com QR ainda passível de liquidação.
