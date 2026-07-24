-- Grupos de precificação: atacado combinado entre categorias distintas.
--
-- Princípios:
-- - o backend continua sendo a autoridade final do preço;
-- - produto com regra própria prevalece sobre grupo e categoria;
-- - grupos inativos não interferem no preço publicado;
-- - regras e origem aplicadas permanecem no snapshot comercial do pedido.

create table if not exists public.pricing_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  price_logic_type text not null default 'category_volume',
  price_rules jsonb not null default '[]'::jsonb,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_groups_name_not_blank_chk check (btrim(name) <> ''),
  constraint pricing_groups_logic_type_chk check (price_logic_type = 'category_volume'),
  constraint pricing_groups_price_rules_array_chk check (jsonb_typeof(price_rules) = 'array')
);

create unique index if not exists pricing_groups_store_name_uidx
  on public.pricing_groups (store_id, lower(btrim(name)));

create index if not exists pricing_groups_store_active_idx
  on public.pricing_groups (store_id, active, name);

alter table public.categories
  add column if not exists pricing_group_id uuid
    references public.pricing_groups(id) on delete restrict,
  add column if not exists use_pricing_group_rules boolean not null default false;

create index if not exists categories_pricing_group_idx
  on public.categories (pricing_group_id)
  where pricing_group_id is not null;

create or replace function public.validate_pricing_group_record()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_rule jsonb;
  v_previous_min integer := -1;
  v_current_min integer;
  v_current_price numeric;
begin
  new.name := btrim(new.name);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.updated_at := now();

  if jsonb_typeof(new.price_rules) <> 'array' then
    raise exception 'As faixas do grupo devem ser uma lista.'
      using errcode = '22023';
  end if;

  if jsonb_array_length(new.price_rules) = 0 then
    raise exception 'Informe ao menos uma faixa de preço para o grupo.'
      using errcode = '22023';
  end if;

  for v_rule in
    select value
    from jsonb_array_elements(new.price_rules)
    order by coalesce((value->>'min')::integer, -1)
  loop
    if jsonb_typeof(v_rule) <> 'object'
       or not (v_rule ? 'min')
       or not (v_rule ? 'price') then
      raise exception 'Cada faixa deve informar quantidade mínima e preço.'
        using errcode = '22023';
    end if;

    begin
      v_current_min := (v_rule->>'min')::integer;
      v_current_price := (v_rule->>'price')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Quantidade mínima e preço devem ser numéricos.'
          using errcode = '22023';
    end;

    if v_current_min < 0 or v_current_price <= 0 then
      raise exception 'Quantidade mínima não pode ser negativa e preço deve ser maior que zero.'
        using errcode = '22023';
    end if;

    if v_current_min = v_previous_min then
      raise exception 'Não repita a mesma quantidade mínima em duas faixas.'
        using errcode = '22023';
    end if;

    v_previous_min := v_current_min;
  end loop;

  return new;
end;
$$;

revoke all on function public.validate_pricing_group_record()
  from public, anon, authenticated;

drop trigger if exists trg_validate_pricing_group_record on public.pricing_groups;
create trigger trg_validate_pricing_group_record
before insert or update on public.pricing_groups
for each row execute function public.validate_pricing_group_record();

create or replace function public.validate_category_pricing_group()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_group_store_id uuid;
begin
  if coalesce(new.use_pricing_group_rules, false) and new.pricing_group_id is null then
    raise exception 'Selecione um grupo para usar suas regras de atacado.'
      using errcode = '23514';
  end if;

  if new.pricing_group_id is not null then
    select pg.store_id
      into v_group_store_id
    from public.pricing_groups pg
    where pg.id = new.pricing_group_id;

    if v_group_store_id is null or v_group_store_id <> new.store_id then
      raise exception 'A categoria e o grupo devem pertencer à mesma loja.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_category_pricing_group()
  from public, anon, authenticated;

drop trigger if exists trg_validate_category_pricing_group on public.categories;
create trigger trg_validate_category_pricing_group
before insert or update of store_id, pricing_group_id, use_pricing_group_rules
on public.categories
for each row execute function public.validate_category_pricing_group();

alter table public.pricing_groups enable row level security;

drop policy if exists pricing_groups_select_by_permission on public.pricing_groups;
create policy pricing_groups_select_by_permission
on public.pricing_groups
for select
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'categories.view')
  or public.user_has_store_permission(store_id, 'categories.manage')
  or public.user_has_store_permission(store_id, 'products.view')
  or public.user_has_store_permission(store_id, 'products.manage')
);

