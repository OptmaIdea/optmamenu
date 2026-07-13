-- POS_9 — Organiza contas soltas do plano de contas em grupos gerenciais amigaveis
-- Objetivo: evitar categorias soltas no balancete e preparar eventos especiais de caixa.
-- Nao altera cashbook_entries.account_plan_code existente.

-- Ajusta nomes dos grandes grupos para linguagem mais amigavel ao lojista.
UPDATE public.cashbook_account_plan
SET name = 'Entradas',
    description = 'Tudo que entra financeiramente na loja, separado entre vendas, recebimentos, aportes e entradas diversas.',
    updated_at = now()
WHERE code = 'grp_revenue';

UPDATE public.cashbook_account_plan
SET name = 'Saídas',
    description = 'Tudo que sai financeiramente da loja, separado entre custos, despesas, perdas, retiradas e pagamentos.',
    updated_at = now()
WHERE code = 'grp_expense';

-- Grupos de acolhimento para entradas não operacionais e eventos de caixa.
INSERT INTO public.cashbook_account_plan (
  code,
  display_code,
  parent_code,
  name,
  kind,
  description,
  level,
  path,
  is_group,
  is_postable,
  nature,
  affects_cash_drawer,
  affects_financial_result,
  is_transfer,
  active,
  sort_order,
  metadata,
  analysis_enabled
)
VALUES
  ('grp_income_misc', '1.2', 'grp_revenue', 'Entradas diversas', 'income', 'Entradas financeiras que não são venda operacional.', 2, '1/1.2', true, false, 'credit', false, true, false, true, 1200, '{"system_group": true, "friendly_group": true}'::jsonb, true),
  ('grp_cash_events', '1.3', 'grp_revenue', 'Movimentos de caixa', 'adjustment', 'Entradas e reforços de caixa que não representam faturamento.', 2, '1/1.3', true, false, 'neutral', false, false, false, true, 1300, '{"system_group": true, "cash_event_group": true}'::jsonb, false),
  ('grp_capital_loans_in', '1.4', 'grp_revenue', 'Aportes e empréstimos recebidos', 'adjustment', 'Dinheiro colocado no negócio por proprietário, sócio ou empréstimo recebido.', 2, '1/1.4', true, false, 'neutral', false, false, false, true, 1400, '{"system_group": true, "capital_or_loan_group": true}'::jsonb, true),
  ('grp_out_misc', '2.7', 'grp_expense', 'Saídas diversas e perdas', 'expense', 'Saídas pontuais, ajustes negativos e perdas assumidas.', 2, '2/2.7', true, false, 'debit', false, true, false, true, 2700, '{"system_group": true, "loss_group": true}'::jsonb, true),
  ('grp_out_capital_loans', '2.8', 'grp_expense', 'Retiradas, pagamentos e empréstimos', 'adjustment', 'Retiradas do proprietário, pagamentos de empréstimos e saídas que não são despesas operacionais comuns.', 2, '2/2.8', true, false, 'neutral', false, false, false, true, 2800, '{"system_group": true, "capital_or_loan_group": true}'::jsonb, true),
  ('grp_transfers', '3', null, 'Transferências internas', 'transfer', 'Movimentos entre contas financeiras da própria loja, sem afetar o resultado.', 1, '3', true, false, 'neutral', false, false, true, true, 30000, '{"system_group": true, "transfer_group": true}'::jsonb, false),
  ('grp_transfer_cash_safe', '3.1', 'grp_transfers', 'Caixa e cofre', 'transfer', 'Transferências entre caixa físico e cofre.', 2, '3/3.1', true, false, 'neutral', false, false, true, true, 30100, '{"system_group": true, "transfer_group": true}'::jsonb, false),
  ('grp_transfer_cash_bank', '3.2', 'grp_transfers', 'Caixa e banco', 'transfer', 'Transferências entre caixa físico e banco.', 2, '3/3.2', true, false, 'neutral', false, false, true, true, 30200, '{"system_group": true, "transfer_group": true}'::jsonb, false),
  ('grp_transfer_receivables_bank', '3.3', 'grp_transfers', 'Pix, cartão e banco', 'transfer', 'Transferências de Pix, maquininha e recebíveis para banco.', 2, '3/3.3', true, false, 'neutral', false, false, true, true, 30300, '{"system_group": true, "transfer_group": true}'::jsonb, false),
  ('grp_transfer_change', '3.4', 'grp_transfers', 'Troco', 'transfer', 'Trocas e reforços de troco entre contas financeiras.', 2, '3/3.4', true, false, 'neutral', false, false, true, true, 30400, '{"system_group": true, "transfer_group": true}'::jsonb, false)
