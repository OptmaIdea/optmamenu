-- As RPCs operacionais de pedidos gravam updated_at ao despachar, concluir e liquidar pedidos.
-- O schema remoto de HML estava sem a coluna, causando erro 42703 em admin_dispatch_public_order_safe.
alter table public.orders
  add column if not exists updated_at timestamptz;

update public.orders
   set updated_at = coalesce(completed_at, confirmed_at, created_at, now())
 where updated_at is null;

alter table public.orders
  alter column updated_at set default now();