drop policy if exists pricing_groups_insert_by_permission on public.pricing_groups;
create policy pricing_groups_insert_by_permission
on public.pricing_groups
for insert
to authenticated
with check (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'categories.manage')
  or public.user_has_store_permission(store_id, 'products.manage')
);

drop policy if exists pricing_groups_update_by_permission on public.pricing_groups;
create policy pricing_groups_update_by_permission
on public.pricing_groups
for update
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'categories.manage')
  or public.user_has_store_permission(store_id, 'products.manage')
)
with check (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'categories.manage')
  or public.user_has_store_permission(store_id, 'products.manage')
);

drop policy if exists pricing_groups_delete_by_permission on public.pricing_groups;
create policy pricing_groups_delete_by_permission
on public.pricing_groups
for delete
to authenticated
using (
  public.app_is_store_owner(store_id)
  or public.user_has_store_permission(store_id, 'categories.manage')
  or public.user_has_store_permission(store_id, 'products.manage')
);

revoke all on table public.pricing_groups from public, anon;
grant select, insert, update, delete on table public.pricing_groups to authenticated;

create or replace function public.save_pricing_group(
  p_store_id uuid,
  p_group_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_price_rules jsonb default '[]'::jsonb,
  p_active boolean default false,
  p_category_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_group_id uuid;
  v_category_ids uuid[] := coalesce(p_category_ids, '{}'::uuid[]);
  v_category_count integer;
  v_blocking_group_names text;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.'
      using errcode = '42501';
  end if;

  if not (
    public.app_is_store_owner(p_store_id)
    or public.user_has_store_permission(p_store_id, 'categories.manage')
    or public.user_has_store_permission(p_store_id, 'products.manage')
  ) then
    raise exception 'Sem permissão para gerenciar grupos de atacado.'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_name, '')), '') is null then
    raise exception 'Informe o nome do grupo.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_category_ids) requested(category_id)
    left join public.categories c
      on c.id = requested.category_id
     and c.store_id = p_store_id
    where c.id is null
  ) then
    raise exception 'Uma ou mais categorias não pertencem à loja.'
      using errcode = '22023';
  end if;

  select count(distinct category_id)
    into v_category_count
  from unnest(v_category_ids) requested(category_id);

  if coalesce(p_active, false) and v_category_count < 2 then
    raise exception 'Um grupo ativo precisa reunir pelo menos duas categorias.'
      using errcode = '22023';
  end if;

  select string_agg(pg.name, ', ' order by pg.name)
    into v_blocking_group_names
  from public.pricing_groups pg
  where pg.store_id = p_store_id
    and pg.active
    and pg.id is distinct from p_group_id
    and exists (
      select 1
      from public.categories selected
      where selected.store_id = p_store_id
        and selected.pricing_group_id = pg.id
        and selected.use_pricing_group_rules
        and selected.id = any(v_category_ids)
    )
    and (
      select count(*)
      from public.categories remaining
      where remaining.store_id = p_store_id
        and remaining.pricing_group_id = pg.id
        and remaining.use_pricing_group_rules
        and not (remaining.id = any(v_category_ids))
    ) < 2;

  if v_blocking_group_names is not null then
    raise exception
      'Desative ou reorganize primeiro os grupos publicados: %.',
      v_blocking_group_names
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_store_id::text || ':pricing-groups', 0));

  if p_group_id is null then
    insert into public.pricing_groups (
      store_id,
      name,
      description,
      price_logic_type,
      price_rules,
      active
    )
    values (
      p_store_id,
      p_name,
      p_description,
      'category_volume',
      p_price_rules,
      coalesce(p_active, false)
    )
    returning id into v_group_id;
  else
    update public.pricing_groups pg
    set
      name = p_name,
      description = p_description,
      price_rules = p_price_rules,
      active = coalesce(p_active, false)
    where pg.id = p_group_id
      and pg.store_id = p_store_id
    returning pg.id into v_group_id;

    if v_group_id is null then
      raise exception 'Grupo de atacado não encontrado.'
        using errcode = 'P0002';
    end if;
  end if;

  update public.categories c
  set
    pricing_group_id = null,
    use_pricing_group_rules = false
  where c.store_id = p_store_id
    and c.pricing_group_id = v_group_id
    and not (c.id = any(v_category_ids));

  update public.categories c
  set
    pricing_group_id = v_group_id,
    use_pricing_group_rules = true
  where c.store_id = p_store_id
    and c.id = any(v_category_ids);

  select jsonb_build_object(
    'ok', true,
    'group', jsonb_build_object(
      'id', pg.id,
      'store_id', pg.store_id,
      'name', pg.name,
      'description', pg.description,
      'price_logic_type', pg.price_logic_type,
      'price_rules', pg.price_rules,
      'active', pg.active,
      'category_ids', coalesce((
        select jsonb_agg(c.id order by c.name)
        from public.categories c
        where c.store_id = p_store_id
          and c.pricing_group_id = pg.id
          and c.use_pricing_group_rules
      ), '[]'::jsonb),
      'created_at', pg.created_at,
      'updated_at', pg.updated_at
    )
  )
  into v_result
  from public.pricing_groups pg
  where pg.id = v_group_id;

  return v_result;
