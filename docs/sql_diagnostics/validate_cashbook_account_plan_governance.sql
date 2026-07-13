-- POS_9 — Diagnóstico de governança do Plano de Contas
-- Objetivo: encontrar duplicidades, contas soltas e riscos antes de permitir exclusão/numeração automática.

-- 1) Códigos exibidos duplicados entre contas ativas
SELECT
  'duplicate_display_code' AS section,
  display_code,
  COUNT(*) AS total,
  jsonb_agg(jsonb_build_object(
    'code', code,
    'name', name,
    'parent_code', parent_code,
    'is_group', is_group,
    'is_postable', is_postable,
    'path', path
  ) ORDER BY sort_order, name) AS accounts
FROM public.cashbook_account_plan
WHERE active = true
  AND display_code IS NOT NULL
GROUP BY display_code
HAVING COUNT(*) > 1
ORDER BY display_code;

-- 2) Contas lançáveis ativas soltas
SELECT
  'loose_postable_account' AS section,
  code,
  display_code,
  parent_code,
  name,
  kind,
  nature,
  is_group,
  is_postable,
  path
FROM public.cashbook_account_plan
WHERE active = true
  AND is_postable = true
  AND COALESCE(is_group, false) = false
  AND parent_code IS NULL
ORDER BY sort_order, display_code, name;

-- 3) Grupos ativos soltos que não são raiz esperada
SELECT
  'unexpected_root_group' AS section,
  code,
  display_code,
  parent_code,
  name,
  kind,
  is_group,
  is_postable,
  path,
  metadata
FROM public.cashbook_account_plan
WHERE active = true
  AND is_group = true
  AND parent_code IS NULL
  AND code NOT IN ('grp_revenue', 'grp_expense', 'grp_transfers')
ORDER BY sort_order, display_code, name;

-- 4) Contas que possuem lançamentos e não podem ser apagadas
SELECT
  'accounts_with_entries_no_delete' AS section,
  p.code,
  p.display_code,
  p.name,
  p.parent_code,
  COUNT(e.id) AS entries_count,
  MIN(e.entry_date) AS first_entry_date,
  MAX(e.entry_date) AS last_entry_date
FROM public.cashbook_account_plan p
JOIN public.cashbook_entries e ON e.account_plan_code = p.code
GROUP BY p.code, p.display_code, p.name, p.parent_code
ORDER BY entries_count DESC, p.display_code, p.name;

-- 5) Grupos com filhos e que não podem ser apagados
SELECT
  'groups_with_children_no_delete' AS section,
  parent.code,
  parent.display_code,
  parent.name,
  COUNT(child.code) AS children_count,
  jsonb_agg(jsonb_build_object(
    'code', child.code,
    'display_code', child.display_code,
    'name', child.name,
    'active', child.active
  ) ORDER BY child.sort_order, child.display_code, child.name) AS children
FROM public.cashbook_account_plan parent
JOIN public.cashbook_account_plan child ON child.parent_code = parent.code
WHERE parent.is_group = true
GROUP BY parent.code, parent.display_code, parent.name
ORDER BY parent.display_code, parent.name;

-- 6) Contas candidatas a exclusão futura segura
SELECT
  'safe_delete_candidates' AS section,
  p.code,
  p.display_code,
  p.name,
  p.parent_code,
  p.is_group,
  p.is_postable,
  p.active,
  p.metadata
FROM public.cashbook_account_plan p
WHERE NOT EXISTS (
    SELECT 1
    FROM public.cashbook_entries e
    WHERE e.account_plan_code = p.code
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.cashbook_account_plan child
    WHERE child.parent_code = p.code
  )
  AND COALESCE((p.metadata->>'system_group')::boolean, false) = false
  AND COALESCE((p.metadata->>'protected_account')::boolean, false) = false
  AND COALESCE((p.metadata->>'cashbook_future')::boolean, false) = false
  AND COALESCE((p.metadata->>'user_created')::boolean, false) = true
ORDER BY p.display_code, p.name;

-- 7) Sugestão manual de próximo número por grupo, para conferência antes da RPC
WITH child_numbers AS (
  SELECT
    parent.code AS parent_code,
    parent.display_code AS parent_display_code,
    parent.name AS parent_name,
    child.display_code AS child_display_code,
    NULLIF(regexp_replace(child.display_code, '^' || regexp_replace(parent.display_code, '\\.', '\\.', 'g') || '\\.', ''), '') AS suffix
  FROM public.cashbook_account_plan parent
  JOIN public.cashbook_account_plan child ON child.parent_code = parent.code
  WHERE parent.display_code IS NOT NULL
    AND child.display_code LIKE parent.display_code || '.%'
), numeric_suffix AS (
  SELECT
    parent_code,
    parent_display_code,
    parent_name,
    CASE WHEN suffix ~ '^[0-9]+$' THEN suffix::integer ELSE NULL END AS child_number
  FROM child_numbers
)
SELECT
  'next_child_number_preview' AS section,
  parent_code,
  parent_display_code,
  parent_name,
  COALESCE(MAX(child_number), 0) + 1 AS next_number,
  parent_display_code || '.' || (COALESCE(MAX(child_number), 0) + 1)::text AS suggested_display_code
FROM numeric_suffix
GROUP BY parent_code, parent_display_code, parent_name
ORDER BY parent_display_code, parent_name;
