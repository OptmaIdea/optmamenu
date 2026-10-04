-- Customer storefront refinements:
-- 1) revoked trusted devices lose user-facing nickname metadata;
-- 2) customer product ratings are star-only and allowed only after a completed purchase;
-- 3) public storefront receives aggregate sales/rating rankings without exposing customer data.

begin;

create table if not exists public.customer_product_ratings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (customer_id, product_id)
);

create index if not exists customer_product_ratings_store_product_idx
  on public.customer_product_ratings(store_id, product_id);

alter table public.customer_product_ratings enable row level security;

drop policy if exists customer_product_ratings_no_direct_access
  on public.customer_product_ratings;
create policy customer_product_ratings_no_direct_access
  on public.customer_product_ratings
  as restrictive
  for all
  to public
  using (false)
  with check (false);

revoke all on table public.customer_product_ratings from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_product_ratings to service_role;

create or replace function public.get_customer_self_product_ratings_safe()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_ratings jsonb;
begin
  if v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', r.product_id,
        'rating', r.rating,
        'updated_at', r.updated_at
      )
      order by r.updated_at desc
    ),
    '[]'::jsonb
  )
  into v_ratings
  from public.customer_product_ratings r
  where r.customer_id = v_customer_id
    and r.store_id = v_store_id;

  return jsonb_build_object('ok', true, 'ratings', v_ratings);
end;
$function$;

revoke all on function public.get_customer_self_product_ratings_safe()
  from public, anon;
grant execute on function public.get_customer_self_product_ratings_safe()
  to authenticated;

create or replace function public.upsert_customer_self_product_rating_safe(
  p_product_id uuid,
  p_rating integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_customer_id uuid := public.app_current_customer_id();
  v_store_id uuid := public.app_current_store_id();
  v_now timestamptz := clock_timestamp();
begin
  if v_customer_id is null or v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'access_denied');
  end if;

  if p_product_id is null or p_rating is null or p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'error', 'invalid_rating');
  end if;

  if not exists (
    select 1
    from public.products p
    where p.id = p_product_id
      and p.store_id = v_store_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'product_not_found');
  end if;

  if not exists (
    select 1
    from public.orders o
    join public.order_items oi
      on oi.order_id = o.id
     and oi.store_id = o.store_id
    where o.customer_id = v_customer_id
      and o.store_id = v_store_id
      and o.status::text = 'completed'
      and coalesce(o.payment_status, '') <> 'refunded'
      and oi.product_id = p_product_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'purchase_required');
  end if;

  insert into public.customer_product_ratings(
    store_id,
    customer_id,
    product_id,
    rating,
    created_at,
    updated_at
  )
  values (
    v_store_id,
    v_customer_id,
    p_product_id,
    p_rating,
    v_now,
    v_now
  )
  on conflict (customer_id, product_id) do update
  set rating = excluded.rating,
      store_id = excluded.store_id,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'product_id', p_product_id,
    'rating', p_rating,
    'updated_at', v_now
  );
end;
$function$;

revoke all on function public.upsert_customer_self_product_rating_safe(uuid, integer)
  from public, anon;
grant execute on function public.upsert_customer_self_product_rating_safe(uuid, integer)
  to authenticated;

create or replace function public.get_public_product_rankings_by_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_store_id uuid;
  v_rankings jsonb;
begin
  v_store_id := public.resolve_public_store_id_by_slug(p_slug);

  if v_store_id is null then
    return jsonb_build_object('ok', false, 'error', 'store_not_found_or_disabled', 'rankings', '[]'::jsonb);
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', p.id,
        'category_id', p.category_id,
        'sales_count', coalesce(sales.units_sold, 0),
        'rating_avg', ratings.rating_avg,
        'rating_count', coalesce(ratings.rating_count, 0)
      )
      order by coalesce(sales.units_sold, 0) desc,
               coalesce(ratings.rating_avg, 0) desc,
               coalesce(ratings.rating_count, 0) desc,
               p.sort_order,
               p.name
    ),
    '[]'::jsonb
  )
  into v_rankings
  from public.products p
  left join lateral (
    select coalesce(sum(oi.quantity), 0)::bigint as units_sold
    from public.order_items oi
    join public.orders o
      on o.id = oi.order_id
     and o.store_id = oi.store_id
    where oi.product_id = p.id
      and oi.store_id = v_store_id
      and o.status::text = 'completed'
      and coalesce(o.payment_status, '') <> 'refunded'
  ) sales on true
  left join lateral (
    select
      round(avg(r.rating)::numeric, 2) as rating_avg,
      count(*)::bigint as rating_count
    from public.customer_product_ratings r
    where r.store_id = v_store_id
      and r.product_id = p.id
  ) ratings on true
  where p.store_id = v_store_id
    and p.active = true
    and coalesce(p.discontinued, false) = false
    and coalesce(p.is_discontinued, false) = false;

  return jsonb_build_object('ok', true, 'rankings', v_rankings);
end;
$function$;

revoke all on function public.get_public_product_rankings_by_slug(text)
  from public;
grant execute on function public.get_public_product_rankings_by_slug(text)
  to anon, authenticated;

