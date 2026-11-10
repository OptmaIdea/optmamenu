alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status = any (array[
    'pending'::text,
    'paid'::text,
    'failed'::text,
    'refund_pending'::text,
    'partially_refunded'::text,
    'refunded'::text
  ])) not valid;
