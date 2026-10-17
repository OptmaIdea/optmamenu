-- OptmaMenu homologation audit
-- READ ONLY: do not add mutations to this file.
-- Expected result for every query: zero rows.

-- 1) Products referencing a category owned by another store.
select
  p.id as product_id,
  p.name as product_name,
  p.store_id as product_store_id,
  c.store_id as category_store_id,
  c.id as category_id
from public.products p
join public.categories c on c.id = p.category_id
where p.store_id <> c.store_id;

-- 2) Order items whose store differs from the parent order.
select
  oi.id as order_item_id,
  oi.store_id as item_store_id,
  o.store_id as order_store_id,
  oi.order_id
from public.order_items oi
join public.orders o on o.id = oi.order_id
where oi.store_id <> o.store_id;

-- 3) Order items whose product belongs to another store.
select
  oi.id as order_item_id,
  oi.store_id as item_store_id,
  p.store_id as product_store_id,
  oi.product_id,
  oi.order_id
from public.order_items oi
join public.products p on p.id = oi.product_id
where oi.store_id <> p.store_id;

-- 4) Inventory balances whose product or location belongs to another store.
select
  ilb.id as balance_id,
  ilb.store_id as balance_store_id,
  p.store_id as product_store_id,
  sl.store_id as location_store_id,
  ilb.product_id,
  ilb.location_id
from public.inventory_location_balances ilb
join public.products p on p.id = ilb.product_id
join public.stock_locations sl on sl.id = ilb.location_id
where ilb.store_id <> p.store_id
   or ilb.store_id <> sl.store_id;

-- 5) Reservations whose order/product/location do not belong to the same store.
select
  sr.id as reservation_id,
  sr.store_id as reservation_store_id,
  o.store_id as order_store_id,
  p.store_id as product_store_id,
  sl.store_id as location_store_id,
  sr.order_id,
  sr.product_id,
  sr.location_id
from public.stock_reservations sr
join public.orders o on o.id = sr.order_id
join public.products p on p.id = sr.product_id
join public.stock_locations sl on sl.id = sr.location_id
where sr.store_id <> o.store_id
   or sr.store_id <> p.store_id
   or sr.store_id <> sl.store_id;

-- 6) Transfer header with source/destination locations from a different store.
select
  st.id as transfer_id,
  st.transfer_code,
  st.store_id as transfer_store_id,
  src.store_id as source_store_id,
  dst.store_id as destination_store_id,
  st.source_location_id,
  st.destination_location_id
from public.stock_transfers st
join public.stock_locations src on src.id = st.source_location_id
join public.stock_locations dst on dst.id = st.destination_location_id
where st.store_id <> src.store_id
   or st.store_id <> dst.store_id;

-- 7) Transfer items whose store/product differ from the parent transfer.
select
  sti.id as transfer_item_id,
  sti.store_id as item_store_id,
  st.store_id as transfer_store_id,
  p.store_id as product_store_id,
  sti.transfer_id,
  sti.product_id
from public.stock_transfer_items sti
join public.stock_transfers st on st.id = sti.transfer_id
join public.products p on p.id = sti.product_id
where sti.store_id <> st.store_id
   or sti.store_id <> p.store_id;

-- 8) Purchase items whose store/product differ from the parent document.
select
  pdi.id as purchase_item_id,
  pdi.store_id as item_store_id,
  pd.store_id as document_store_id,
  p.store_id as product_store_id,
  pdi.purchase_document_id,
  pdi.product_id
from public.purchase_document_items pdi
join public.purchase_documents pd on pd.id = pdi.purchase_document_id
join public.products p on p.id = pdi.product_id
where pdi.store_id <> pd.store_id
   or pdi.store_id <> p.store_id;

-- 9) Membership user identity duplicated inside the same store.
select
  sm.store_id,
  sm.user_id,
  count(*) as memberships
from public.store_members sm
where sm.status <> 'removed'
group by sm.store_id, sm.user_id
having count(*) > 1;