create or replace function public.customer_revoke_trusted_device_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_current_device_hash text,
  p_target_device_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_current_device_id uuid;
  v_target_label text;
  v_now timestamptz := clock_timestamp();
  v_revoked_sessions integer := 0;
begin
  select td.id
    into v_current_device_id
  from public.customer_auth_trusted_devices td
  where td.customer_id = p_customer_id
    and td.store_id = p_store_id
    and td.device_token_hash = p_current_device_hash
    and td.revoked_at is null
  limit 1;

  if v_current_device_id is null then
    return jsonb_build_object('ok', false, 'error', 'reauth_required');
  end if;

  if p_target_device_id = v_current_device_id then
    return jsonb_build_object('ok', false, 'error', 'cannot_revoke_current_device');
  end if;

  select coalesce(nullif(btrim(td.device_label), ''), 'Dispositivo confiável')
    into v_target_label
  from public.customer_auth_trusted_devices td
  where td.id = p_target_device_id
    and td.customer_id = p_customer_id
    and td.store_id = p_store_id
    and td.revoked_at is null
  limit 1;

  if v_target_label is null then
    return jsonb_build_object('ok', false, 'error', 'device_not_found');
  end if;

  update public.customer_auth_trusted_devices
     set revoked_at = v_now,
         device_label = null,
         user_agent = null,
         updated_at = v_now
   where id = p_target_device_id
     and customer_id = p_customer_id
     and store_id = p_store_id
     and revoked_at is null;

  update public.customer_auth_session_devices
     set revoked_at = coalesce(revoked_at, v_now),
         last_seen_at = v_now
   where trusted_device_id = p_target_device_id
     and customer_id = p_customer_id
     and store_id = p_store_id
     and revoked_at is null;

  get diagnostics v_revoked_sessions = row_count;

  insert into public.customer_notifications(
    customer_id, store_id, title, message, type, read, created_at
  ) values (
    p_customer_id,
    p_store_id,
    'Dispositivo desconectado',
    v_target_label || ' foi desconectado da sua conta.',
    'info',
    true,
    v_now
  );

  return jsonb_build_object(
    'ok', true,
    'device_id', p_target_device_id,
    'label', v_target_label,
    'revoked_sessions', v_revoked_sessions
  );
end;
$function$;

revoke all on function public.customer_revoke_trusted_device_service_safe(uuid,uuid,text,uuid)
  from public, anon, authenticated;
grant execute on function public.customer_revoke_trusted_device_service_safe(uuid,uuid,text,uuid)
  to service_role;

create or replace function public.customer_revoke_other_trusted_devices_service_safe(
  p_customer_id uuid,
  p_store_id uuid,
  p_current_device_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_revoked integer := 0;
begin
  if p_customer_id is null
     or p_store_id is null
     or length(coalesce(p_current_device_hash, '')) <> 64 then
    return jsonb_build_object('ok', false, 'error', 'invalid_request');
  end if;

  if not exists (
    select 1
    from public.customer_auth_trusted_devices td
    where td.customer_id = p_customer_id
      and td.store_id = p_store_id
      and td.device_token_hash = p_current_device_hash
      and td.revoked_at is null
  ) then
    return jsonb_build_object('ok', false, 'error', 'reauth_required');
  end if;

  update public.customer_auth_session_devices csd
     set revoked_at = coalesce(csd.revoked_at, v_now),
         last_seen_at = v_now
   where csd.customer_id = p_customer_id
     and csd.store_id = p_store_id
     and csd.revoked_at is null
     and exists (
       select 1
       from public.customer_auth_trusted_devices td
       where td.id = csd.trusted_device_id
         and td.customer_id = p_customer_id
         and td.store_id = p_store_id
         and td.device_token_hash <> p_current_device_hash
         and td.revoked_at is null
     );

  update public.customer_auth_trusted_devices
     set revoked_at = v_now,
         device_label = null,
         user_agent = null,
         updated_at = v_now
   where customer_id = p_customer_id
     and store_id = p_store_id
     and device_token_hash <> p_current_device_hash
     and revoked_at is null;

  get diagnostics v_revoked = row_count;

  update public.customer_auth_identities
     set sessions_valid_after = v_now,
         updated_at = v_now
   where customer_id = p_customer_id
     and store_id = p_store_id
     and revoked_at is null;

  if v_revoked > 0 then
    insert into public.customer_notifications(
      customer_id, store_id, title, message, type, read, created_at
    ) values (
      p_customer_id,
      p_store_id,
      'Outros dispositivos desconectados',
      case
        when v_revoked = 1 then 'Um outro dispositivo confiável foi desconectado da sua conta.'
        else v_revoked::text || ' outros dispositivos confiáveis foram desconectados da sua conta.'
      end,
      'info',
      true,
      v_now
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'revoked_count', v_revoked,
    'sessions_valid_after', v_now
  );
end;
$function$;

revoke all on function public.customer_revoke_other_trusted_devices_service_safe(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function public.customer_revoke_other_trusted_devices_service_safe(uuid,uuid,text)
  to service_role;

commit;
