-- Block 2 smoke-test checklist for Accounts Payable UI support.
-- Run with an authenticated user in homologation.

select
  has_function_privilege('authenticated', 'public.list_accounts_payable_payment_options_safe(uuid)', 'EXECUTE') as authenticated_execute,
  has_function_privilege('anon', 'public.list_accounts_payable_payment_options_safe(uuid)', 'EXECUTE') as anon_execute;

select permission_key, label
from public.store_permission_catalog
where permission_key in (
  'accounts_payable.view',
  'accounts_payable.manage',
  'accounts_payable.pay',
  'accounts_payable.reverse_payment'
)
order by sort_order;
