-- Homologação financeira — Saldos por conta.
-- Read-only: valida reconciliação, isolamento por loja e grants das RPCs.

-- 1) Todas as lojas devem reconciliar saldo do livro = distribuído + não distribuído.
with stores_with_cashbook as (
  select distinct store_id
  from public.cashbook_entries
  where status = 'confirmed' and affects_balance = true
), balances as (
  select store_id, public.get_financial_account_balances_safe(store_id) as result
  from stores_with_cashbook
)
select
  store_id,
  (result->'summary'->>'book_balance')::numeric as book_balance,
  (result->'summary'->>'allocated_balance')::numeric as allocated_balance,
  (result->'summary'->>'unallocated_balance')::numeric as unallocated_balance,
  (result->'summary'->>'book_balance')::numeric =
    (result->'summary'->>'allocated_balance')::numeric +
    (result->'summary'->>'unallocated_balance')::numeric as reconciles
from balances
order by store_id;

-- 2) Nenhum lançamento pode apontar para conta de outra loja.
select count(*) as cross_store_account_links
from public.cashbook_entries e
left join public.store_financial_accounts s on s.id = e.source_financial_account_id
left join public.store_financial_accounts d on d.id = e.destination_financial_account_id
where (s.id is not null and s.store_id <> e.store_id)
   or (d.id is not null and d.store_id <> e.store_id);

-- 3) RPCs novas: nunca para anon; authenticated somente com autorização interna da função.
select
  has_function_privilege('anon', 'public.get_financial_account_balances_safe(uuid)', 'EXECUTE') as balances_anon,
  has_function_privilege('authenticated', 'public.get_financial_account_balances_safe(uuid)', 'EXECUTE') as balances_authenticated,
  has_function_privilege('anon', 'public.list_unallocated_cashbook_entries_safe(uuid,integer,integer)', 'EXECUTE') as unallocated_anon,
  has_function_privilege('authenticated', 'public.list_unallocated_cashbook_entries_safe(uuid,integer,integer)', 'EXECUTE') as unallocated_authenticated,
  has_function_privilege('anon', 'public.classify_cashbook_entry_financial_account_safe(uuid,uuid,uuid,text)', 'EXECUTE') as classify_anon,
  has_function_privilege('authenticated', 'public.classify_cashbook_entry_financial_account_safe(uuid,uuid,uuid,text)', 'EXECUTE') as classify_authenticated;

-- Esperado:
-- reconciles = true em todas as linhas;
-- cross_store_account_links = 0;
-- *_anon = false;
-- *_authenticated = true.
