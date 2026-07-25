-- Mantém o status de pagamento do pedido alinhado ao lançamento financeiro.
-- Um lançamento confirmado de venda no Livro Diário torna o pedido concluído pago.

create or replace function public.sync_order_payment_status_from_cashbook()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.order_id is not null
     and new.type = 'sale'
     and new.direction = 'in'
     and new.status = 'confirmed'
     and coalesce(new.affects_balance, true) then
    update public.orders o
    set
      payment_status = 'paid',
      payment_method_code = coalesce(nullif(o.payment_method_code, 'pending'), new.payment_method_code),
      payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'paid_at', coalesce(o.payment_metadata->>'paid_at', new.occurred_at::text, new.created_at::text, now()::text),
          'paid_by_source', 'cashbook_entry_confirmed',
          'cashbook_entry_id', new.id,
          'cashbook_entry_code', new.entry_code
        ),
      commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb)
        || jsonb_build_object(
          'cashbook_entry_id', new.id,
          'cashbook_entry_code', new.entry_code,
          'financial_posted', true
        )
    where o.id = new.order_id
      and o.store_id = new.store_id
      and o.status::text = 'completed'
      and coalesce(o.payment_status, 'pending') <> 'paid';
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_order_payment_status_from_cashbook()
  from public, anon, authenticated;

drop trigger if exists trg_sync_order_payment_status_from_cashbook
  on public.cashbook_entries;

create trigger trg_sync_order_payment_status_from_cashbook
after insert or update of status, affects_balance, payment_method_code
on public.cashbook_entries
for each row
execute function public.sync_order_payment_status_from_cashbook();

with latest_confirmed_sale as (
  select distinct on (c.order_id)
    c.order_id,
    c.store_id,
    c.id,
    c.entry_code,
    c.payment_method_code,
    c.occurred_at,
    c.created_at
  from public.cashbook_entries c
  where c.order_id is not null
    and c.type = 'sale'
    and c.direction = 'in'
    and c.status = 'confirmed'
    and coalesce(c.affects_balance, true)
  order by c.order_id, c.created_at desc
)
update public.orders o
set
  payment_status = 'paid',
  payment_method_code = coalesce(nullif(o.payment_method_code, 'pending'), cbe.payment_method_code),
  payment_metadata = coalesce(o.payment_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'paid_at', coalesce(o.payment_metadata->>'paid_at', cbe.occurred_at::text, cbe.created_at::text, now()::text),
      'paid_by_source', 'cashbook_backfill',
      'cashbook_entry_id', cbe.id,
      'cashbook_entry_code', cbe.entry_code
    ),
  commercial_metadata = coalesce(o.commercial_metadata, '{}'::jsonb)
    || jsonb_build_object(
      'cashbook_entry_id', cbe.id,
      'cashbook_entry_code', cbe.entry_code,
      'financial_posted', true
    )
from latest_confirmed_sale cbe
where o.id = cbe.order_id
  and o.store_id = cbe.store_id
  and o.status::text = 'completed'
  and coalesce(o.payment_status, 'pending') <> 'paid';
