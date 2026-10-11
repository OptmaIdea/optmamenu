-- Homologação OptmaMenu — Financeiro / pré-conciliação / formas específicas
-- Somente leitura. Esperado: todos os contadores críticos abaixo = 0 e grants anon = false.

-- 1) No máximo uma conta de entrada das vendas por loja.
select store_id, count(*) as clearing_defaults
from public.store_financial_accounts
where is_sales_clearing_default = true
group by store_id
having count(*) > 1;

-- 2) Conta preferencial de uma forma de pagamento nunca pode pertencer a outra loja.
select count(*) as cross_store_preferred_payment_accounts
from public.store_payment_methods pm
join public.store_financial_accounts a on a.id = pm.preferred_financial_account_id
where a.store_id <> pm.store_id;

-- 3) Forma específica vinculada deve ter sua rota exata habilitada na conta preferencial.
select count(*) as custom_variants_missing_preferred_route
from public.store_payment_methods pm
where pm.code <> pm.base_code
  and pm.preferred_financial_account_id is not null
  and not exists (
    select 1
    from public.store_financial_account_payment_methods apm
    where apm.store_id = pm.store_id
      and apm.account_id = pm.preferred_financial_account_id
      and apm.payment_method_code = pm.code
      and apm.active = true
  );

-- 4) Base das formas específicas deve permanecer canônica.
select count(*) as invalid_payment_base_codes
from public.store_payment_methods
where base_code not in ('pending','cash','pix','debit_card','credit_card','bank_transfer','voucher','other');

-- 5) Lançamento financeiro nunca referencia conta de outra loja.
select count(*) as cross_store_cashbook_source_accounts
from public.cashbook_entries e
join public.store_financial_accounts a on a.id = e.source_financial_account_id
where a.store_id <> e.store_id;

select count(*) as cross_store_cashbook_destination_accounts
from public.cashbook_entries e
join public.store_financial_accounts a on a.id = e.destination_financial_account_id
where a.store_id <> e.store_id;

-- 6) Pedido e lançamento de venda vinculados devem preservar o mesmo código de recebimento,
-- exceto registros históricos que ainda não possuem código em um dos lados.
select count(*) as linked_sale_payment_code_mismatches
from public.cashbook_entries e
join public.orders o on o.id = e.order_id and o.store_id = e.store_id
where e.type = 'sale'
  and e.status <> 'cancelled'
  and nullif(e.payment_method_code, '') is not null
  and nullif(o.payment_method_code, '') is not null
  and e.payment_method_code <> o.payment_method_code;

-- 7) RPCs de conferência/ajuste não podem ser executadas por anon.
select
  has_function_privilege('anon', 'public.list_financial_account_movements_safe(uuid,uuid,text,date,date,integer,integer)', 'EXECUTE') as list_movements_anon,
  has_function_privilege('anon', 'public.change_cashbook_entry_payment_route_safe(uuid,uuid,text,uuid,text)', 'EXECUTE') as change_payment_route_anon,
  has_function_privilege('anon', 'public.list_store_payment_methods_with_routing_safe(uuid)', 'EXECUTE') as list_payment_methods_anon,
  has_function_privilege('anon', 'public.upsert_store_payment_method_variant_safe(uuid,uuid,text,text,text,text,uuid,boolean,boolean,boolean,boolean,boolean,integer)', 'EXECUTE') as upsert_payment_variant_anon;

-- 8) A tabela de auditoria não é legível diretamente por cliente.
select
  has_table_privilege('anon', 'public.cashbook_payment_route_audit', 'SELECT') as audit_anon_select,
  has_table_privilege('authenticated', 'public.cashbook_payment_route_audit', 'SELECT') as audit_authenticated_select;