ON CONFLICT (code) DO UPDATE SET
  display_code = EXCLUDED.display_code,
  parent_code = EXCLUDED.parent_code,
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  path = EXCLUDED.path,
  is_group = EXCLUDED.is_group,
  is_postable = EXCLUDED.is_postable,
  nature = EXCLUDED.nature,
  affects_cash_drawer = EXCLUDED.affects_cash_drawer,
  affects_financial_result = EXCLUDED.affects_financial_result,
  is_transfer = EXCLUDED.is_transfer,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  metadata = COALESCE(public.cashbook_account_plan.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  analysis_enabled = EXCLUDED.analysis_enabled,
  updated_at = now();

-- Contas lançáveis para eventos especiais futuros.
INSERT INTO public.cashbook_account_plan (
  code,
  display_code,
  parent_code,
  name,
  kind,
  description,
  level,
  path,
  is_group,
  is_postable,
  nature,
  affects_cash_drawer,
  affects_financial_result,
  is_transfer,
  active,
  sort_order,
  metadata,
  analysis_enabled
)
VALUES
  ('loan_received', '1.4.2', 'grp_capital_loans_in', 'Empréstimo recebido', 'adjustment', 'Entrada de dinheiro por empréstimo recebido. Não é venda nem receita operacional.', 3, '1/1.4/1.4.2', false, true, 'neutral', false, false, false, true, 1420, '{"loan_event": "received", "cashbook_future": true}'::jsonb, true),
  ('loan_principal_payment', '2.8.2', 'grp_out_capital_loans', 'Pagamento de empréstimo', 'adjustment', 'Pagamento do principal de empréstimo. Não deve ser tratado como despesa operacional.', 3, '2/2.8/2.8.2', false, true, 'neutral', false, false, false, true, 2820, '{"loan_event": "principal_payment", "cashbook_future": true}'::jsonb, true),
  ('loan_interest_expense', '2.6.1', 'grp_expense_financial', 'Juros de empréstimo', 'expense', 'Juros, encargos e custos financeiros de empréstimos.', 3, '2/2.6/2.6.1', false, true, 'debit', false, true, false, true, 2610, '{"loan_event": "interest", "financial_expense": true}'::jsonb, true),
  ('owner_withdrawal', '2.8.1', 'grp_out_capital_loans', 'Retirada do proprietário', 'adjustment', 'Retirada de dinheiro pelo proprietário. Não é despesa operacional comum.', 3, '2/2.8/2.8.1', false, true, 'neutral', false, false, false, true, 2810, '{"owner_event": "withdrawal", "cashbook_future": true}'::jsonb, true)
ON CONFLICT (code) DO UPDATE SET
  display_code = EXCLUDED.display_code,
  parent_code = EXCLUDED.parent_code,
  name = EXCLUDED.name,
  kind = EXCLUDED.kind,
  description = EXCLUDED.description,
  level = EXCLUDED.level,
  path = EXCLUDED.path,
  is_group = EXCLUDED.is_group,
  is_postable = EXCLUDED.is_postable,
  nature = EXCLUDED.nature,
  affects_cash_drawer = EXCLUDED.affects_cash_drawer,
  affects_financial_result = EXCLUDED.affects_financial_result,
  is_transfer = EXCLUDED.is_transfer,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  metadata = COALESCE(public.cashbook_account_plan.metadata, '{}'::jsonb) || EXCLUDED.metadata,
  analysis_enabled = EXCLUDED.analysis_enabled,
  updated_at = now();

-- Reorganiza categorias legadas que ficariam soltas ou pouco claras.
UPDATE public.cashbook_account_plan
SET display_code = '1.3.1',
    parent_code = 'grp_cash_events',
    level = 3,
    path = '1/1.3/1.3.1',
    kind = 'adjustment',
    nature = 'neutral',
    affects_financial_result = false,
    analysis_enabled = false,
    sort_order = 1310,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"cash_event": "closing_replenishment"}'::jsonb,
    updated_at = now()
WHERE code = 'closing_replenishment';

UPDATE public.cashbook_account_plan
SET display_code = '1.3.2',
    parent_code = 'grp_cash_events',
    level = 3,
    path = '1/1.3/1.3.2',
    kind = 'adjustment',
    nature = 'neutral',
    affects_financial_result = false,
    analysis_enabled = false,
    sort_order = 1320,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"cash_event": "change_float_reinforcement"}'::jsonb,
    updated_at = now()
WHERE code = 'change_float_reinforcement';

UPDATE public.cashbook_account_plan
SET display_code = '1.4.1',
    parent_code = 'grp_capital_loans_in',
    level = 3,
    path = '1/1.4/1.4.1',
    kind = 'adjustment',
    nature = 'neutral',
    affects_financial_result = false,
    analysis_enabled = true,
    sort_order = 1410,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"owner_event": "contribution"}'::jsonb,
    updated_at = now()
WHERE code = 'owner_contribution';

UPDATE public.cashbook_account_plan
SET display_code = '1.2.1',
    parent_code = 'grp_income_misc',
    level = 3,
    path = '1/1.2/1.2.1',
    kind = 'adjustment',
    nature = 'credit',
    analysis_enabled = true,
    sort_order = 1210,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"misc_income": true}'::jsonb,
    updated_at = now()
WHERE code = 'positive_adjustment';

