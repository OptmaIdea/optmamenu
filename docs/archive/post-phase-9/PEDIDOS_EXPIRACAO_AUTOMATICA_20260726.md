# Pedidos — Expiração automática e liberação de reservas

Data: 2026-07-26

## Problema identificado

A limpeza de pedidos vencidos dependia da tela `Pedidos` permanecer aberta. O frontend verificava expirações a cada 30 segundos e chamava `cancel_expired_reservations(p_store_id)`. Sem um operador nessa tela, pedidos vencidos podiam permanecer ativos e conservar reservas por mais tempo que o previsto.

## Solução adotada

Foi habilitado `pg_cron` e criado o job:

```text
cancel-expired-orders-every-minute
```

Agenda:

```text
* * * * *
```

Comando:

```sql
select public.cancel_expired_reservations();
```

A migration oficial é:

```text
supabase/migrations/20260726042000_schedule_expired_order_cleanup.sql
```

## Regras da função global

A função sem parâmetros é o mecanismo batch usado pelo cron.

Ela:

- considera apenas pedidos `reserved`, `confirmed` ou `ready`;
- ignora pedidos com `payment_status = 'paid'`;
- exige reserva ativa vencida;
- usa `cancellation_grace_until`, depois `expires_at` do pedido e, por último, `expires_at` da reserva;
- usa `FOR UPDATE SKIP LOCKED` para concorrência segura;
- altera o pedido para `cancelled`;
- mantém a reserva para auditoria, alterando seu status para `cancelled`;
- grava motivo, horário e origem automática em metadados;
- é idempotente: pedidos já cancelados ou pagos não são processados novamente.

Metadados no pedido:

```json
{
  "cancelled_reason": "reservation_expired",
  "cancelled_at": "timestamp",
  "cancelled_by": "scheduled_cleanup"
}
```

Metadados na reserva:

```json
{
  "cancel_reason": "reservation_expired",
  "cancelled_at": "timestamp",
  "cancelled_by": "scheduled_cleanup"
}
```

## Papel do frontend

A verificação a cada 30 segundos em `Orders.tsx` permanece como redundância operacional e atualização rápida da interface. Ela não é mais o mecanismo principal de expiração.

## Segurança

A função batch global:

- é `SECURITY DEFINER`;
- tem `search_path = public`;
- não pode ser executada por `public`, `anon` ou `authenticated`;
- pode ser executada por `service_role` e pelo job interno do banco.

A função por loja continua protegida por propriedade da loja ou permissão `orders.manage`.

## Consultas de saúde

Verificar o job:

```sql
select jobid, jobname, schedule, command, active
from cron.job
where jobname = 'cancel-expired-orders-every-minute';
```

Consultar execuções recentes:

```sql
select jobid, status, return_message, start_time, end_time
from cron.job_run_details
where jobid = (
  select jobid
  from cron.job
  where jobname = 'cancel-expired-orders-every-minute'
)
order by start_time desc
limit 20;
```

Verificar pedidos vencidos ainda ativos:

```sql
select o.id, o.order_code, o.status, o.payment_status
from public.orders o
where o.status in ('reserved', 'confirmed', 'ready')
  and coalesce(o.payment_status, 'pending') <> 'paid'
  and exists (
    select 1
    from public.stock_reservations sr
    where sr.order_id = o.id
      and sr.store_id = o.store_id
      and sr.status = 'active'
      and coalesce(o.cancellation_grace_until, o.expires_at, sr.expires_at) <= now()
  );
```

O resultado esperado em operação normal é zero linhas.

## Estado validado

- job criado e ativo;
- frequência de um minuto;
- função executada manualmente sem afetar pedidos válidos;
- nenhum pedido vencido permaneceu ativo após a validação;
- pedidos pagos permanecem protegidos;
- reservas canceladas permanecem auditáveis, sem exclusão física.
