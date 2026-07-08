-- POS_9 — Plano de contas gerencial hierarquico
-- Evolui a tabela atual sem quebrar os lancamentos existentes.
-- O campo `code` continua sendo a chave tecnica usada por cashbook_entries.account_plan_code.

ALTER TABLE public.cashbook_account_plan
  ADD COLUMN IF NOT EXISTS display_code text,
  ADD COLUMN IF NOT EXISTS parent_code text,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_postable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS nature text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS analysis_enabled boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cashbook_account_plan_parent_fk'
      AND conrelid = 'public.cashbook_account_plan'::regclass
  ) THEN
    ALTER TABLE public.cashbook_account_plan
      ADD CONSTRAINT cashbook_account_plan_parent_fk
      FOREIGN KEY (parent_code)
      REFERENCES public.cashbook_account_plan(code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE public.cashbook_account_plan
  DROP CONSTRAINT IF EXISTS cashbook_account_plan_level_check;

ALTER TABLE public.cashbook_account_plan
  ADD CONSTRAINT cashbook_account_plan_level_check
  CHECK (level >= 1 AND level <= 10);

ALTER TABLE public.cashbook_account_plan
  DROP CONSTRAINT IF EXISTS cashbook_account_plan_nature_check;

ALTER TABLE public.cashbook_account_plan
  ADD CONSTRAINT cashbook_account_plan_nature_check
  CHECK (nature IN ('debit', 'credit', 'neutral'));

CREATE INDEX IF NOT EXISTS idx_cashbook_account_plan_parent
  ON public.cashbook_account_plan (parent_code, sort_order, display_code, name)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_cashbook_account_plan_tree
  ON public.cashbook_account_plan (kind, level, sort_order, display_code, name)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_cashbook_account_plan_postable
  ON public.cashbook_account_plan (kind, is_postable, active, sort_order, display_code, name);

-- Grupos principais e subgrupos gerenciais.
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
  metadata
)
VALUES
  ('grp_revenue', '1', null, 'Receitas', 'income', 'Grupo principal de receitas.', 1, '1', true, false, 'credit', false, true, false, true, 1000, '{"system_group": true}'::jsonb),
  ('grp_revenue_operational', '1.1', 'grp_revenue', 'Receitas operacionais', 'income', 'Receitas diretamente ligadas a vendas e servicos.', 2, '1/1.1', true, false, 'credit', false, true, false, true, 1100, '{"system_group": true}'::jsonb),
  ('grp_revenue_banking', '1.2', 'grp_revenue', 'Receitas bancarias', 'income', 'Receitas financeiras e bancarias.', 2, '1/1.2', true, false, 'credit', false, true, false, true, 1200, '{"system_group": true}'::jsonb),
  ('grp_revenue_tax', '1.3', 'grp_revenue', 'Receitas tributarias', 'income', 'Receitas ou recuperacoes tributarias.', 2, '1/1.3', true, false, 'credit', false, true, false, true, 1300, '{"system_group": true}'::jsonb),
  ('grp_revenue_cash_entries', '1.4', 'grp_revenue', 'Entradas de caixa', 'income', 'Entradas de caixa que nao representam venda operacional.', 2, '1/1.4', true, false, 'credit', false, true, false, true, 1400, '{"system_group": true}'::jsonb),
  ('grp_revenue_non_operational', '1.5', 'grp_revenue', 'Receitas nao operacionais', 'income', 'Receitas fora da operacao principal.', 2, '1/1.5', true, false, 'credit', false, true, false, true, 1500, '{"system_group": true}'::jsonb),

  ('grp_expense', '2', null, 'Despesas', 'expense', 'Grupo principal de despesas.', 1, '2', true, false, 'debit', false, true, false, true, 2000, '{"system_group": true}'::jsonb),
  ('grp_expense_raw_material', '2.1', 'grp_expense', 'Materia-prima', 'expense', 'Custos e despesas com materia-prima.', 2, '2/2.1', true, false, 'debit', false, true, false, true, 2100, '{"system_group": true}'::jsonb),
  ('grp_expense_industrial', '2.2', 'grp_expense', 'Despesas industriais', 'expense', 'Despesas de producao ou fabricacao.', 2, '2/2.2', true, false, 'debit', false, true, false, true, 2200, '{"system_group": true}'::jsonb),
  ('grp_expense_administrative', '2.3', 'grp_expense', 'Despesas administrativas', 'expense', 'Despesas administrativas gerais.', 2, '2/2.3', true, false, 'debit', false, true, false, true, 2300, '{"system_group": true}'::jsonb),
  ('grp_expense_commercial', '2.4', 'grp_expense', 'Despesas comerciais', 'expense', 'Despesas comerciais, vendas, entregas e promocionais.', 2, '2/2.4', true, false, 'debit', false, true, false, true, 2400, '{"system_group": true}'::jsonb),
  ('grp_expense_tax', '2.5', 'grp_expense', 'Obrigacoes tributarias', 'expense', 'Impostos, taxas e obrigacoes tributarias.', 2, '2/2.5', true, false, 'debit', false, true, false, true, 2500, '{"system_group": true}'::jsonb),
  ('grp_expense_financial', '2.6', 'grp_expense', 'Despesas financeiras', 'expense', 'Juros, tarifas e despesas financeiras.', 2, '2/2.6', true, false, 'debit', false, true, false, true, 2600, '{"system_group": true}'::jsonb),
  ('grp_expense_partners', '2.7', 'grp_expense', 'Despesas com socios', 'expense', 'Retiradas e despesas relacionadas aos socios.', 2, '2/2.7', true, false, 'debit', false, true, false, true, 2700, '{"system_group": true}'::jsonb),
  ('grp_expense_production', '2.8', 'grp_expense', 'Despesas de producao', 'expense', 'Despesas operacionais de producao.', 2, '2/2.8', true, false, 'debit', false, true, false, true, 2800, '{"system_group": true}'::jsonb),
  ('grp_expense_fixed_assets', '2.9', 'grp_expense', 'Ativo fixo', 'expense', 'Aquisicoes e manutencoes de ativo fixo.', 2, '2/2.9', true, false, 'debit', false, true, false, true, 2900, '{"system_group": true}'::jsonb),
  ('grp_expense_packaging', '2.10', 'grp_expense', 'Embalagem', 'expense', 'Despesas com embalagens.', 2, '2/2.10', true, false, 'debit', false, true, false, true, 3000, '{"system_group": true}'::jsonb),
  ('grp_expense_fixed', '2.11', 'grp_expense', 'Despesas fixas', 'expense', 'Despesas fixas recorrentes.', 2, '2/2.11', true, false, 'debit', false, true, false, true, 3100, '{"system_group": true}'::jsonb),
  ('grp_expense_employees', '2.12', 'grp_expense', 'Despesas com funcionarios em geral', 'expense', 'Despesas com equipe e colaboradores.', 2, '2/2.12', true, false, 'debit', false, true, false, true, 3200, '{"system_group": true}'::jsonb),
  ('grp_expense_vehicles', '2.13', 'grp_expense', 'Despesas com veiculos da empresa', 'expense', 'Combustivel, pedagio, manutencao e outras despesas com veiculos.', 2, '2/2.13', true, false, 'debit', false, true, false, true, 3300, '{"system_group": true}'::jsonb),
  ('grp_expense_asset_writeoff', '2.14', 'grp_expense', 'Baixa do ativo fixo', 'expense', 'Baixas e perdas relacionadas a ativo fixo.', 2, '2/2.14', true, false, 'debit', false, true, false, true, 3400, '{"system_group": true}'::jsonb)
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
  metadata = public.cashbook_account_plan.metadata || EXCLUDED.metadata,
  updated_at = now();

