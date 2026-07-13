-- POS_9 — Diagnóstico de saúde das Contas Financeiras
-- Objetivo: conferir se cada loja possui as contas essenciais para o Livro Diário.
-- Uso: rode no SQL Editor do Supabase. Não altera dados.

WITH required_accounts AS (
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
  ) AS t(account_type, label, reason)
), stores_scope AS (
  SELECT id AS store_id, name AS store_name, slug AS store_slug
  FROM public.stores
), accounts AS (
  SELECT
    s.store_id,
    s.store_name,
    s.store_slug,
    r.account_type,
    r.label,
    r.reason,
    COUNT(a.id)::integer AS total_accounts,
    COUNT(a.id) FILTER (WHERE a.active = true)::integer AS active_accounts,
    COUNT(a.id) FILTER (WHERE a.is_default = true)::integer AS default_accounts,
    ARRAY_REMOVE(ARRAY_AGG(a.code ORDER BY a.sort_order, a.name), NULL) AS account_codes,
    ARRAY_REMOVE(ARRAY_AGG(a.name ORDER BY a.sort_order, a.name), NULL) AS account_names
  FROM stores_scope s
  CROSS JOIN required_accounts r
  LEFT JOIN public.store_financial_accounts a
    ON a.store_id = s.store_id
   AND a.account_type = r.account_type
  GROUP BY s.store_id, s.store_name, s.store_slug, r.account_type, r.label, r.reason
), account_code_duplicates AS (
  SELECT
    store_id,
    code,
    COUNT(*)::integer AS duplicate_count
  FROM public.store_financial_accounts
  GROUP BY store_id, code
  HAVING COUNT(*) > 1
), issues AS (
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
    default_accounts,
    account_codes,
    account_names
  FROM accounts
  WHERE active_accounts = 0

  UNION ALL

  SELECT
    'multiple_defaults_for_type' AS issue,
    store_id,
    store_name,
    store_slug,
    account_type,
    label,
    'Há mais de uma conta marcada como padrão para o mesmo tipo.' AS reason,
    total_accounts,
    active_accounts,
    default_accounts,
    account_codes,
    account_names
  FROM accounts
  WHERE default_accounts > 1

  UNION ALL

  SELECT
    'default_inactive_or_missing' AS issue,
    store_id,
    store_name,
    store_slug,
    account_type,
    label,
    'Existe conta do tipo, mas nenhuma conta ativa marcada como padrão.' AS reason,
    total_accounts,
    active_accounts,
    default_accounts,
    account_codes,
    account_names
  FROM accounts
  WHERE active_accounts > 0 AND default_accounts = 0
)
SELECT
  'summary' AS section,
  s.store_id,
  s.store_name,
  s.store_slug,
  COUNT(i.issue)::integer AS issue_count,
  COUNT(i.issue) FILTER (WHERE i.issue = 'missing_required_type')::integer AS missing_required_types,
  COUNT(i.issue) FILTER (WHERE i.issue = 'multiple_defaults_for_type')::integer AS multiple_defaults,
  COUNT(i.issue) FILTER (WHERE i.issue = 'default_inactive_or_missing')::integer AS missing_defaults
FROM stores_scope s
LEFT JOIN issues i ON i.store_id = s.store_id
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
  default_accounts,
  account_codes,
  account_names
FROM issues
ORDER BY store_name, issue, account_type;

SELECT
  'duplicate_codes' AS section,
  s.name AS store_name,
  s.slug AS store_slug,
  d.code,
  d.duplicate_count
FROM account_code_duplicates d
JOIN public.stores s ON s.id = d.store_id
ORDER BY s.name, d.code;
