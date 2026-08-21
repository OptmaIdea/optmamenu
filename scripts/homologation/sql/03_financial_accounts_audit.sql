-- OptmaMenu homologation audit
-- READ ONLY: do not add mutations to this file.

-- 1) Consolidated cashbook balance versus balances attributed to financial accounts.
with account_flows as (
  select
    sfa.store_id,
    sfa.id,
    sfa.code,
    sfa.name,
    sfa.account_type,
    sfa.active,
    coalesce(sum(case
      when e.status = 'confirmed'
       and e.affects_balance = true
       and e.destination_financial_account_id = sfa.id
      then e.amount else 0 end), 0)
    - coalesce(sum(case
      when e.status = 'confirmed'
       and e.affects_balance = true
       and e.source_financial_account_id = sfa.id
      then e.amount else 0 end), 0) as balance
  from public.store_financial_accounts sfa
  left join public.cashbook_entries e
    on e.store_id = sfa.store_id
   and (e.source_financial_account_id = sfa.id or e.destination_financial_account_id = sfa.id)
  group by sfa.store_id, sfa.id, sfa.code, sfa.name, sfa.account_type, sfa.active
), cashbook_total as (
  select
    store_id,
    sum(case
      when status = 'confirmed' and affects_balance = true and direction = 'in' then amount
      when status = 'confirmed' and affects_balance = true and direction = 'out' then -amount
      else 0 end) as total_balance
  from public.cashbook_entries
  group by store_id
), unallocated as (
  select
    store_id,
    count(*) as entry_count,
    sum(case when direction = 'in' then amount when direction = 'out' then -amount else 0 end) as net_amount
  from public.cashbook_entries
  where status = 'confirmed'
    and affects_balance = true
    and source_financial_account_id is null
    and destination_financial_account_id is null
  group by store_id
)
select
  s.name as store_name,
  t.total_balance,
  coalesce(sum(a.balance), 0) as attributed_balance,
  coalesce(u.net_amount, 0) as unallocated_balance,
  coalesce(u.entry_count, 0) as unallocated_entries,
  t.total_balance - (coalesce(sum(a.balance), 0) + coalesce(u.net_amount, 0)) as unexplained_difference
from cashbook_total t
join public.stores s on s.id = t.store_id
left join account_flows a on a.store_id = t.store_id
left join unallocated u on u.store_id = t.store_id
group by s.name, t.store_id, t.total_balance, u.net_amount, u.entry_count
order by s.name;

-- 2) Balance by financial account.
with account_flows as (
  select
    sfa.store_id,
    sfa.code,
    sfa.name,
    sfa.account_type,
    sfa.active,
    coalesce(sum(case
      when e.status = 'confirmed' and e.affects_balance = true
       and e.destination_financial_account_id = sfa.id then e.amount else 0 end), 0)
    - coalesce(sum(case
      when e.status = 'confirmed' and e.affects_balance = true
       and e.source_financial_account_id = sfa.id then e.amount else 0 end), 0) as balance
  from public.store_financial_accounts sfa
  left join public.cashbook_entries e
    on e.store_id = sfa.store_id
   and (e.source_financial_account_id = sfa.id or e.destination_financial_account_id = sfa.id)
  group by sfa.store_id, sfa.code, sfa.name, sfa.account_type, sfa.active
)
select
  s.name as store_name,
  af.code,
  af.name as account_name,
  af.account_type,
  af.active,
  af.balance
from account_flows af
join public.stores s on s.id = af.store_id
order by s.name, af.account_type, af.name;

-- 3) Confirmed entries still unallocated. No customer PII is returned.
select
  s.name as store_name,
  e.id,
  e.entry_code,
  e.entry_date,
  e.occurred_at,
  e.type,
  e.direction,
  e.amount,
  e.description,
  e.payment_method_code,
  e.source,
  e.status,
  e.order_id,
  e.account_plan_code
from public.cashbook_entries e
join public.stores s on s.id = e.store_id
where e.status = 'confirmed'
  and e.affects_balance = true
  and e.source_financial_account_id is null
  and e.destination_financial_account_id is null
order by s.name, e.occurred_at, e.id;

-- 4) Payment methods with confirmed sale/order entries but no destination account.
select
  s.name as store_name,
  coalesce(e.payment_method_code, '(sem código)') as payment_method_code,
  count(*) as entries,
  sum(case when e.direction = 'in' then e.amount when e.direction = 'out' then -e.amount else 0 end) as net_amount
from public.cashbook_entries e
join public.stores s on s.id = e.store_id
where e.status = 'confirmed'
  and e.affects_balance = true
  and e.destination_financial_account_id is null
  and e.source_financial_account_id is null
group by s.name, e.store_id, coalesce(e.payment_method_code, '(sem código)')
order by s.name, entries desc;
