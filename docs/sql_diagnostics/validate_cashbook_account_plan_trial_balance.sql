-- POS_9 — Validação do balancete gerencial do plano de contas
-- Ajuste o store_id e o período conforme a loja/ambiente.

select public.get_cashbook_account_plan_trial_balance_safe(
  '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
  date_trunc('month', current_date)::date,
  current_date,
  false
) as trial_balance;

-- Visão tabular auxiliar para conferir lançamentos classificados no período.
select
  e.entry_code,
  e.entry_date,
  e.description,
  e.direction,
  e.amount,
  e.account_plan_code,
  p.display_code,
  p.name as account_plan_name,
  p.parent_code,
  p.path
from public.cashbook_entries e
left join public.cashbook_account_plan p on p.code = e.account_plan_code
where e.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and e.account_plan_code is not null
  and e.entry_date >= date_trunc('month', current_date)::date
  and e.entry_date <= current_date
  and coalesce(e.affects_balance, true) = true
  and coalesce(e.status, 'active') not in ('cancelled', 'canceled', 'voided')
order by e.entry_date desc, e.created_at desc;
