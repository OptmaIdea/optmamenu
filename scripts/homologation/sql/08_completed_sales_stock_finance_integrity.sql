-- Homologação OptmaMenu — Vendas realizadas → estoque → financeiro
-- Somente leitura. Use para o checklist funcional final da vertical de vendas.

with completed as (
  select o.id, o.store_id, o.order_code, o.total, o.completed_at
  from public.orders o
  where o.status = 'completed'
), checks as (
  select c.*,
    (select count(*) from public.order_items oi where oi.order_id = c.id and oi.store_id = c.store_id) as item_count,
    (select count(*) from public.stock_movements sm where sm.order_id = c.id and sm.store_id = c.store_id and sm.affects_physical = true) as stock_count,
    (select count(*) from public.cashbook_entries ce where ce.order_id = c.id and ce.store_id = c.store_id and ce.status = 'confirmed' and ce.affects_balance = true) as finance_count,
    (select coalesce(sum(case when ce.direction = 'in' then ce.amount when ce.direction = 'out' then -ce.amount else 0 end), 0)
       from public.cashbook_entries ce
      where ce.order_id = c.id
        and ce.store_id = c.store_id
        and ce.status = 'confirmed'
        and ce.affects_balance = true
        and coalesce(ce.is_transfer, false) = false) as finance_net
  from completed c
)
select s.name as store_name,
       count(*) as completed_sales,
       count(*) filter (where item_count = 0) as without_items,
       count(*) filter (where stock_count = 0) as without_stock,
       count(*) filter (where finance_count = 0) as without_finance,
       count(*) filter (where finance_count > 0 and abs(finance_net - total) > 0.009) as finance_value_mismatch
from checks c
join public.stores s on s.id = c.store_id
group by s.id, s.name
order by completed_sales desc;

-- Detalhe das exceções para investigação, sem alterar histórico.
with completed as (
  select o.id, o.store_id, o.order_code, o.total, o.completed_at, o.sales_channel, o.payment_method_code, o.payment_status
  from public.orders o
  where o.status = 'completed'
), checks as (
  select c.*,
    (select count(*) from public.order_items oi where oi.order_id = c.id and oi.store_id = c.store_id) as item_count,
    (select count(*) from public.stock_movements sm where sm.order_id = c.id and sm.store_id = c.store_id and sm.affects_physical = true) as stock_count,
    (select count(*) from public.cashbook_entries ce where ce.order_id = c.id and ce.store_id = c.store_id and ce.status = 'confirmed' and ce.affects_balance = true) as finance_count,
    (select coalesce(sum(case when ce.direction = 'in' then ce.amount when ce.direction = 'out' then -ce.amount else 0 end), 0)
       from public.cashbook_entries ce
      where ce.order_id = c.id
        and ce.store_id = c.store_id
        and ce.status = 'confirmed'
        and ce.affects_balance = true
        and coalesce(ce.is_transfer, false) = false) as finance_net
  from completed c
)
select s.name as store_name,
       c.order_code,
       c.completed_at,
       c.sales_channel,
       c.payment_method_code,
       c.payment_status,
       c.total,
       c.item_count,
       c.stock_count,
       c.finance_count,
       c.finance_net
from checks c
join public.stores s on s.id = c.store_id
where c.item_count = 0
   or c.stock_count = 0
   or c.finance_count = 0
   or (c.finance_count > 0 and abs(c.finance_net - c.total) > 0.009)
order by c.completed_at nulls first, c.order_code;

-- A RPC de detalhe é administrativa e não pode ser executada por anon.
select
  has_function_privilege('anon', 'public.get_sale_detail_safe(uuid,uuid)', 'EXECUTE') as sale_detail_anon,
  has_function_privilege('authenticated', 'public.get_sale_detail_safe(uuid,uuid)', 'EXECUTE') as sale_detail_authenticated;
