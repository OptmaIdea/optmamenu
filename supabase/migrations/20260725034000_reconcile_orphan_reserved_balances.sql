-- Reconcilia o saldo reservado agregado com reservas realmente válidas.
-- Remove resíduos legados de reservas expiradas, canceladas, consumidas
-- ou vinculadas a pedidos já finalizados.

with valid_reservations as (
  select
    sr.store_id,
    sr.location_id,
    sr.product_id,
    sum(sr.quantity)::numeric as reserved_quantity
  from public.stock_reservations sr
  left join public.orders o
    on o.id = sr.order_id
   and o.store_id = sr.store_id
  where sr.status = 'active'
    and sr.cancelled_at is null
    and sr.consumed_at is null
    and (sr.expires_at is null or sr.expires_at > now())
    and (
      o.id is null
      or o.status::text not in ('completed', 'cancelled', 'rejected', 'expired')
    )
  group by sr.store_id, sr.location_id, sr.product_id
), reconciled_locations as (
  update public.inventory_location_balances ilb
  set
    reserved = coalesce(vr.reserved_quantity, 0),
    updated_at = now()
  from (
    select
      current_ilb.store_id,
      current_ilb.location_id,
      current_ilb.product_id,
      vr.reserved_quantity
    from public.inventory_location_balances current_ilb
    left join valid_reservations vr
      on vr.store_id = current_ilb.store_id
     and vr.location_id = current_ilb.location_id
     and vr.product_id = current_ilb.product_id
  ) vr
  where ilb.store_id = vr.store_id
    and ilb.location_id = vr.location_id
    and ilb.product_id = vr.product_id
    and ilb.reserved is distinct from coalesce(vr.reserved_quantity, 0)
  returning ilb.store_id, ilb.product_id
), valid_store_totals as (
  select
    store_id,
    product_id,
    sum(reserved_quantity)::numeric as reserved_quantity
  from valid_reservations
  group by store_id, product_id
)
update public.inventory_balances ib
set
  reserved = coalesce(vst.reserved_quantity, 0),
  updated_at = now()
from (
  select
    current_ib.store_id,
    current_ib.product_id,
    vst.reserved_quantity
  from public.inventory_balances current_ib
  left join valid_store_totals vst
    on vst.store_id = current_ib.store_id
   and vst.product_id = current_ib.product_id
) vst
where ib.store_id = vst.store_id
  and ib.product_id = vst.product_id
  and ib.reserved is distinct from coalesce(vst.reserved_quantity, 0);