end;
$$;

revoke all on function public.save_pricing_group(
  uuid, uuid, text, text, jsonb, boolean, uuid[]
) from public, anon;
grant execute on function public.save_pricing_group(
  uuid, uuid, text, text, jsonb, boolean, uuid[]
) to authenticated;

create or replace function public.calculate_store_cart_pricing(
  p_store_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_requested_count integer;
begin
  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    return jsonb_build_object('ok', false, 'error', 'empty_cart');
  end if;

  if jsonb_array_length(p_items) > 100 then
    return jsonb_build_object('ok', false, 'error', 'too_many_items');
  end if;

  select count(*)
    into v_requested_count
  from (
    select (entry->>'product_id')::uuid
    from jsonb_array_elements(p_items) entry
    where coalesce((entry->>'quantity')::integer, 0) > 0
    group by (entry->>'product_id')::uuid
  ) requested_products;

  with requested as (
    select
      (entry->>'product_id')::uuid as product_id,
      sum(greatest(coalesce((entry->>'quantity')::integer, 0), 0))::integer as quantity
    from jsonb_array_elements(p_items) entry
    group by (entry->>'product_id')::uuid
  ),
  base as (
    select
      r.product_id,
      r.quantity,
      p.name,
      p.category_id,
      p.price::numeric as base_price,
      coalesce(p.use_category_pricing, false) as use_category_pricing,
      p.price_logic_type as product_price_logic_type,
      coalesce(p.price_rules, '[]'::jsonb) as product_price_rules,
      c.name as category_name,
      c.price_logic_type as category_price_logic_type,
      coalesce(c.price_rules, '[]'::jsonb) as category_price_rules,
      coalesce(c.pricing_strategy, '{}'::jsonb) as category_pricing_strategy,
      c.pricing_group_id,
      coalesce(c.use_pricing_group_rules, false) as use_pricing_group_rules,
      pg.name as pricing_group_name,
      pg.price_logic_type as group_price_logic_type,
      coalesce(pg.price_rules, '[]'::jsonb) as group_price_rules,
      coalesce(pg.active, false) as pricing_group_active
    from requested r
    join public.products p
      on p.id = r.product_id
     and p.store_id = p_store_id
     and p.active = true
     and coalesce(p.discontinued, false) = false
     and coalesce(p.is_discontinued, false) = false
    left join public.categories c
      on c.id = p.category_id
     and c.store_id = p_store_id
     and c.active = true
    left join public.pricing_groups pg
      on pg.id = c.pricing_group_id
     and pg.store_id = p_store_id
    where r.quantity > 0
  ),
  group_totals as (
    select pricing_group_id, sum(quantity)::integer as combined_quantity
    from base
    where use_category_pricing
      and use_pricing_group_rules
      and pricing_group_active
      and pricing_group_id is not null
      and group_price_logic_type = 'category_volume'
    group by pricing_group_id
  ),
  category_totals as (
    select category_id, sum(quantity)::integer as combined_quantity
    from base
    where category_id is not null
      and use_category_pricing
      and not (use_pricing_group_rules and pricing_group_active)
      and category_price_logic_type = 'category_volume'
      and coalesce(category_pricing_strategy->>'volume_scope', 'combined') <> 'per_product'
    group by category_id
  ),
  scoped as (
    select
      b.*,
      case
        when not b.use_category_pricing then b.quantity
        when b.use_pricing_group_rules
         and b.pricing_group_active
         and b.group_price_logic_type = 'category_volume'
          then coalesce(gt.combined_quantity, b.quantity)
        when b.category_price_logic_type = 'category_volume'
         and coalesce(b.category_pricing_strategy->>'volume_scope', 'combined') <> 'per_product'
          then coalesce(ct.combined_quantity, b.quantity)
        else b.quantity
      end as pricing_quantity
    from base b
    left join group_totals gt on gt.pricing_group_id = b.pricing_group_id
    left join category_totals ct on ct.category_id = b.category_id
  ),
  priced as (
    select
      s.*,
      case
        when not s.use_category_pricing
         and s.product_price_logic_type in ('product_volume', 'volume', 'quantity_volume', 'category_volume')
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(s.product_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= s.quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        ), s.base_price)
        when not s.use_category_pricing and s.product_price_logic_type = 'standard'
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(s.product_price_rules) rule
          order by coalesce((rule->>'min')::integer, 0)
          limit 1
        ), s.base_price)
        when s.use_pricing_group_rules
         and s.pricing_group_active
         and s.group_price_logic_type = 'category_volume'
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(s.group_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= s.pricing_quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        ), s.base_price)
        when s.category_price_logic_type = 'category_volume'
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(s.category_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= s.pricing_quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        ), s.base_price)
        when s.category_price_logic_type = 'standard'
        then coalesce((
          select (rule->>'price')::numeric
          from jsonb_array_elements(s.category_price_rules) rule
          order by coalesce((rule->>'min')::integer, 0)
          limit 1
        ), s.base_price)
        else s.base_price
      end::numeric as unit_price,
      case
        when not s.use_category_pricing
         and s.product_price_logic_type in ('product_volume', 'volume', 'quantity_volume', 'category_volume')
          then 'product_volume'
        when not s.use_category_pricing and s.product_price_logic_type = 'standard'
          then 'product_standard'
        when s.use_pricing_group_rules
         and s.pricing_group_active
         and s.group_price_logic_type = 'category_volume'
          then 'pricing_group_combined_volume'
        when s.category_price_logic_type = 'category_volume'
         and coalesce(s.category_pricing_strategy->>'volume_scope', 'combined') = 'per_product'
          then 'category_product_volume'
        when s.category_price_logic_type = 'category_volume'
          then 'category_combined_volume'
        when s.category_price_logic_type = 'standard'
          then 'category_standard'
        else 'product_base_price'
      end as pricing_source
    from scoped s
  ),
  final_items as (
    select
      p.*,
      round(greatest(p.base_price - p.unit_price, 0) * p.quantity, 2) as discount_total,
      round(p.unit_price * p.quantity, 2) as line_total,
      case
        when p.pricing_source = 'pricing_group_combined_volume' then (
          select jsonb_build_object(
            'min', coalesce((rule->>'min')::integer, 0),
            'price', (rule->>'price')::numeric
          )
          from jsonb_array_elements(p.group_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= p.pricing_quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        )
        when p.pricing_source in ('category_combined_volume', 'category_product_volume') then (
          select jsonb_build_object(
            'min', coalesce((rule->>'min')::integer, 0),
            'price', (rule->>'price')::numeric
          )
          from jsonb_array_elements(p.category_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= p.pricing_quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        )
        when p.pricing_source = 'product_volume' then (
          select jsonb_build_object(
            'min', coalesce((rule->>'min')::integer, 0),
            'price', (rule->>'price')::numeric
          )
          from jsonb_array_elements(p.product_price_rules) rule
          where coalesce((rule->>'min')::integer, 0) <= p.quantity
          order by coalesce((rule->>'min')::integer, 0) desc
          limit 1
        )
        else null
      end as applied_tier
    from priced p
  )
  select jsonb_build_object(
    'ok', true,
    'engine_version', 2,
    'items', coalesce(jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'product_name', name,
        'category_id', category_id,
        'category_name', category_name,
        'pricing_group_id', case
          when pricing_source = 'pricing_group_combined_volume' then pricing_group_id
          else null
        end,
        'pricing_group_name', case
          when pricing_source = 'pricing_group_combined_volume' then pricing_group_name
          else null
        end,
        'quantity', quantity,
        'pricing_quantity', pricing_quantity,
        'base_price', base_price,
        'unit_price', unit_price,
        'discount_total', discount_total,
        'line_total', line_total,
        'pricing_source', pricing_source,
        'applied_tier', applied_tier
      ) order by name
    ), '[]'::jsonb),
    'subtotal', coalesce(sum(line_total), 0),
    'base_subtotal', coalesce(sum(base_price * quantity), 0),
    'total_discount', coalesce(sum(discount_total), 0)
  )
  into v_result
  from final_items;

  if jsonb_array_length(coalesce(v_result->'items', '[]'::jsonb)) <> v_requested_count then
    return jsonb_build_object('ok', false, 'error', 'invalid_or_unavailable_product');
  end if;

  return v_result;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'error', 'invalid_request_format');