UPDATE public.cashbook_account_plan
SET display_code = '2.7.1',
    parent_code = 'grp_out_misc',
    level = 3,
    path = '2/2.7/2.7.1',
    kind = 'expense',
    nature = 'debit',
    analysis_enabled = true,
    sort_order = 2710,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"misc_expense": true}'::jsonb,
    updated_at = now()
WHERE code = 'negative_adjustment';

UPDATE public.cashbook_account_plan
SET display_code = '2.7.2',
    parent_code = 'grp_out_misc',
    level = 3,
    path = '2/2.7/2.7.2',
    kind = 'expense',
    nature = 'debit',
    analysis_enabled = true,
    sort_order = 2720,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"loss_event": true}'::jsonb,
    updated_at = now()
WHERE code = 'assumed_loss';

UPDATE public.cashbook_account_plan
SET display_code = '2.7.3',
    parent_code = 'grp_out_misc',
    level = 3,
    path = '2/2.7/2.7.3',
    kind = 'expense',
    nature = 'debit',
    analysis_enabled = true,
    sort_order = 2730,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"refund_event": true}'::jsonb,
    updated_at = now()
WHERE code = 'refund';

-- Reorganiza transferências para o grupo 3, sem afetar resultado.
UPDATE public.cashbook_account_plan
SET display_code = CASE code
      WHEN 'transfer_cash_to_safe' THEN '3.1.1'
      WHEN 'transfer_safe_to_cash' THEN '3.1.2'
      WHEN 'transfer_cash_to_bank' THEN '3.2.1'
      WHEN 'transfer_bank_to_cash' THEN '3.2.2'
      WHEN 'transfer_owner_to_cash' THEN '3.2.3'
      WHEN 'transfer_cash_to_owner' THEN '3.2.4'
      WHEN 'transfer_pix_to_bank' THEN '3.3.1'
      WHEN 'transfer_card_to_bank' THEN '3.3.2'
      WHEN 'cash_change_exchange' THEN '3.4.1'
      ELSE display_code
    END,
    parent_code = CASE code
      WHEN 'transfer_cash_to_safe' THEN 'grp_transfer_cash_safe'
      WHEN 'transfer_safe_to_cash' THEN 'grp_transfer_cash_safe'
      WHEN 'transfer_cash_to_bank' THEN 'grp_transfer_cash_bank'
      WHEN 'transfer_bank_to_cash' THEN 'grp_transfer_cash_bank'
      WHEN 'transfer_owner_to_cash' THEN 'grp_transfer_cash_bank'
      WHEN 'transfer_cash_to_owner' THEN 'grp_transfer_cash_bank'
      WHEN 'transfer_pix_to_bank' THEN 'grp_transfer_receivables_bank'
      WHEN 'transfer_card_to_bank' THEN 'grp_transfer_receivables_bank'
      WHEN 'cash_change_exchange' THEN 'grp_transfer_change'
      ELSE parent_code
    END,
    level = 3,
    path = CASE code
      WHEN 'transfer_cash_to_safe' THEN '3/3.1/3.1.1'
      WHEN 'transfer_safe_to_cash' THEN '3/3.1/3.1.2'
      WHEN 'transfer_cash_to_bank' THEN '3/3.2/3.2.1'
      WHEN 'transfer_bank_to_cash' THEN '3/3.2/3.2.2'
      WHEN 'transfer_owner_to_cash' THEN '3/3.2/3.2.3'
      WHEN 'transfer_cash_to_owner' THEN '3/3.2/3.2.4'
      WHEN 'transfer_pix_to_bank' THEN '3/3.3/3.3.1'
      WHEN 'transfer_card_to_bank' THEN '3/3.3/3.3.2'
      WHEN 'cash_change_exchange' THEN '3/3.4/3.4.1'
      ELSE path
    END,
    kind = 'transfer',
    nature = 'neutral',
    is_transfer = true,
    affects_financial_result = false,
    analysis_enabled = false,
    sort_order = CASE code
      WHEN 'transfer_cash_to_safe' THEN 30110
      WHEN 'transfer_safe_to_cash' THEN 30120
      WHEN 'transfer_cash_to_bank' THEN 30210
      WHEN 'transfer_bank_to_cash' THEN 30220
      WHEN 'transfer_owner_to_cash' THEN 30230
      WHEN 'transfer_cash_to_owner' THEN 30240
      WHEN 'transfer_pix_to_bank' THEN 30310
      WHEN 'transfer_card_to_bank' THEN 30320
      WHEN 'cash_change_exchange' THEN 30410
      ELSE sort_order
    END,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"internal_transfer_grouped": true}'::jsonb,
    updated_at = now()
WHERE code IN (
  'transfer_cash_to_safe',
  'transfer_safe_to_cash',
  'transfer_cash_to_bank',
  'transfer_bank_to_cash',
  'transfer_owner_to_cash',
  'transfer_cash_to_owner',
  'transfer_pix_to_bank',
  'transfer_card_to_bank',
  'cash_change_exchange'
);
