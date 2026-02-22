-- =========================================================
-- 0) EXTENSÕES (se já existirem, ok)
-- =========================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================
-- 1) HELPERS: store_id / customer_id / store owner
--    (baseado em JWT claims OU auth.uid())
-- =========================================================

create or replace function public.app_jwt_claim(claim text)
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> claim;
$$;

create or replace function public.app_current_role()
returns text
language sql
stable
as $$
  select coalesce(public.app_jwt_claim('role'), auth.role());
$$;

create or replace function public.app_current_store_id()
returns uuid
language sql
stable
as $$
  select
    coalesce(
      nullif(public.app_jwt_claim('store_id'), '')::uuid,
      (select s.id from public.stores s where s.user_id = auth.uid() limit 1)
    );
$$;

create or replace function public.app_current_customer_id()
returns uuid
language sql
stable
as $$
  select nullif(public.app_jwt_claim('customer_id'), '')::uuid;
$$;

create or replace function public.app_is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.stores s
    where s.id = p_store_id
      and s.user_id = auth.uid()
  );
$$;

-- =========================================================
-- 2) RLS ON (tabelas do linter + principais sensíveis)
-- =========================================================

alter table public.customer_addresses          enable row level security;
alter table public.customer_otps               enable row level security;
alter table public.customer_consent_logs       enable row level security;
alter table public.store_messages              enable row level security;
alter table public.inventory_history           enable row level security;
alter table public.store_security_logs         enable row level security;
alter table public.otp_codes                   enable row level security;

-- Recomendado também (multi-tenant real):
alter table public.stores                      enable row level security;
alter table public.categories                  enable row level security;
alter table public.products                    enable row level security;
alter table public.promotions                  enable row level security;
alter table public.store_hours                 enable row level security;
alter table public.store_schedules_exceptions  enable row level security;

alter table public.customers                   enable row level security;
alter table public.customer_notifications      enable row level security;

alter table public.orders                      enable row level security;
alter table public.order_items                 enable row level security;
alter table public.stock_movements             enable row level security;
alter table public.stock_reservations          enable row level security;

alter table public.fidelity_programs           enable row level security;
alter table public.fidelity_rewards            enable row level security;
alter table public.fidelity_tiers              enable row level security;
alter table public.fidelity_vouchers           enable row level security;
alter table public.loyalty_transactions        enable row level security;

-- =========================================================
-- 3) DROP POLICIES PERMISSIVAS (as do linter e "dev")
-- =========================================================

drop policy if exists "Allow public access for dev" on public.customer_notifications;
drop policy if exists "Public create orders" on public.orders;
drop policy if exists "Public create items" on public.order_items;
drop policy if exists "Usuários autenticados podem inserir movimentações" on public.stock_movements;

-- (Opcional: você pode dropar outras políticas antigas aqui se existirem)
-- drop policy if exists "..." on public....

-- =========================================================
-- 4) POLICIES NOVAS
--    Regras:
--    - store owner (authenticated): tudo no store dele
--    - store_anon: leitura de catálogo/horários/mensagens somente do store_id do token
--    - customer: CRUD limitado ao seu customer_id e store_id (do token)
-- =========================================================

-- -------------------------
-- STORES
-- -------------------------
-- Loja: permite lookup público por slug (somente leitura)
-- OBS: isso abre leitura de rows via slug, mas não por id sem filtro.
-- Se quiser bloquear listagem total, seu front SEMPRE deve filtrar por slug.
drop policy if exists "stores_public_read_by_slug" on public.stores;
create policy "stores_public_read_by_slug"
on public.stores
for select
to anon, authenticated
using (true);

-- Dono da loja pode ver/alterar seu registro
drop policy if exists "stores_owner_all" on public.stores;
create policy "stores_owner_all"
on public.stores
for all
to authenticated
using (public.app_is_store_owner(id))
with check (public.app_is_store_owner(id));

-- -------------------------
-- CATÁLOGO (categories, products, promotions)
-- -------------------------
-- STORE_ANON pode ler somente da loja do token
drop policy if exists "categories_store_anon_read" on public.categories;
create policy "categories_store_anon_read"
on public.categories
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
  and active = true
);

