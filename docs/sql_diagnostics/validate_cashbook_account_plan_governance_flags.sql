-- POS_9 — Validação das flags de governança expostas para a UI do Plano de Contas
-- Objetivo: confirmar se a listagem segura entrega flags suficientes para editar/apagar com segurança.
-- Observação: usa tabela temporária porque CTE em PostgreSQL vale apenas para o SELECT imediatamente seguinte.

DROP TABLE IF EXISTS tmp_cashbook_account_plan_governance_flags;

CREATE TEMP TABLE tmp_cashbook_account_plan_governance_flags AS
SELECT
  item->>'code' AS code,
  item->>'display_code' AS display_code,
  item->>'name' AS name,
  item->>'parent_code' AS parent_code,
  COALESCE((item->>'active')::boolean, false) AS active,
  COALESCE((item->>'is_group')::boolean, false) AS is_group,
  COALESCE((item->>'is_postable')::boolean, false) AS is_postable,
  COALESCE((item->>'has_entries')::boolean, false) AS has_entries,
  COALESCE((item->>'children_count')::integer, 0) AS children_count,
  COALESCE((item->>'is_system_protected')::boolean, false) AS is_system_protected,
  COALESCE((item->>'identity_locked')::boolean, false) AS identity_locked,
  COALESCE((item->>'can_delete_safe')::boolean, false) AS can_delete_safe,
  item->'metadata' AS metadata
FROM jsonb_array_elements((public.list_cashbook_account_plan_tree_safe(true))->'items') AS item;

SELECT
  'safe_delete_visible_candidates' AS section,
  code,
  display_code,
  name,
  parent_code,
  has_entries,
  children_count,
  is_system_protected,
  identity_locked,
  can_delete_safe,
  metadata
FROM tmp_cashbook_account_plan_governance_flags
WHERE can_delete_safe = true
ORDER BY string_to_array(display_code, '.')::int[], name;

SELECT
  'identity_locked_accounts' AS section,
  code,
  display_code,
  name,
  parent_code,
  has_entries,
  children_count,
  is_system_protected,
  identity_locked,
  can_delete_safe,
  metadata
FROM tmp_cashbook_account_plan_governance_flags
WHERE identity_locked = true
ORDER BY string_to_array(display_code, '.')::int[], name;

SELECT
  'protected_accounts' AS section,
  code,
  display_code,
  name,
  parent_code,
  has_entries,
  children_count,
  is_system_protected,
  identity_locked,
  can_delete_safe,
  metadata
FROM tmp_cashbook_account_plan_governance_flags
WHERE is_system_protected = true
ORDER BY string_to_array(display_code, '.')::int[], name;

SELECT
  'flag_consistency_errors' AS section,
  code,
  display_code,
  name,
  parent_code,
  has_entries,
  children_count,
  is_system_protected,
  identity_locked,
  can_delete_safe,
  metadata
FROM tmp_cashbook_account_plan_governance_flags
WHERE can_delete_safe = true
  AND (
    has_entries = true
    OR children_count > 0
    OR is_system_protected = true
  )
ORDER BY string_to_array(display_code, '.')::int[], name;

DROP TABLE IF EXISTS tmp_cashbook_account_plan_governance_flags;
