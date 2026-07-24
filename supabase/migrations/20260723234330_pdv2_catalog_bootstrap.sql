-- PDV Fase 2: códigos extensíveis de produto e bootstrap seguro do terminal.

create table if not exists public.product_codes (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  code_type text not null,
  code_value text not null,
  normalized_code text not null,
  is_primary boolean not null default false,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_codes_type_format_chk
    check (code_type ~ '^[a-z][a-z0-9_]{1,31}$'),
  constraint product_codes_value_not_blank_chk
    check (btrim(code_value) <> ''),
  constraint product_codes_normalized_not_blank_chk
    check (btrim(normalized_code) <> '')
);

comment on table public.product_codes is
  'Códigos extensíveis de produto por loja (internal, ean, sku e tipos futuros).';
comment on column public.product_codes.normalized_code is
  'Código sem espaços/pontuação e em maiúsculas, usado em busca e unicidade.';

create unique index if not exists product_codes_store_normalized_active_uidx
  on public.product_codes (store_id, normalized_code)
  where active;

create unique index if not exists product_codes_primary_type_uidx
  on public.product_codes (product_id, code_type)
  where active and is_primary;

create index if not exists product_codes_product_idx
  on public.product_codes (product_id, active);

create or replace function public.normalize_product_code(p_value text)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog
as $$
  select upper(regexp_replace(btrim(p_value), '[^[:alnum:]]', '', 'g'));
$$;

revoke all on function public.normalize_product_code(text) from public, anon, authenticated;

create or replace function public.prepare_product_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product_store_id uuid;
begin
  new.code_type := lower(btrim(new.code_type));
  new.code_value := btrim(new.code_value);
  new.normalized_code := public.normalize_product_code(new.code_value);
  new.updated_at := now();

  select p.store_id
    into v_product_store_id
  from public.products p
  where p.id = new.product_id;

  if v_product_store_id is null then
    raise exception 'Produto não encontrado.'
      using errcode = 'P0002';
  end if;

  if v_product_store_id <> new.store_id then
    raise exception 'O código e o produto devem pertencer à mesma loja.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_product_code() from public, anon, authenticated;

drop trigger if exists trg_prepare_product_code on public.product_codes;
create trigger trg_prepare_product_code
before insert or update on public.product_codes
for each row execute function public.prepare_product_code();

alter table public.product_codes enable row level security;

drop policy if exists product_codes_select_by_permission on public.product_codes;
create policy product_codes_select_by_permission
on public.product_codes
for select
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'products.view')
  or public.user_has_store_permission(store_id, 'products.manage')
  or public.user_has_store_permission(store_id, 'pdv.view')
);

drop policy if exists product_codes_insert_by_permission on public.product_codes;
create policy product_codes_insert_by_permission
on public.product_codes
for insert
to authenticated
with check (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'products.manage')
);

drop policy if exists product_codes_update_by_permission on public.product_codes;
create policy product_codes_update_by_permission
on public.product_codes
for update
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'products.manage')
)
with check (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'products.manage')
);

drop policy if exists product_codes_delete_by_permission on public.product_codes;
create policy product_codes_delete_by_permission
on public.product_codes
for delete
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'products.manage')
);

revoke all on table public.product_codes from public, anon;
grant select, insert, update, delete on table public.product_codes to authenticated;