end;
$$;

revoke all on function public.calculate_store_cart_pricing(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.calculate_store_cart_pricing(uuid, jsonb)
  to service_role;

create or replace function public.get_public_catalog_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_store_id uuid;
  v_catalog_enabled boolean;
  v_categories jsonb;
begin
  select s.id, s.public_catalog_enabled
  into v_store_id, v_catalog_enabled
  from public.stores s
  where s.slug = lower(trim(p_slug))
    and s.public_store_enabled = true
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  if coalesce(v_catalog_enabled, false) = false then
    return jsonb_build_object('ok', true, 'catalog_enabled', false, 'categories', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(category_payload order by category_sort_order, category_name), '[]'::jsonb)
  into v_categories
  from (
    select
      c.sort_order as category_sort_order,
      c.name as category_name,
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'description', c.description,
        'image_url', c.image_url,
        'sort_order', c.sort_order,
        'active', c.active,
        'price_logic_type', coalesce(c.price_logic_type, 'standard'),
        'price_rules', coalesce(c.price_rules, '[]'::jsonb),
        'pricing_strategy', coalesce(c.pricing_strategy, jsonb_build_object('volume_scope', 'combined')),
        'pricing_group_id', case
          when c.use_pricing_group_rules and pg.active then pg.id
          else null
        end,
        'use_pricing_group_rules', coalesce(c.use_pricing_group_rules and pg.active, false),
        'pricing_group', case
          when c.use_pricing_group_rules and pg.active then jsonb_build_object(
            'id', pg.id,
            'name', pg.name,
            'price_logic_type', pg.price_logic_type,
            'price_rules', pg.price_rules,
            'active', pg.active
          )
          else null
        end,
        'loyalty_eligible', coalesce(c.loyalty_eligible, true),
        'loyalty_multiplier', coalesce(c.loyalty_multiplier, 1.0),
        'products', products_payload.products
      ) as category_payload
    from public.categories c
    left join public.pricing_groups pg
      on pg.id = c.pricing_group_id
     and pg.store_id = v_store_id
    cross join lateral (
      select
        coalesce(jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'category_id', p.category_id,
            'name', p.name,
            'description', p.description,
            'price', p.price,
            'active', p.active,
            'images', coalesce(to_jsonb(p.images), '[]'::jsonb),
            'image_url', case when array_length(p.images, 1) > 0 then p.images[1] else null end,
            'sort_order', p.sort_order,
            'use_category_pricing', coalesce(p.use_category_pricing, false),
            'price_logic_type', coalesce(p.price_logic_type, 'standard'),
            'price_rules', coalesce(p.price_rules, '[]'::jsonb),
            'stock_quantity', coalesce(p.stock_quantity, 0),
            'featured', false,
            'sales_count', 0,
            'rating_avg', 5.0,
            'review_count', 0,
            'category_loyalty_eligible', coalesce(c.loyalty_eligible, true),
            'category_loyalty_multiplier', coalesce(c.loyalty_multiplier, 1.0)
          ) order by p.sort_order, p.name
        ), '[]'::jsonb) as products,
        count(*) as products_count
      from public.products p
      where p.store_id = v_store_id
        and p.category_id = c.id
        and p.active = true
        and coalesce(p.discontinued, false) = false
        and coalesce(p.is_discontinued, false) = false
    ) products_payload
    where c.store_id = v_store_id
      and c.active = true
      and products_payload.products_count > 0
  ) q;

  return jsonb_build_object('ok', true, 'catalog_enabled', true, 'categories', v_categories);
