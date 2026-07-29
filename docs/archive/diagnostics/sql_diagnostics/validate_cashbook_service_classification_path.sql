-- POS_9 — Validação — caminho de classificação via metadata
-- Objetivo: confirmar que uma entrada criada com metadata de classificação
-- é convertida pelo trigger para campos estruturados.

-- 1) Criar lançamento de teste classificado
select
  'create_classified_entry' as section,
  public.create_cashbook_entry(
    p_store_id := '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid,
    p_type := 'manual_income',
    p_direction := 'in',
    p_amount := 0.01,
    p_description := 'Teste classificacao metadata service',
    p_payment_method_code := 'cash',
    p_notes := 'Teste tecnico. Pode ser cancelado depois.',
    p_occurred_at := now(),
    p_metadata := jsonb_build_object(
      'source', 'validate_cashbook_service_classification_path',
      'account_plan_code', 'change_float_reinforcement',
      'destination_financial_account_code', 'cash_drawer',
      'affects_cash_drawer', true,
      'affects_financial_result', false,
      'is_transfer', false
    )
  ) as result;

-- 2) Conferir classificação aplicada
select
  'classified_test_entry' as section,
  e.id,
  e.entry_code,
  e.entry_date,
  e.amount,
  e.description,
  e.account_plan_code,
  e.destination_financial_account_id,
  a.code as destination_account_code,
  e.is_transfer,
  e.affects_cash_drawer,
  e.affects_financial_result,
  e.metadata ->> 'classification_source' as classification_source
from public.cashbook_entries e
left join public.store_financial_accounts a on a.id = e.destination_financial_account_id
where e.store_id = '0abba741-0f77-4783-8cf8-58811cf7343b'::uuid
  and e.metadata ->> 'source' = 'validate_cashbook_service_classification_path'
order by e.created_at desc
limit 5;
