-- POS_9 — Diagnóstico de exclusão segura do Plano de Contas
-- Objetivo: validar quais contas poderiam ou não poderiam ser apagadas antes de ligar a ação na UI.

-- 1) Contas que NÃO podem ser apagadas por serem estrutura base/protegida
SELECT
  'protected_no_delete' AS section,
  p.code,
  p.display_code,
  p.name,
  p.parent_code,
  p.is_group,
  p.is_postable,
  p.active,
  p.metadata
FROM public.cashbook_account_plan p
WHERE p.code IN ('grp_revenue', 'grp_expense', 'grp_transfers')
   OR COALESCE((p.metadata->>'system_group')::boolean, false) = true
   OR COALESCE((p.metadata->>'protected_account')::boolean, false) = true
   OR COALESCE((p.metadata->>'protected_base_structure')::boolean, false) = true
ORDER BY string_to_array(COALESCE(p.display_code, '999'), '.')::int[], p.name;

-- 2) Contas que NÃO podem ser apagadas porque possuem lançamentos
SELECT
  'entries_no_delete' AS section,
  p.code,
  p.display_code,
  p.name,
  p.parent_code,
  p.is_group,
  p.is_postable,
  COUNT(e.id) AS entries_count,
  MIN(e.entry_date) AS first_entry_date,
  MAX(e.entry_date) AS last_entry_date
FROM public.cashbook_account_plan p
JOIN public.cashbook_entries e ON e.account_plan_code = p.code
GROUP BY p.code, p.display_code, p.name, p.parent_code, p.is_group, p.is_postable
ORDER BY COUNT(e.id) DESC, string_to_array(COALESCE(p.display_code, '999'), '.')::int[], p.name;

-- 3) Grupos que NÃO podem ser apagados porque possuem filhos
SELECT
  'children_no_delete' AS section,
  parent.code,
  parent.display_code,
  parent.name,
  parent.parent_code,
  parent.is_group,
  COUNT(child.code) AS children_count,
  jsonb_agg(
    jsonb_build_object(
      'code', child.code,
      'display_code', child.display_code,
      'name', child.name,
      'active', child.active
    )
    ORDER BY string_to_array(COALESCE(child.display_code, '999'), '.')::int[], child.name
  ) AS children
FROM public.cashbook_account_plan parent
JOIN public.cashbook_account_plan child ON child.parent_code = parent.code
WHERE parent.is_group = true
GROUP BY parent.code, parent.display_code, parent.name, parent.parent_code, parent.is_group
ORDER BY string_to_array(COALESCE(parent.display_code, '999'), '.')::int[], parent.name;

-- 4) Contas que podem ser candidatas a apagar com segurança pela UI
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
WHERE COALESCE((p.metadata->>'user_created')::boolean, false) = true
  AND p.code NOT IN ('grp_revenue', 'grp_expense', 'grp_transfers')
  AND COALESCE((p.metadata->>'system_group')::boolean, false) = false
  AND COALESCE((p.metadata->>'protected_account')::boolean, false) = false
  AND COALESCE((p.metadata->>'protected_base_structure')::boolean, false) = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.cashbook_entries e
    WHERE e.account_plan_code = p.code
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.cashbook_account_plan child
    WHERE child.parent_code = p.code
  )
ORDER BY string_to_array(COALESCE(p.display_code, '999'), '.')::int[], p.name;

-- 5) Teste manual sugerido, substitua pelo code de uma conta candidata:
-- select public.delete_cashbook_account_plan_safe('codigo_da_conta_teste');
