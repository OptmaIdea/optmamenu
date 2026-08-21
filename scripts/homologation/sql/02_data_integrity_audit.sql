-- OptmaMenu homologation audit
-- READ ONLY: do not add mutations to this file.

-- 1) Duplicate public slugs (expected: zero rows).
select lower(trim(slug)) as slug_key, count(*) as occurrences
from public.stores
where nullif(trim(slug), '') is not null
group by lower(trim(slug))
having count(*) > 1
order by occurrences desc, slug_key;

-- 2) Materialized reservation mismatches (expected: zero rows).
with active_reservations as (
  select
    store_id,
    location_id,
    product_id,
    sum(quantity)::numeric as expected_reserved
  from public.stock_reservations
  where status = 'active'
    and cancelled_at is null
    and consumed_at is null
    and expires_at > now()
  group by store_id, location_id, product_id
)
select
  s.name as store_name,
  sl.name as location_name,
  p.name as product_name,
  ilb.reserved as recorded_reserved,
  coalesce(ar.expected_reserved, 0) as expected_reserved,
  ilb.reserved - coalesce(ar.expected_reserved, 0) as difference
from public.inventory_location_balances ilb
join public.stores s on s.id = ilb.store_id
join public.stock_locations sl on sl.id = ilb.location_id
join public.products p on p.id = ilb.product_id
left join active_reservations ar
  on ar.store_id = ilb.store_id
 and ar.location_id = ilb.location_id
 and ar.product_id = ilb.product_id
where coalesce(ilb.reserved, 0) <> coalesce(ar.expected_reserved, 0)
order by s.name, sl.name, p.name;

-- 3) Duplicate member e-mails within a store (expected: zero rows).
select
  s.name as store_name,
  lower(trim(sm.member_email)) as normalized_email,
  count(*) as occurrences
from public.store_members sm
join public.stores s on s.id = sm.store_id
where nullif(trim(sm.member_email), '') is not null
  and sm.status <> 'removed'
group by s.name, sm.store_id, lower(trim(sm.member_email))
having count(*) > 1
order by occurrences desc, s.name;

-- 4) Duplicate member phone identities within a store.
-- This query intentionally returns only store/count, not the phone value.
with normalized as (
  select
    sm.store_id,
    regexp_replace(
      coalesce(sm.member_mobile_phone, sm.member_phone, sm.member_whatsapp_phone, ''),
      '\D', '', 'g'
    ) as phone_key
  from public.store_members sm
  where sm.status <> 'removed'
), duplicates as (
  select store_id, phone_key, count(*) as occurrences
  from normalized
  where nullif(phone_key, '') is not null
  group by store_id, phone_key
  having count(*) > 1
)
select
  s.name as store_name,
  count(*) as duplicated_phone_keys,
  sum(d.occurrences) as memberships_involved
from duplicates d
join public.stores s on s.id = d.store_id
group by s.name, d.store_id
order by duplicated_phone_keys desc, s.name;

-- 5) Active reservations already expired (expected: zero rows).
select
  s.name as store_name,
  count(*) as expired_active_reservations,
  sum(sr.quantity) as quantity_still_reserved
from public.stock_reservations sr
join public.stores s on s.id = sr.store_id
where sr.status = 'active'
  and sr.cancelled_at is null
  and sr.consumed_at is null
  and sr.expires_at <= now()
group by s.name, sr.store_id
order by expired_active_reservations desc;