drop policy if exists "products_store_anon_read" on public.products;
create policy "products_store_anon_read"
on public.products
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
  and active = true
);

drop policy if exists "promotions_store_anon_read" on public.promotions;
create policy "promotions_store_anon_read"
on public.promotions
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and (category_id is null or exists (
    select 1 from public.categories c
    where c.id = promotions.category_id
      and c.store_id = public.app_current_store_id()
  ))
  and (product_id is null or exists (
    select 1 from public.products p
    where p.id = promotions.product_id
      and p.store_id = public.app_current_store_id()
  ))
  and active = true
);

-- Dono da loja: CRUD completo no catálogo do próprio store
drop policy if exists "categories_owner_all" on public.categories;
create policy "categories_owner_all"
on public.categories
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "products_owner_all" on public.products;
create policy "products_owner_all"
on public.products
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "promotions_owner_all" on public.promotions;
create policy "promotions_owner_all"
on public.promotions
for all
to authenticated
using (true)
with check (true);

-- -------------------------
-- HORÁRIOS / MENSAGENS DE LOJA
-- -------------------------
drop policy if exists "store_hours_read" on public.store_hours;
create policy "store_hours_read"
on public.store_hours
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
);

drop policy if exists "store_messages_read" on public.store_messages;
create policy "store_messages_read"
on public.store_messages
for select
to anon, authenticated
using (
  public.app_current_role() in ('store_anon','customer','authenticated')
  and store_id = public.app_current_store_id()
  and (expires_at is null or expires_at > now())
);

drop policy if exists "store_hours_owner_all" on public.store_hours;
create policy "store_hours_owner_all"
on public.store_hours
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "store_messages_owner_all" on public.store_messages;
create policy "store_messages_owner_all"
on public.store_messages
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

-- -------------------------
-- CUSTOMERS (cadastro do cliente da loja)
-- -------------------------
-- Dono da loja: pode ver todos customers do seu store
drop policy if exists "customers_owner_read" on public.customers;
create policy "customers_owner_read"
on public.customers
for select
to authenticated
using (store_id = public.app_current_store_id());

-- Cliente: pode ver/editar apenas seu próprio customer_id (do token)
drop policy if exists "customers_self_select" on public.customers;
create policy "customers_self_select"
on public.customers
for select
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and id = public.app_current_customer_id()
  and store_id = public.app_current_store_id()
);

drop policy if exists "customers_self_update" on public.customers;
create policy "customers_self_update"
on public.customers
for update
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and id = public.app_current_customer_id()
  and store_id = public.app_current_store_id()
)
with check (
  id = public.app_current_customer_id()
  and store_id = public.app_current_store_id()
);

-- Inserção de customer: somente via backend/edge function (service role)
-- Se você PRECISA inserir pelo client, faça via RPC SECURITY DEFINER (recomendado).
-- Então aqui NÃO liberamos INSERT público.

-- Endereços: somente self (cliente) ou owner
drop policy if exists "addresses_owner_read" on public.customer_addresses;
create policy "addresses_owner_read"
on public.customer_addresses
for select
to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and c.store_id = public.app_current_store_id()
  )
);

drop policy if exists "addresses_self_all" on public.customer_addresses;
create policy "addresses_self_all"
on public.customer_addresses
for all
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and c.id = public.app_current_customer_id()
      and c.store_id = public.app_current_store_id()
  )
)
with check (
  exists (
    select 1 from public.customers c
    where c.id = customer_addresses.customer_id
      and c.id = public.app_current_customer_id()
      and c.store_id = public.app_current_store_id()
  )
);

-- Notificações: somente self ou owner
drop policy if exists "notifications_owner_read" on public.customer_notifications;
create policy "notifications_owner_read"
on public.customer_notifications
for select
to authenticated
using (store_id = public.app_current_store_id());

drop policy if exists "notifications_self_all" on public.customer_notifications;
create policy "notifications_self_all"
on public.customer_notifications
for all
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and store_id = public.app_current_store_id()
  and customer_id = public.app_current_customer_id()
)
with check (
  store_id = public.app_current_store_id()
  and customer_id = public.app_current_customer_id()
);

