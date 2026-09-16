-- CLIENTES C2 — índices de suporte às relações de fusão.
-- Remove os alertas novos do Performance Advisor e cobre a navegação do alias fundido.

create index if not exists idx_customer_merge_events_actor_user
  on public.customer_merge_events (actor_user_id);

create index if not exists idx_customers_merged_into_customer
  on public.customers (merged_into_customer_id);