-- Contas analiticas gerenciais iniciais.
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
  ('sales', '1.1.1', 'grp_revenue_operational', 'Vendas', 'income', 'Receitas de vendas. Deve permitir analises por produto, categoria, canal, cliente e periodo.', 3, '1/1.1/1.1.1', false, true, 'credit', false, true, false, true, 1110, '{"analysis": "sales"}'::jsonb, true),
  ('services_revenue', '1.1.2', 'grp_revenue_operational', 'Servicos', 'income', 'Receitas de servicos.', 3, '1/1.1/1.1.2', false, true, 'credit', false, true, false, true, 1120, '{"analysis": "services"}'::jsonb, true),
  ('sales_returns', '1.1.3', 'grp_revenue_operational', '(-) Devolucoes sobre vendas', 'expense', 'Deducoes por devolucao de vendas.', 3, '1/1.1/1.1.3', false, true, 'debit', false, true, false, true, 1130, '{"deduction": true}'::jsonb, true),
  ('sales_cancellations', '1.1.4', 'grp_revenue_operational', '(-) Cancelamentos sobre vendas', 'expense', 'Deducoes por cancelamento de vendas.', 3, '1/1.1/1.1.4', false, true, 'debit', false, true, false, true, 1140, '{"deduction": true}'::jsonb, true),
  ('gifts_expense', '2.4.6', 'grp_expense_commercial', 'Brindes', 'expense', 'Brindes e acoes promocionais.', 3, '2/2.4/2.4.6', false, true, 'debit', false, true, false, true, 2460, '{"commercial_expense": true}'::jsonb, true),
  ('sales_commissions', '2.4.8', 'grp_expense_commercial', 'Comissoes de vendas', 'expense', 'Comissoes e incentivos vinculados a vendas.', 3, '2/2.4/2.4.8', false, true, 'debit', false, true, false, true, 2480, '{"commercial_expense": true}'::jsonb, true),
  ('freight_expense', '2.4.13', 'grp_expense_commercial', 'Fretes', 'expense', 'Fretes pagos pela loja.', 3, '2/2.4/2.4.13', false, true, 'debit', false, true, false, true, 24130, '{"delivery_expense": true}'::jsonb, true),
  ('toll_expense', '2.4.14', 'grp_expense_commercial', 'Pedagio', 'expense', 'Pedagios vinculados a entregas, compras ou deslocamentos.', 3, '2/2.4/2.4.14', false, true, 'debit', false, true, false, true, 24140, '{"vehicle_expense": true}'::jsonb, true),
  ('packaging_expense', '2.10.1', 'grp_expense_packaging', 'Embalagens', 'expense', 'Embalagens usadas em vendas e operacao.', 3, '2/2.10/2.10.1', false, true, 'debit', false, true, false, true, 3010, '{"packaging_expense": true}'::jsonb, true)
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
  metadata = public.cashbook_account_plan.metadata || EXCLUDED.metadata,
  analysis_enabled = EXCLUDED.analysis_enabled,
  updated_at = now();