create or replace function public.get_pos_bootstrap(
  p_store_id uuid,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_member public.store_members%rowtype;
  v_location_id uuid;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.'
      using errcode = '42501';
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission_v2(p_store_id, 'pdv.view')
  ) then
    raise exception 'Sem permissão para acessar o PDV.'
      using errcode = '42501';
  end if;

  select sm.*
    into v_member
  from public.store_members sm
  where sm.store_id = p_store_id
    and sm.user_id = v_user_id
    and sm.status = 'active'
  limit 1;

  if v_member.id is null then
    raise exception 'Vínculo ativo com a loja não encontrado.'
      using errcode = '42501';
  end if;

  if p_location_id is not null then
    select sl.id
      into v_location_id
    from public.stock_locations sl
    where sl.id = p_location_id
      and sl.store_id = p_store_id
      and sl.active
      and sl.allow_sales;

    if v_location_id is null then
      raise exception 'Local de venda inválido ou indisponível.'
        using errcode = '22023';
    end if;
  else
    select sl.id
      into v_location_id
    from public.stock_locations sl
    join public.stores s on s.id = sl.store_id
    where sl.store_id = p_store_id
      and sl.active
      and sl.allow_sales
    order by
      (sl.id = s.public_sales_location_id) desc,
      sl.is_default desc,
      sl.sort_order,
      sl.name
    limit 1;
  end if;

  select jsonb_build_object(
    'store', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'logo_url', s.logo_url
    ),
    'operator', jsonb_build_object(
      'member_id', v_member.id,
      'user_id', v_member.user_id,
      'name', coalesce(
        nullif(btrim(v_member.internal_alias), ''),
        nullif(btrim(p.name), ''),
        nullif(btrim(v_member.member_email), ''),
        'Operador'
      ),
      'role', v_member.role,
      'avatar_url', coalesce(v_member.member_avatar_url, p.avatar_url)
    ),
    'locations', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sl.id,
          'code', sl.code,
          'name', sl.name,
          'is_default', sl.is_default
        )
        order by sl.is_default desc, sl.sort_order, sl.name
      )
      from public.stock_locations sl
      where sl.store_id = p_store_id
        and sl.active
        and sl.allow_sales
    ), '[]'::jsonb),
    'selected_location_id', v_location_id,
    'categories', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'image_url', c.image_url,
          'sort_order', coalesce(c.sort_order, 0),
          'price_logic_type', c.price_logic_type,
          'price_rules', coalesce(c.price_rules, '[]'::jsonb),
          'pricing_strategy', coalesce(c.pricing_strategy, '{}'::jsonb)
        )
        order by coalesce(c.sort_order, 0), c.name
      )
      from public.categories c
      where c.store_id = p_store_id
        and coalesce(c.active, true)
    ), '[]'::jsonb),
    'products', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'category_id', pr.category_id,
          'name', pr.name,
          'description', pr.description,
          'price', pr.price,
          'images', coalesce(to_jsonb(pr.images), '[]'::jsonb),
          'available_stock', greatest(
            coalesce(ilb.on_hand, 0) - coalesce(ilb.reserved, 0),
            0
          ),
          'use_category_pricing', coalesce(pr.use_category_pricing, false),
          'price_logic_type', pr.price_logic_type,
          'price_rules', coalesce(pr.price_rules, '[]'::jsonb),
          'codes', coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', pc.id,
                'type', pc.code_type,
                'value', pc.code_value,
                'normalized', pc.normalized_code,
                'is_primary', pc.is_primary
              )
              order by pc.is_primary desc, pc.code_type, pc.code_value
            )
            from public.product_codes pc
            where pc.product_id = pr.id
              and pc.store_id = p_store_id
              and pc.active
          ), '[]'::jsonb)
        )
        order by coalesce(pr.sort_order, 0), pr.name
      )
      from public.products pr
      left join public.inventory_location_balances ilb
        on ilb.store_id = pr.store_id
       and ilb.product_id = pr.id
       and ilb.location_id = v_location_id
       and ilb.variant_id is null
      where pr.store_id = p_store_id
        and coalesce(pr.active, true)
        and not coalesce(pr.discontinued, false)
        and not coalesce(pr.is_discontinued, false)
    ), '[]'::jsonb)
  )
    into v_result
  from public.stores s
  left join public.profiles p on p.id = v_user_id
  where s.id = p_store_id;

  if v_result is null then
    raise exception 'Loja não encontrada.'
      using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

comment on function public.get_pos_bootstrap(uuid, uuid) is
  'Retorna contexto reduzido e seguro do PDV: loja, operador, locais, categorias, produtos, códigos e estoque disponível.';

revoke all on function public.get_pos_bootstrap(uuid, uuid) from public, anon;
grant execute on function public.get_pos_bootstrap(uuid, uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'inventory_location_balances'
  ) then
    alter publication supabase_realtime
      add table public.inventory_location_balances;
  end if;
end;
$$;
