-- POS_9 — Saneia grupos duplicados no plano de contas
-- Mantém os grupos amigáveis definidos na governança e move grupos legados para códigos livres.
-- Não altera cashbook_entries.account_plan_code.

-- ENTRADAS
-- 1.1 Receitas operacionais permanece.
-- 1.2 Entradas diversas permanece.
-- 1.3 Movimentos de caixa permanece.
-- 1.4 Aportes e empréstimos recebidos permanece.
-- Grupos legados são renumerados para evitar duplicidade visual.

UPDATE public.cashbook_account_plan
SET display_code = '1.5',
    parent_code = 'grp_revenue',
    level = 2,
    path = '1/1.5',
    name = 'Receitas bancárias',
    description = 'Receitas financeiras ou bancárias, quando aplicável.',
    sort_order = 1500,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'renumbered_by_migration', '20260713152000_cashbook_account_plan_fix_duplicate_groups',
      'previous_display_code', '1.2'
    ),
    updated_at = now()
WHERE code = 'grp_revenue_banking';

UPDATE public.cashbook_account_plan
SET display_code = '1.6',
    parent_code = 'grp_revenue',
    level = 2,
    path = '1/1.6',
    name = 'Receitas tributárias',
    description = 'Receitas tributárias ou fiscais, quando aplicável.',
    sort_order = 1600,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'renumbered_by_migration', '20260713152000_cashbook_account_plan_fix_duplicate_groups',
      'previous_display_code', '1.3'
    ),
    updated_at = now()
WHERE code = 'grp_revenue_tax';

UPDATE public.cashbook_account_plan
SET display_code = '1.7',
    parent_code = 'grp_revenue',
    level = 2,
    path = '1/1.7',
    name = 'Entradas de caixa',
    description = 'Entradas de caixa mantidas por compatibilidade histórica.',
    sort_order = 1700,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'renumbered_by_migration', '20260713152000_cashbook_account_plan_fix_duplicate_groups',
      'previous_display_code', '1.4'
    ),
    updated_at = now()
WHERE code = 'grp_revenue_cash_entries';

UPDATE public.cashbook_account_plan
SET display_code = '1.8',
    parent_code = 'grp_revenue',
    level = 2,
    path = '1/1.8',
    name = 'Receitas não operacionais',
    description = 'Entradas que não representam a operação principal da loja.',
    sort_order = 1800,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'renumbered_by_migration', '20260713152000_cashbook_account_plan_fix_duplicate_groups',
      'previous_display_code', '1.5'
    ),
    updated_at = now()
WHERE code = 'grp_revenue_non_operational';

-- SAÍDAS
-- 2.7 Saídas diversas e perdas permanece.
-- 2.8 Retiradas, pagamentos e empréstimos permanece.
-- Grupos legados duplicados são renumerados para códigos livres.

UPDATE public.cashbook_account_plan
SET display_code = '2.15',
    parent_code = 'grp_expense',
    level = 2,
    path = '2/2.15',
    name = 'Despesas com sócios',
    description = 'Despesas ou valores relacionados a sócios, quando usado pela loja.',
    sort_order = 21500,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'renumbered_by_migration', '20260713152000_cashbook_account_plan_fix_duplicate_groups',
      'previous_display_code', '2.7'
    ),
    updated_at = now()
WHERE code = 'grp_expense_partners';

UPDATE public.cashbook_account_plan
SET display_code = '2.16',
    parent_code = 'grp_expense',
    level = 2,
    path = '2/2.16',
    name = 'Despesas de produção',
    description = 'Despesas de produção mantidas separadas de matéria-prima e consumo.',
    sort_order = 21600,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'renumbered_by_migration', '20260713152000_cashbook_account_plan_fix_duplicate_groups',
      'previous_display_code', '2.8'
    ),
    updated_at = now()
WHERE code = 'grp_expense_production';

-- Recalcula path dos filhos diretos dos grupos renumerados, preservando sufixo quando houver.
WITH parent_updates AS (
  SELECT code, display_code, path
  FROM public.cashbook_account_plan
  WHERE code IN (
    'grp_revenue_banking',
    'grp_revenue_tax',
    'grp_revenue_cash_entries',
    'grp_revenue_non_operational',
    'grp_expense_partners',
    'grp_expense_production'
  )
)
UPDATE public.cashbook_account_plan child
SET display_code = parent.display_code || '.' || split_part(child.display_code, '.', array_length(string_to_array(child.display_code, '.'), 1)),
    path = parent.path || '/' || parent.display_code || '.' || split_part(child.display_code, '.', array_length(string_to_array(child.display_code, '.'), 1)),
    level = COALESCE(child.level, 3),
    metadata = COALESCE(child.metadata, '{}'::jsonb) || jsonb_build_object(
      'parent_renumbered_by_migration', '20260713152000_cashbook_account_plan_fix_duplicate_groups'
    ),
    updated_at = now()
FROM parent_updates parent
WHERE child.parent_code = parent.code
  AND child.display_code IS NOT NULL
  AND child.display_code ~ '^([0-9]+\.)+[0-9]+$';
