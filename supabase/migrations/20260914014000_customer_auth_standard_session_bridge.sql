-- Customer portal authentication bridge using standard Supabase Auth sessions.
--
-- Security model:
-- - OTP validation remains server-side.
-- - A dedicated Supabase Auth user is created per OptmaMenu customer identity.
-- - The browser receives a one-time magic-link token hash only after OTP proof.
-- - Normal Supabase authenticated sessions are then used; no fake `role=customer` JWT is signed.

create table if not exists public.customer_auth_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_issued_at timestamptz,
  unique (customer_id),
  unique (auth_user_id)
);

create index if not exists customer_auth_identities_store_customer_idx
  on public.customer_auth_identities(store_id, customer_id);

alter table public.customer_auth_identities enable row level security;

drop policy if exists customer_auth_identities_no_direct_access on public.customer_auth_identities;
create policy customer_auth_identities_no_direct_access
  on public.customer_auth_identities
  as restrictive
  for all
  to public
  using (false)
  with check (false);

create or replace function public.app_current_customer_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    nullif(public.app_jwt_claim('customer_id'), '')::uuid,
    (
      select customer_id
      from public.customer_auth_identities
      where auth_user_id = auth.uid()
      limit 1
    )
  );
$function$;

create or replace function public.app_current_store_id()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(
    nullif(public.app_jwt_claim('store_id'), '')::uuid,
    (
      select store_id
      from public.customer_auth_identities
      where auth_user_id = auth.uid()
      limit 1
    ),
    (select s.id from public.stores s where s.user_id = auth.uid() limit 1)
  );
$function$;

create or replace function public.app_current_role()
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_claim text := public.app_jwt_claim('role');
  v_customer uuid;
begin
  if v_claim = 'customer' then
    return 'customer';
  end if;

  select customer_id into v_customer
  from public.customer_auth_identities
  where auth_user_id = auth.uid()
  limit 1;

  if v_customer is not null then
    return 'customer';
  end if;

  return coalesce(v_claim, auth.role());
end;
$function$;

create or replace function public.validate_customer_auth_identity_store()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if not exists (
    select 1
    from public.customers c
    where c.id = new.customer_id
      and c.store_id = new.store_id
  ) then
    raise exception 'customer_store_mismatch';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_validate_customer_auth_identity_store on public.customer_auth_identities;
create trigger trg_validate_customer_auth_identity_store
before insert or update on public.customer_auth_identities
for each row execute function public.validate_customer_auth_identity_store();
