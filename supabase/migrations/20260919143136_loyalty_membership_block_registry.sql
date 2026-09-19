-- Registro de bloqueios de participação na fidelidade por CPF sem armazenar o CPF em claro.
create table if not exists public.fidelity_membership_blocks (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  cpf_hash text not null,
  cpf_last4 text,
  reason text,
  blocked_at timestamptz not null default clock_timestamp(),
  blocked_by uuid references auth.users(id) on delete set null,
  unblocked_at timestamptz,
  unblocked_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists fidelity_membership_blocks_active_cpf_idx
  on public.fidelity_membership_blocks(store_id,cpf_hash) where unblocked_at is null;
create index if not exists fidelity_membership_blocks_customer_idx
  on public.fidelity_membership_blocks(store_id,customer_id,blocked_at desc);
alter table public.fidelity_membership_blocks enable row level security;
revoke all on table public.fidelity_membership_blocks from public,anon,authenticated;
grant all on table public.fidelity_membership_blocks to service_role;

create or replace function public.fidelity_cpf_hash(p_store_id uuid,p_cpf text)
returns text language sql immutable strict set search_path to 'public','extensions'
as $function$
  select encode(extensions.digest(p_store_id::text||':'||regexp_replace(coalesce(p_cpf,''),'\D','','g'),'sha256'),'hex');
$function$;
revoke all on function public.fidelity_cpf_hash(uuid,text) from public,anon,authenticated;
grant execute on function public.fidelity_cpf_hash(uuid,text) to service_role;
