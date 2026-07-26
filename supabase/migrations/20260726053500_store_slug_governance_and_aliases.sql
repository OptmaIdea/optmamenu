create table if not exists public.reserved_store_slugs (
  slug text primary key,
  reason text not null default 'platform_reserved',
  created_at timestamptz not null default now(),
  constraint reserved_store_slugs_format_check check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$'
  )
);

insert into public.reserved_store_slugs (slug, reason)
values
  ('www','platform'),('app','platform'),('admin','platform'),('api','platform'),('auth','platform'),
  ('login','platform'),('account','platform'),('accounts','platform'),('billing','platform'),
  ('status','platform'),('support','platform'),('help','platform'),('docs','platform'),
  ('mail','platform'),('email','platform'),('smtp','platform'),('imap','platform'),('pop','platform'),
  ('ftp','platform'),('cdn','platform'),('assets','platform'),('static','platform'),('media','platform'),
  ('images','platform'),('files','platform'),('storage','platform'),('staging','platform'),
  ('dev','platform'),('test','platform'),('preview','platform'),('beta','platform'),('internal','platform'),
  ('dashboard','platform'),('optmamenu','platform'),('optmaidea','platform'),('menu','platform')
on conflict (slug) do nothing;

create table if not exists public.store_slug_history (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  slug text not null,
  replaced_by_slug text,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_redirect_active boolean not null default true,
  changed_by uuid,
  change_reason text not null default 'store_slug_changed',
  created_at timestamptz not null default now(),
  constraint store_slug_history_slug_format_check check (
    slug = lower(slug)
    and slug ~ '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$'
  )
);

create unique index if not exists store_slug_history_slug_lower_uniq
  on public.store_slug_history (lower(slug));
create index if not exists store_slug_history_store_id_idx
  on public.store_slug_history (store_id, created_at desc);

alter table public.reserved_store_slugs enable row level security;
alter table public.store_slug_history enable row level security;

revoke all on public.reserved_store_slugs from anon, authenticated;
revoke all on public.store_slug_history from anon, authenticated;

drop policy if exists "Store members view slug history" on public.store_slug_history;
create policy "Store members view slug history"
  on public.store_slug_history for select to authenticated
  using (public.is_store_member(store_id));

grant select on public.store_slug_history to authenticated;

create or replace function public.validate_store_slug(p_store_id uuid, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_slug text;
begin
  v_slug := lower(trim(coalesce(p_slug, '')));

  if p_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'missing_store_id');
  end if;

  if length(v_slug) < 3 then
    return jsonb_build_object('ok', false, 'error', 'slug_too_short', 'message', 'O endereço público precisa ter pelo menos 3 caracteres.');
  end if;

  if length(v_slug) > 60 then
    return jsonb_build_object('ok', false, 'error', 'slug_too_long', 'message', 'O endereço público deve ter no máximo 60 caracteres.');
  end if;

  if v_slug !~ '^[a-z0-9]+([a-z0-9-]*[a-z0-9])?$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_slug_format', 'message', 'Use apenas letras minúsculas, números e hífen, sem espaços ou hífen no início/fim.');
  end if;

  if exists (select 1 from public.reserved_store_slugs r where r.slug = v_slug) then
    return jsonb_build_object('ok', false, 'error', 'slug_reserved', 'message', 'Este endereço é reservado pela plataforma. Escolha outro.');
  end if;

  if exists (
    select 1 from public.stores s
    where lower(s.slug) = v_slug and s.id <> p_store_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'slug_already_taken', 'message', 'Este endereço público já está em uso.');
  end if;

  if exists (
    select 1 from public.store_slug_history h
    where lower(h.slug) = v_slug and h.store_id <> p_store_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'slug_previously_used', 'message', 'Este endereço já foi utilizado por outra loja e permanece protegido.');
  end if;

  return jsonb_build_object('ok', true, 'slug', v_slug);
end;
$function$;

create or replace function public.capture_store_slug_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if lower(trim(old.slug)) is distinct from lower(trim(new.slug)) then
    insert into public.store_slug_history (
      store_id, slug, replaced_by_slug, valid_from, valid_until,
      is_redirect_active, changed_by, change_reason
    ) values (
      old.id, lower(trim(old.slug)), lower(trim(new.slug)),
      coalesce(old.created_at, now()), now(), true, auth.uid(), 'store_slug_changed'
    )
    on conflict (lower(slug)) do update
      set replaced_by_slug = excluded.replaced_by_slug,
          valid_until = excluded.valid_until,
          is_redirect_active = true,
          changed_by = excluded.changed_by;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_capture_store_slug_change on public.stores;
create trigger trg_capture_store_slug_change
before update of slug on public.stores
for each row execute function public.capture_store_slug_change();

