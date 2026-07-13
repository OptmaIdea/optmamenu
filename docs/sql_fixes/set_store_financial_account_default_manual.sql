-- POS_9 — Correção manual de conta financeira padrão
-- Objetivo: definir a conta padrão ativa de um tipo quando existe mais de uma opção ativa.
-- Uso: ajuste os valores em params e rode no SQL Editor.
-- Este script atualiza apenas a loja/tipo informados.

WITH params AS (
  SELECT
    'gelinharessjn'::text AS p_store_slug,
    'pix_wallet'::text AS p_account_type,
    '542'::text AS p_default_code -- Gelinhares: InfinitePay
), target_store AS (
  SELECT s.id AS store_id, s.name AS store_name, s.slug AS store_slug
  FROM public.stores s
  JOIN params p ON p.p_store_slug = s.slug
), target_account AS (
  SELECT a.id, a.store_id, a.code, a.name, a.account_type
  FROM public.store_financial_accounts a
  JOIN target_store s ON s.store_id = a.store_id
  JOIN params p ON p.p_account_type = a.account_type
               AND p.p_default_code = a.code
  WHERE a.active = true
), validation AS (
  SELECT
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM target_store) THEN 'store_not_found'
      WHEN NOT EXISTS (SELECT 1 FROM target_account) THEN 'active_account_not_found'
      ELSE 'ok'
    END AS status
), reset_same_type AS (
  UPDATE public.store_financial_accounts a
  SET
    is_default = false,
    updated_at = now(),
    metadata = COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object(
      'default_reset_from_manual_fix', true,
      'default_reset_at', now()
    )
  FROM target_store s, params p, validation v
  WHERE v.status = 'ok'
    AND a.store_id = s.store_id
    AND a.account_type = p.p_account_type
  RETURNING a.id
), set_default AS (
  UPDATE public.store_financial_accounts a
  SET
    is_default = true,
    updated_at = now(),
    metadata = COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object(
      'default_defined_from_manual_fix', true,
      'default_defined_at', now()
    )
  FROM target_account t, validation v
  WHERE v.status = 'ok'
    AND a.id = t.id
  RETURNING a.id, a.store_id, a.code, a.name, a.account_type, a.is_default
)
SELECT
  v.status,
  s.store_name,
  s.store_slug,
  d.account_type,
  d.code AS default_code,
  d.name AS default_name,
  d.is_default
FROM validation v
LEFT JOIN target_store s ON true
LEFT JOIN set_default d ON true;
