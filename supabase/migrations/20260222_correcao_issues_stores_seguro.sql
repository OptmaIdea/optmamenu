-- =========================================================
-- D) STORES: bloquear listagem pública e permitir lookup por slug via RPC
-- =========================================================

-- 1) Remove qualquer policy pública antiga
drop policy if exists "stores_public_read_by_slug" on public.stores;
drop policy if exists "stores_owner_all" on public.stores;

-- 2) Dono da loja pode ver/alterar seu registro (authenticated)
create policy "stores_owner_all"
on public.stores
for all
to authenticated
using (public.app_is_store_owner(id))
with check (public.app_is_store_owner(id));

-- 3) BLOQUEIA leitura direta por anon no endpoint REST
revoke select on public.stores from anon;

-- 4) RPC segura para lookup por slug
create or replace function public.get_store_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  logo_url text,
  phone_number text,
  theme_config jsonb,
  address jsonb,
  contacts jsonb,
  config jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    s.id, s.slug, s.name, s.description, s.logo_url, s.phone_number,
    s.theme_config, s.address, s.contacts, s.config
  from public.stores s
  where s.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_store_by_slug(text) to anon, authenticated;