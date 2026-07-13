-- POS_9 — Validação das flags de governança expostas para a UI do Plano de Contas
-- Objetivo: confirmar se a listagem segura entrega flags suficientes para editar/apagar com segurança.

WITH listed AS (
  SELECT jsonb_array_elements((public.list_cashbook_account_plan_tree_safe(true))->'items') AS item
), normalized AS (
  SELECT
    item->>'code' AS code,
    item->>'display_code' AS display_code,
    item->>'name' AS name,
    item->>'parent_code' AS parent_code,
    (item->>'active')::boolean AS active,
    (item->>'is_group')::boolean AS is_group,
    (item->>'is_postable')::boolean AS is_postable,
    COALESCE((item->>'has_entries')::boolean, false) AS has_entries,
    COALESCE((item->>'children_count')::integer, 0) AS children_count,
    COALESCE((item->>'is_system_protected')::boolean, false) AS is_system_protected,
    COALESCE((item->>'identity_locked')::boolean, false) AS identity_locked,
    COALESCE((item->>'can_delete_safe')::boolean, false) AS can_delete_safe,
    item->'metadata' AS metadata
  FROM listed
)
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
FROM normalized
WHERE can_delete_safe = true
ORDER BY display_code, name;

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
FROM normalized
WHERE identity_locked = true
ORDER BY display_code, name;

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
FROM normalized
WHERE is_system_protected = true
ORDER BY display_code, name;

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
FROM normalized
WHERE can_delete_safe = true
  AND (
    has_entries = true
    OR children_count > 0
    OR is_system_protected = true
  )
ORDER BY display_code, name;