end;
$$;

revoke all on function public.get_public_catalog_by_slug(text) from public;
grant execute on function public.get_public_catalog_by_slug(text) to anon, authenticated;

create or replace function public.create_public_order_by_slug_v2(
  p_slug text,
  p_customer_name text,
  p_customer_phone text,
  p_fulfillment_type text,
  p_sales_channel text,
  p_items jsonb,
  p_delivery_address jsonb default '{}'::jsonb,
  p_table_code text default null,
  p_notes text default null,
  p_payment_method_code text default 'pending',
  p_delivery_method_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_pricing jsonb;
  v_store_id uuid;
  v_order_id uuid;
  v_delivery_fee numeric := 0;
  v_item jsonb;
begin
  select id into v_store_id
  from public.stores
  where slug = lower(trim(p_slug))
    and public_store_enabled = true
  limit 1;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  v_pricing := public.calculate_store_cart_pricing(v_store_id, p_items);
  if coalesce((v_pricing->>'ok')::boolean, false) = false then
    return v_pricing;
  end if;

  v_result := public.create_public_order_by_slug(
    p_slug,
    p_customer_name,
    p_customer_phone,
    p_fulfillment_type,
    p_sales_channel,
    p_items,
    p_delivery_address,
    p_table_code,
    p_notes,
    p_payment_method_code,
    p_delivery_method_code
  );

  if coalesce((v_result->>'ok')::boolean, false) = false then
    return v_result;
  end if;

  v_order_id := (v_result->'order'->>'id')::uuid;

  select coalesce(delivery_fee, 0)
  into v_delivery_fee
  from public.orders
  where id = v_order_id;

  for v_item in select value from jsonb_array_elements(v_pricing->'items')
  loop
    update public.order_items
    set
      unit_price = (v_item->>'unit_price')::numeric,
      discount = 0,
      product_snapshot = coalesce(product_snapshot, '{}'::jsonb) || jsonb_build_object(
        'base_price', (v_item->>'base_price')::numeric,
        'applied_unit_price', (v_item->>'unit_price')::numeric,
        'pricing_source', v_item->>'pricing_source',
        'category_id', v_item->>'category_id',
        'category_name', v_item->>'category_name',
        'pricing_group_id', v_item->>'pricing_group_id',
        'pricing_group_name', v_item->>'pricing_group_name'
      ),
      commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object(
        'pricing_source', v_item->>'pricing_source',
        'pricing_quantity', (v_item->>'pricing_quantity')::integer,
        'pricing_group_id', v_item->>'pricing_group_id',
        'pricing_group_name', v_item->>'pricing_group_name',
        'base_price', (v_item->>'base_price')::numeric,
        'unit_price', (v_item->>'unit_price')::numeric,
        'discount_total', (v_item->>'discount_total')::numeric,
        'line_total', (v_item->>'line_total')::numeric,
        'applied_tier', v_item->'applied_tier'
      )
    where order_id = v_order_id
      and product_id = (v_item->>'product_id')::uuid;
  end loop;

  update public.orders
  set
    subtotal = (v_pricing->>'subtotal')::numeric,
    total = (v_pricing->>'subtotal')::numeric + v_delivery_fee,
    commercial_metadata = coalesce(commercial_metadata, '{}'::jsonb) || jsonb_build_object(
      'pricing_engine', 'calculate_store_cart_pricing_v2',
      'base_subtotal', (v_pricing->>'base_subtotal')::numeric,
      'total_discount', (v_pricing->>'total_discount')::numeric,
      'pricing_snapshot', v_pricing
    )
  where id = v_order_id;

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_result, '{order,subtotal}', to_jsonb((v_pricing->>'subtotal')::numeric), true),
      '{order,total}', to_jsonb((v_pricing->>'subtotal')::numeric + v_delivery_fee), true
    ),
    '{pricing}', v_pricing, true
  );
end;
$$;

revoke all on function public.create_public_order_by_slug_v2(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text
) from public;
grant execute on function public.create_public_order_by_slug_v2(
  text, text, text, text, text, jsonb, jsonb, text, text, text, text
) to anon, authenticated;

comment on table public.pricing_groups is
  'Agrupa categorias distintas para compartilhar faixas e quantidade de atacado.';
comment on column public.pricing_groups.active is
  'Somente grupos ativos influenciam preços nos canais de venda.';
comment on column public.categories.use_pricing_group_rules is
  'Quando verdadeiro, produtos que herdam a categoria usam a regra do grupo ativo.';
comment on function public.save_pricing_group(uuid, uuid, text, text, jsonb, boolean, uuid[]) is
  'Salva grupo e vínculos de categorias de forma atômica e autorizada.';
comment on function public.calculate_store_cart_pricing(uuid, jsonb) is
  'Motor autoritativo v2: produto > grupo ativo > categoria > preço-base.';
