-- =========================================================
-- C) DROP POLICIES PERMISSIVAS (as do linter / dev)
-- =========================================================
drop policy if exists "Allow public access for dev" on public.customer_notifications;
drop policy if exists "Public create orders" on public.orders;
drop policy if exists "Public create items" on public.order_items;
drop policy if exists "Usuários autenticados podem inserir movimentações" on public.stock_movements;