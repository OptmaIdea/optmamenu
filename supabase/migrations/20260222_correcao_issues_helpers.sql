-- =========================================================
-- A) EXTENSÕES (se já existirem, ok)
-- =========================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================
-- A1) Helpers: ler claims do JWT e inferir store do owner
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