-- Classificacao hierarquica inicial para categorias legadas.
UPDATE public.cashbook_account_plan
SET
  display_code = '1.1.1.01',
  parent_code = 'grp_revenue_operational',
  level = 4,
  path = '1/1.1/1.1.1/1.1.1.01',
  is_group = false,
  is_postable = true,
  nature = 'credit',
  analysis_enabled = true,
  metadata = metadata || '{"legacy_category": true, "mapped_to": "sales"}'::jsonb,
  updated_at = now()
WHERE code = 'sale_cash';

UPDATE public.cashbook_account_plan
SET
  display_code = '1.1.1.02',
  parent_code = 'grp_revenue_operational',
  level = 4,
  path = '1/1.1/1.1.1/1.1.1.02',
  is_group = false,
  is_postable = true,
  nature = 'credit',
  analysis_enabled = true,
  metadata = metadata || '{"legacy_category": true, "mapped_to": "sales"}'::jsonb,
  updated_at = now()
WHERE code = 'sale_pix';

UPDATE public.cashbook_account_plan
SET
  display_code = '1.1.1.03',
  parent_code = 'grp_revenue_operational',
  level = 4,
  path = '1/1.1/1.1.1/1.1.1.03',
  is_group = false,
  is_postable = true,
  nature = 'credit',
  analysis_enabled = true,
  metadata = metadata || '{"legacy_category": true, "mapped_to": "sales"}'::jsonb,
  updated_at = now()
WHERE code = 'sale_debit';

UPDATE public.cashbook_account_plan
SET
  display_code = '1.1.1.04',
  parent_code = 'grp_revenue_operational',
  level = 4,
  path = '1/1.1/1.1.1/1.1.1.04',
  is_group = false,
  is_postable = true,
  nature = 'credit',
  analysis_enabled = true,
  metadata = metadata || '{"legacy_category": true, "mapped_to": "sales"}'::jsonb,
  updated_at = now()
WHERE code = 'sale_credit';

UPDATE public.cashbook_account_plan
SET
  display_code = '2.3.1',
  parent_code = 'grp_expense_administrative',
  level = 3,
  path = '2/2.3/2.3.1',
  is_group = false,
  is_postable = true,
  nature = 'debit',
  analysis_enabled = true,
  metadata = metadata || '{"legacy_category": true}'::jsonb,
  updated_at = now()
WHERE code = 'operational_expense';

UPDATE public.cashbook_account_plan
SET
  display_code = '2.3.2',
  parent_code = 'grp_expense_administrative',
  level = 3,
  path = '2/2.3/2.3.2',
  is_group = false,
  is_postable = true,
  nature = 'debit',
  analysis_enabled = true,
  metadata = metadata || '{"legacy_category": true}'::jsonb,
  updated_at = now()
WHERE code = 'small_purchase';

UPDATE public.cashbook_account_plan
SET
  display_code = '1.4.1',
  parent_code = 'grp_revenue_cash_entries',
  level = 3,
  path = '1/1.4/1.4.1',
  is_group = false,
  is_postable = true,
  nature = 'neutral',
  analysis_enabled = false,
  updated_at = now()
WHERE code IN ('closing_replenishment', 'change_float_reinforcement', 'owner_contribution', 'positive_adjustment');
