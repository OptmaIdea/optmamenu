-- POS_9 — Validação: contas soltas no plano de contas
-- Execute após aplicar:
-- supabase/migrations/20260713143000_cashbook_account_plan_wrap_loose_accounts.sql

select
  'active_roots' as section,
  code,
  display_code,
  name,
  kind,
  is_group,
  is_postable,
  parent_code,
  path,
  sort_order
from public.cashbook_account_plan
where active = true
  and parent_code is null
order by sort_order, display_code nulls last, name;

select
  'loose_postable_accounts' as section,
  code,
  display_code,
  name,
  kind,
  is_group,
  is_postable,
  parent_code,
  path,
  sort_order
from public.cashbook_account_plan
where active = true
  and is_group = false
  and is_postable = true
  and parent_code is null
order by sort_order, display_code nulls last, name;

select
  'special_cashbook_future_accounts' as section,
  code,
  display_code,
  parent_code,
  name,
  kind,
  nature,
  affects_financial_result,
  is_transfer,
  metadata
from public.cashbook_account_plan
where code in (
  'loan_received',
  'loan_principal_payment',
  'loan_interest_expense',
  'owner_withdrawal',
  'owner_contribution',
  'closing_replenishment',
  'change_float_reinforcement'
)
order by display_code;

select
  'transfer_accounts' as section,
  code,
  display_code,
  parent_code,
  name,
  kind,
  nature,
  affects_financial_result,
  is_transfer,
  path
from public.cashbook_account_plan
where active = true
  and kind = 'transfer'
order by sort_order, display_code nulls last, name;
