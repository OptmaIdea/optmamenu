-- POS_9 — Direção operacional para categorias do Livro Diário
-- Objetivo: separar a linguagem simples do operador da estrutura técnica do Plano de Contas.
-- Não altera lançamentos existentes.

-- Categorias que podem ser usadas em Nova entrada manual.
UPDATE public.cashbook_account_plan
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"manual_cashbook_direction":"in"}'::jsonb,
    updated_at = now()
WHERE code IN (
  'pending_payment_received',
  'positive_adjustment',
  'closing_replenishment',
  'change_float_reinforcement',
  'owner_contribution',
  'other_income'
);

-- Categorias que podem ser usadas em Nova saída manual.
UPDATE public.cashbook_account_plan
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"manual_cashbook_direction":"out"}'::jsonb,
    updated_at = now()
WHERE code IN (
  'operational_expense',
  'small_purchase',
  'negative_adjustment',
  'assumed_loss',
  'other_expense',
  'packaging_expense',
  'freight_expense',
  'toll_expense',
  'gifts_expense',
  'sales_commission_expense',
  'loan_interest_expense',
  'owner_withdrawal'
);

-- Categorias que são técnicas ou devem nascer por fluxo próprio, não pelo lançamento manual simples.
UPDATE public.cashbook_account_plan
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"manual_cashbook_hidden":true,"manual_cashbook_hidden_reason":"flow_specific"}'::jsonb,
    updated_at = now()
WHERE code IN (
  'sale_cash',
  'sale_pix',
  'sale_debit',
  'sale_credit',
  'refund',
  'sales_cancellation',
  'loan_received',
  'loan_principal_payment'
)
OR is_transfer = true
OR kind = 'transfer';

-- Reforça que principal de empréstimo deve pertencer ao futuro módulo de empréstimos.
-- A entrada do valor principal e a amortização do principal não afetam resultado operacional;
-- juros e encargos financeiros continuam em categoria própria de despesa financeira.
UPDATE public.cashbook_account_plan
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"loan_module_required":true,"manual_cashbook_hidden":true,"manual_cashbook_hidden_reason":"loan_lifecycle"}'::jsonb,
    updated_at = now()
WHERE code IN ('loan_received', 'loan_principal_payment');

-- Pós-checagem amigável para o SQL Editor.
SELECT
  code,
  display_code,
  name,
  kind,
  nature,
  metadata ->> 'manual_cashbook_direction' AS manual_cashbook_direction,
  metadata ->> 'manual_cashbook_hidden' AS manual_cashbook_hidden,
  metadata ->> 'manual_cashbook_hidden_reason' AS manual_cashbook_hidden_reason
FROM public.cashbook_account_plan
WHERE active = true
  AND is_group IS DISTINCT FROM true
  AND is_postable IS DISTINCT FROM false
  AND (
    metadata ? 'manual_cashbook_direction'
    OR metadata ? 'manual_cashbook_hidden'
    OR metadata ? 'loan_module_required'
  )
ORDER BY display_code NULLS LAST, sort_order, name;