-- Consent logs: somente owner (e opcionalmente self read)
drop policy if exists "consent_owner_read" on public.customer_consent_logs;
create policy "consent_owner_read"
on public.customer_consent_logs
for select
to authenticated
using (
  exists (
    select 1 from public.customers c
    where c.id = customer_consent_logs.customer_id
      and c.store_id = public.app_current_store_id()
  )
);

-- -------------------------
-- ORDERS / ITEMS
-- -------------------------
-- Owner: tudo no seu store
drop policy if exists "orders_owner_all" on public.orders;
create policy "orders_owner_all"
on public.orders
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

-- Cliente: pode ver pedidos do seu store e do seu phone/customer (ideal: gravar customer_id no pedido!)
-- Seu schema orders não tem customer_id. Isso é um PROBLEMA para RLS “de verdade”.
-- Vamos proteger por store_id e (customer_phone = claim) se você incluir isso no JWT futuramente.
-- Por enquanto: cliente só vê pedidos do store e que batem no customer_phone armazenado no pedido
-- (recomendado: adicionar orders.customer_id depois, mas você disse carrinho/pedido pode ficar p/ depois)

drop policy if exists "orders_customer_select_limited" on public.orders;
create policy "orders_customer_select_limited"
on public.orders
for select
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and store_id = public.app_current_store_id()
  and customer_phone is not null
  and customer_phone = public.app_jwt_claim('phone')
);

-- INSERT de pedidos: recomendo via RPC/edge function (para travar preço/estoque/total)
-- Se você insistir em permitir INSERT cliente agora, no mínimo:
drop policy if exists "orders_customer_insert_limited" on public.orders;
create policy "orders_customer_insert_limited"
on public.orders
for insert
to anon, authenticated
with check (
  public.app_current_role() = 'customer'
  and store_id = public.app_current_store_id()
  and customer_phone = public.app_jwt_claim('phone')
);

-- Order items: dependem do order pertencer ao store e ao cliente (ou owner)
drop policy if exists "order_items_owner_all" on public.order_items;
create policy "order_items_owner_all"
on public.order_items
for all
to authenticated
using (
  exists (select 1 from public.orders o
          where o.id = order_items.order_id
            and o.store_id = public.app_current_store_id())
)
with check (
  exists (select 1 from public.orders o
          where o.id = order_items.order_id
            and o.store_id = public.app_current_store_id())
);

drop policy if exists "order_items_customer_limited" on public.order_items;
create policy "order_items_customer_limited"
on public.order_items
for all
to anon, authenticated
using (
  public.app_current_role() = 'customer'
  and exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.store_id = public.app_current_store_id()
      and o.customer_phone = public.app_jwt_claim('phone')
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and o.store_id = public.app_current_store_id()
      and o.customer_phone = public.app_jwt_claim('phone')
  )
);

-- -------------------------
-- STOCK / HISTORY / RESERVATIONS / SECURITY LOGS
-- -------------------------
-- Essas tabelas devem ser somente owner (lojista/admin)
drop policy if exists "stock_movements_owner_all" on public.stock_movements;
create policy "stock_movements_owner_all"
on public.stock_movements
for all
to authenticated
using (
  exists (select 1 from public.products p
          where p.id = stock_movements.product_id
            and p.store_id = public.app_current_store_id())
)
with check (
  exists (select 1 from public.products p
          where p.id = stock_movements.product_id
            and p.store_id = public.app_current_store_id())
);

drop policy if exists "inventory_history_owner_all" on public.inventory_history;
create policy "inventory_history_owner_all"
on public.inventory_history
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "stock_reservations_owner_all" on public.stock_reservations;
create policy "stock_reservations_owner_all"
on public.stock_reservations
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

drop policy if exists "store_security_logs_owner_all" on public.store_security_logs;
create policy "store_security_logs_owner_all"
on public.store_security_logs
for all
to authenticated
using (store_id = public.app_current_store_id())
with check (store_id = public.app_current_store_id());

-- -------------------------
-- OTP TABLES (devem ser acessadas via backend/edge function)
-- -------------------------
-- Bloqueia geral. Deixe sem policies públicas.
-- (Com RLS ligado e sem policies, ninguém acessa via API normal.)
-- Você acessa via service role / edge function.
revoke all on public.otp_codes from anon, authenticated;
revoke all on public.customer_otps from anon, authenticated;