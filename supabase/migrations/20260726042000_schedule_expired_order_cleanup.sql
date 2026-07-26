-- Cancelamento periódico e idempotente de pedidos com reserva expirada.
-- A tela de Pedidos permanece como proteção oportunista, mas o cron é o mecanismo principal.

create extension if not exists pg_cron with schema extensions;

create or replace function public.cancel_expired_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_count integer := 0;
begin
  with candidates as materialized (
    select o.id
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
      )
    for update skip locked
  ), cancelled_orders as (
    update public.orders o
       set status = 'cancelled',
           commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'cancelled_reason', 'reservation_expired',
                  'cancelled_at', now(),
                  'cancelled_by', 'scheduled_cleanup'
                )
      from candidates c
     where o.id = c.id
       and o.status in ('reserved', 'confirmed', 'ready')
       and coalesce(o.payment_status, 'pending') <> 'paid'
    returning o.id
  ), cancelled_reservations as (
    update public.stock_reservations sr
       set status = 'cancelled',
           metadata = coalesce(sr.metadata, '{}'::jsonb)
             || jsonb_build_object(
                  'cancelled_at', now(),
                  'cancel_reason', 'reservation_expired',
                  'cancelled_by', 'scheduled_cleanup'
                )
      from cancelled_orders co
     where sr.order_id = co.id
       and sr.status = 'active'
    returning sr.order_id
  )
  select count(*)::integer into v_count from cancelled_orders;

  return v_count;
end;
$function$;

revoke all on function public.cancel_expired_reservations() from public, anon, authenticated;
grant execute on function public.cancel_expired_reservations() to service_role;

select cron.unschedule(jobid)
from cron.job
where jobname = 'cancel-expired-orders-every-minute';

select cron.schedule(
  'cancel-expired-orders-every-minute',
  '* * * * *',
  $cron$select public.cancel_expired_reservations();$cron$
);
