-- POS_9 — Diagnóstico de saúde das Contas Financeiras
-- Objetivo: conferir se cada loja possui as contas essenciais para o Livro Diário.
-- Uso: rode no SQL Editor do Supabase. Não altera dados.
-- Observação: usa tabelas temporárias porque CTEs só valem para um único SELECT.

DROP TABLE IF EXISTS tmp_store_financial_accounts_required;
DROP TABLE IF EXISTS tmp_store_financial_accounts_stores_scope;
DROP TABLE IF EXISTS tmp_store_financial_accounts_accounts;
DROP TABLE IF EXISTS tmp_store_financial_accounts_duplicates;
DROP TABLE IF EXISTS tmp_store_financial_accounts_issues;

CREATE TEMP TABLE tmp_store_financial_accounts_required AS
SELECT *
FROM (
  VALUES
    ('cash_drawer', 'Caixa físico', 'Obrigatória para dinheiro no balcão, sangria, reforço de troco e fechamento de caixa.'),
    ('safe', 'Cofre', 'Recomendada para sangrias e guarda de dinheiro fora do caixa físico.'),
    ('bank', 'Banco', 'Obrigatória para depósitos, pagamentos bancários e conciliação.'),
    ('pix_wallet', 'Carteira Pix', 'Obrigatória para vendas e recebimentos via Pix.'),
    ('card_acquirer', 'Maquininha', 'Recomendada para identificar origem operacional das vendas em cartão.'),
    ('card_receivable', 'Recebíveis de cartão', 'Obrigatória para valores a receber de cartão antes de cair no banco.'),
    ('owner', 'Proprietário', 'Recomendada para aportes, retiradas e empréstimos do proprietário.')
) AS t(account_type, label, reason);

CREATE TEMP TABLE tmp_store_financial_accounts_stores_scope AS
SELECT id AS store_id, name AS store_name, slug AS store_slug
FROM public.stores;

CREATE TEMP TABLE tmp_store_financial_accounts_accounts AS
SELECT
  s.store_id,
  s.store_name,
  s.store_slug,
  r.account_type,
  r.label,
  r.reason,
  COUNT(a.id)::integer AS total_accounts,
  COUNT(a.id) FILTER (WHERE a.active = true)::integer AS active_accounts,
  COUNT(a.id) FILTER (WHERE a.active = true AND a.is_default = true)::integer AS active_default_accounts,
  COUNT(a.id) FILTER (WHERE a.is_default = true)::integer AS default_accounts,
  ARRAY_REMOVE(ARRAY_AGG(a.code ORDER BY a.sort_order, a.name), NULL) AS account_codes,
  ARRAY_REMOVE(ARRAY_AGG(a.name ORDER BY a.sort_order, a.name), NULL) AS account_names
FROM tmp_store_financial_accounts_stores_scope s
CROSS JOIN tmp_store_financial_accounts_required r
LEFT JOIN public.store_financial_accounts a
  ON a.store_id = s.store_id
 AND a.account_type = r.account_type
GROUP BY s.store_id, s.store_name, s.store_slug, r.account_type, r.label, r.reason;

CREATE TEMP TABLE tmp_store_financial_accounts_duplicates AS
SELECT
  store_id,
  code,
  COUNT(*)::integer AS duplicate_count
FROM public.store_financial_accounts
GROUP BY store_id, code
HAVING COUNT(*) > 1;

CREATE TEMP TABLE tmp_store_financial_accounts_issues AS
SELECT
  'missing_required_type' AS issue,
  store_id,
  store_name,
  store_slug,
  account_type,
  label,
  reason,
  total_accounts,
  active_accounts,
  active_default_accounts,
  default_accounts,
  account_codes,
  account_names
FROM tmp_store_financial_accounts_accounts
WHERE active_accounts = 0

UNION ALL

SELECT
  'multiple_active_defaults_for_type' AS issue,
  store_id,
  store_name,
  store_slug,
  account_type,
  label,
  'Há mais de uma conta ativa marcada como padrão para o mesmo tipo.' AS reason,
  total_accounts,
  active_accounts,
  active_default_accounts,
  default_accounts,
  account_codes,
  account_names
FROM tmp_store_financial_accounts_accounts
WHERE active_default_accounts > 1

UNION ALL

SELECT
  'active_default_missing' AS issue,
  store_id,
  store_name,
  store_slug,
  account_type,
  label,
  'Existe conta ativa do tipo, mas nenhuma conta ativa marcada como padrão.' AS reason,
  total_accounts,
  active_accounts,
  active_default_accounts,
  default_accounts,
  account_codes,
  account_names
FROM tmp_store_financial_accounts_accounts
WHERE active_accounts > 0 AND active_default_accounts = 0;

SELECT
  'summary' AS section,
  s.store_id,
  s.store_name,
  s.store_slug,
  COUNT(i.issue)::integer AS issue_count,
  COUNT(i.issue) FILTER (WHERE i.issue = 'missing_required_type')::integer AS missing_required_types,
  COUNT(i.issue) FILTER (WHERE i.issue = 'multiple_active_defaults_for_type')::integer AS multiple_active_defaults,
  COUNT(i.issue) FILTER (WHERE i.issue = 'active_default_missing')::integer AS missing_active_defaults
FROM tmp_store_financial_accounts_stores_scope s
LEFT JOIN tmp_store_financial_accounts_issues i ON i.store_id = s.store_id
GROUP BY s.store_id, s.store_name, s.store_slug
ORDER BY s.store_name;

SELECT
  'issues' AS section,
  issue,
  store_name,
  store_slug,
  account_type,
  label,
  reason,
  total_accounts,
  active_accounts,
  active_default_accounts,
  default_accounts,
  account_codes,
  account_names
FROM tmp_store_financial_accounts_issues
ORDER BY store_name, issue, account_type;

SELECT
  'duplicate_codes' AS section,
  s.store_name,
  s.store_slug,
  d.code,
  d.duplicate_count
FROM tmp_store_financial_accounts_duplicates d
JOIN tmp_store_financial_accounts_stores_scope s ON s.store_id = d.store_id
ORDER BY s.store_name, d.code;
