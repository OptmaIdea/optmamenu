-- OptmaMenu homologation audit
-- READ ONLY: do not add mutations to this file.

-- 1) SECURITY DEFINER functions and effective execute grants.
select
  n.nspname as schema_name,
  p.oid::regprocedure::text as function_signature,
  p.prosecdef as security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute,
  coalesce(array_to_string(p.proconfig, ', '), '') as function_config
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef = true
order by anon_can_execute desc, authenticated_can_execute desc, function_signature;

-- 2) RLS-enabled tables without policies.
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  count(pol.polname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy pol on pol.polrelid = c.oid
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = true
group by c.relname, c.relrowsecurity
having count(pol.polname) = 0
order by c.relname;

-- 3) Policies and roles for sensitive operational tables.
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'stores',
    'store_members',
    'customers',
    'customer_credentials',
    'customer_sessions',
    'customer_otps',
    'orders',
    'order_items',
    'stock_reservations',
    'inventory_location_balances',
    'cashbook_entries',
    'store_financial_accounts'
  )
order by tablename, cmd, policyname;
