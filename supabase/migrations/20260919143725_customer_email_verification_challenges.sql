-- Desafios de confirmação de e-mail do cliente. O e-mail permanece atributo do cliente, não identidade principal do Supabase Auth.
create table if not exists public.customer_email_verification_challenges (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  requested_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  used_at timestamptz,
  provider_message_id text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists customer_email_verification_customer_idx
  on public.customer_email_verification_challenges(store_id,customer_id,requested_at desc);
create index if not exists customer_email_verification_active_idx
  on public.customer_email_verification_challenges(token_hash,expires_at) where used_at is null;
alter table public.customer_email_verification_challenges enable row level security;
revoke all on table public.customer_email_verification_challenges from public,anon,authenticated;
grant all on table public.customer_email_verification_challenges to service_role;