create or replace function public.resolve_public_store_id_by_slug(p_slug text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select s.id
  from public.stores s
  where s.public_store_enabled = true
    and (
      lower(trim(s.slug)) = lower(trim(p_slug))
      or exists (
        select 1
        from public.store_slug_history h
        where h.store_id = s.id
          and h.is_redirect_active = true
          and lower(h.slug) = lower(trim(p_slug))
      )
    )
  order by case when lower(trim(s.slug)) = lower(trim(p_slug)) then 0 else 1 end
  limit 1;
$function$;

revoke all on function public.resolve_public_store_id_by_slug(text) from public;
grant execute on function public.resolve_public_store_id_by_slug(text) to anon, authenticated;

create or replace function public.get_store_by_slug(p_slug text)
returns table(id uuid, slug text, name text, description text, logo_url text, phone_number text, theme_config jsonb, address jsonb, contacts jsonb, config jsonb)
language sql
stable security definer
set search_path to 'public', 'pg_temp'
as $function$
  select s.id, s.slug, s.name, s.description, s.logo_url, s.phone_number,
         s.theme_config, s.address, s.contacts, s.config
  from public.stores s
  where s.id = public.resolve_public_store_id_by_slug(p_slug)
  limit 1;
$function$;

-- The storefront and catalog functions resolve current slugs and protected aliases.
-- Their response shape remains compatible with the existing frontend.
create or replace function public.get_public_storefront_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_store record;
  v_hours jsonb;
  v_messages jsonb;
  v_whatsapp_digits text;
  v_resolved_store_id uuid;
begin
  v_resolved_store_id := public.resolve_public_store_id_by_slug(p_slug);

  select s.id, s.slug, s.name, s.description, s.logo_url, s.phone_number,
         s.theme_config, s.config, s.minimum_order_value, s.reservation_time_minutes,
         s.privacy_policy_text, s.terms_of_use_text, s.cookie_policy_text,
         s.public_store_enabled, s.public_catalog_enabled, s.contacts
  into v_store
  from public.stores s
  where s.id = v_resolved_store_id
  limit 1;

  if v_store.id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  v_whatsapp_digits := regexp_replace(
    coalesce(v_store.contacts->>'whatsapp_business', v_store.contacts->>'whatsapp', v_store.phone_number, ''),
    '\D', '', 'g'
  );

  select coalesce(jsonb_agg(jsonb_build_object(
    'day_of_week', sh.day_of_week,
    'open_time', sh.open_time,
    'close_time', sh.close_time,
    'is_closed', sh.is_closed
  ) order by sh.day_of_week), '[]'::jsonb)
  into v_hours
  from public.store_hours sh
  where sh.store_id = v_store.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'title', sm.title,
    'message', sm.message,
    'expires_at', sm.expires_at
  ) order by sm.created_at desc), '[]'::jsonb)
  into v_messages
  from public.store_messages sm
  where sm.store_id = v_store.id
    and (sm.expires_at is null or sm.expires_at > now());

  return jsonb_build_object('ok', true, 'store', jsonb_build_object(
    'id', v_store.id,
    'slug', v_store.slug,
    'requested_slug', lower(trim(p_slug)),
    'is_slug_alias', lower(trim(p_slug)) <> lower(v_store.slug),
    'name', v_store.name,
    'description', v_store.description,
    'logo_url', v_store.logo_url,
    'phone_number', v_store.phone_number,
    'theme_config', coalesce(v_store.theme_config, '{}'::jsonb),
    'visual_config', coalesce(v_store.config, '{}'::jsonb),
    'minimum_order_value', v_store.minimum_order_value,
    'reservation_time_minutes', v_store.reservation_time_minutes,
    'public_catalog_enabled', v_store.public_catalog_enabled,
    'privacy_policy_text', v_store.privacy_policy_text,
    'terms_of_use_text', v_store.terms_of_use_text,
    'cookie_policy_text', v_store.cookie_policy_text,
    'whatsapp', jsonb_build_object(
      'raw', coalesce(v_store.contacts->>'whatsapp_business', v_store.contacts->>'whatsapp', v_store.phone_number, ''),
      'digits', v_whatsapp_digits,
      'enabled', length(v_whatsapp_digits) >= 10
    ),
    'hours', v_hours,
    'messages', v_messages
  ));
end;
$function$;

create or replace function public.get_public_catalog_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_store_id uuid;
  v_catalog_enabled boolean;
  v_categories jsonb;
begin
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);
  select s.public_catalog_enabled into v_catalog_enabled
  from public.stores s where s.id = v_store_id;

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled');
  end if;

  if coalesce(v_catalog_enabled, false) = false then
    return jsonb_build_object('ok', true, 'catalog_enabled', false, 'categories', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(category_payload order by category_sort_order, category_name), '[]'::jsonb)
  into v_categories
  from (
    select c.sort_order as category_sort_order, c.name as category_name,
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
        'pricing_group_id', case when c.use_pricing_group_rules and pg.active then pg.id else null end,
        'use_pricing_group_rules', coalesce(c.use_pricing_group_rules and pg.active, false),
        'pricing_group', case when c.use_pricing_group_rules and pg.active then jsonb_build_object(
          'id', pg.id,
          'name', pg.name,
          'price_logic_type', pg.price_logic_type,
          'price_rules', pg.price_rules,
          'active', pg.active
        ) else null end,
        'loyalty_eligible', coalesce(c.loyalty_eligible, true),
        'loyalty_multiplier', coalesce(c.loyalty_multiplier, 1.0),
        'products', products_payload.products
      ) as category_payload
    from public.categories c
    left join public.pricing_groups pg
      on pg.id = c.pricing_group_id and pg.store_id = v_store_id
    cross join lateral (
      select coalesce(jsonb_agg(jsonb_build_object(
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
      ) order by p.sort_order, p.name), '[]'::jsonb) as products,
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
$function$;