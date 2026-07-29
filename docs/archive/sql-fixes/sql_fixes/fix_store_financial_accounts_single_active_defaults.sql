-- POS_9 — Saneamento seguro de padrões das Contas Financeiras
-- Objetivo: marcar automaticamente como padrão apenas quando há exatamente UMA conta ativa do tipo na loja.
-- Uso: rode no SQL Editor do Supabase após revisar o bloco preview.
-- Observação: tipos com mais de uma conta ativa ficam pendentes para escolha manual.

BEGIN;

-- 1) Preview das contas que serão marcadas automaticamente como padrão.
WITH active_type_counts AS (
  SELECT
    store_id,
    account_type,
    COUNT(*) FILTER (WHERE active = true)::integer AS active_accounts,
    COUNT(*) FILTER (WHERE active = true AND is_default = true)::integer AS active_default_accounts
  FROM public.store_financial_accounts
  GROUP BY store_id, account_type
), auto_default_candidates AS (
  SELECT
    a.id,
    s.name AS store_name,
    s.slug AS store_slug,
    a.account_type,
    a.code,
    a.name AS account_name
  FROM public.store_financial_accounts a
  JOIN active_type_counts c
    ON c.store_id = a.store_id
   AND c.account_type = a.account_type
  JOIN public.stores s ON s.id = a.store_id
  WHERE a.active = true
    AND a.is_default = false
    AND c.active_accounts = 1
    AND c.active_default_accounts = 0
)
SELECT
  'will_set_default' AS section,
  store_name,
  store_slug,
  account_type,
  code,
  account_name
FROM auto_default_candidates
ORDER BY store_name, account_type, account_name;

-- 2) Atualiza somente os casos inequívocos: um único ativo e nenhum padrão ativo.
WITH active_type_counts AS (
  SELECT
    store_id,
    account_type,
    COUNT(*) FILTER (WHERE active = true)::integer AS active_accounts,
    COUNT(*) FILTER (WHERE active = true AND is_default = true)::integer AS active_default_accounts
  FROM public.store_financial_accounts
  GROUP BY store_id, account_type
), auto_default_candidates AS (
  SELECT a.id
  FROM public.store_financial_accounts a
  JOIN active_type_counts c
    ON c.store_id = a.store_id
   AND c.account_type = a.account_type
  WHERE a.active = true
    AND a.is_default = false
    AND c.active_accounts = 1
    AND c.active_default_accounts = 0
)
UPDATE public.store_financial_accounts a
SET
  is_default = true,
  updated_at = now(),
  metadata = COALESCE(a.metadata, '{}'::jsonb) || jsonb_build_object(
    'default_set_by', 'fix_store_financial_accounts_single_active_defaults',
    'default_set_at', now()
  )
FROM auto_default_candidates c
WHERE a.id = c.id;

-- 3) Mostra os casos que ainda precisam de decisão manual.
-- Exemplo atual esperado: Gelinhares / pix_wallet, pois há Carteira Pix e InfinitePay ativas.
WITH active_type_counts AS (
  SELECT
    store_id,
    account_type,
    COUNT(*) FILTER (WHERE active = true)::integer AS active_accounts,
    COUNT(*) FILTER (WHERE active = true AND is_default = true)::integer AS active_default_accounts
  FROM public.store_financial_accounts
  GROUP BY store_id, account_type
)
SELECT
  'manual_default_needed' AS section,
  s.name AS store_name,
  s.slug AS store_slug,
  a.account_type,
  ARRAY_AGG(a.code ORDER BY a.sort_order, a.name) FILTER (WHERE a.active = true) AS active_codes,
  ARRAY_AGG(a.name ORDER BY a.sort_order, a.name) FILTER (WHERE a.active = true) AS active_names
FROM active_type_counts c
JOIN public.stores s ON s.id = c.store_id
JOIN public.store_financial_accounts a
  ON a.store_id = c.store_id
 AND a.account_type = c.account_type
WHERE c.active_accounts > 1
  AND c.active_default_accounts = 0
GROUP BY s.name, s.slug, a.account_type
ORDER BY s.name, a.account_type;

-- 4) Se o preview estiver correto, mantenha COMMIT.
-- Para testar sem gravar, troque COMMIT por ROLLBACK antes de executar.
COMMIT;

-- 5) Após executar, rode novamente:
-- docs/sql_diagnostics/validate_store_financial_accounts_health.sql
