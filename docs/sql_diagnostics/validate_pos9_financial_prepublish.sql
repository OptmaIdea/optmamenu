-- POS_9 / v0.9.14 — Diagnóstico financeiro de pré-publicação
-- Objetivo: validar o fechamento financeiro antes de permissões, slug, vendas online,
-- WhatsApp básico, manual do usuário e publicação na Vercel.
--
-- Uso: rode no SQL Editor do Supabase.
-- Este diagnóstico é somente leitura. Não altera dados.

WITH manual_expected AS (
  SELECT *
  FROM (VALUES
    ('other_income', 'Outras entradas', 'in'),
    ('other_expense', 'Outras saídas', 'out')
  ) AS t(code, expected_name, expected_direction)
),
manual_expected_status AS (
  SELECT
    m.code,
    m.expected_name,
    m.expected_direction,
    p.display_code,
    p.name,
    p.active,
    p.is_group,
    p.is_postable,
    p.metadata ->> 'manual_cashbook_direction' AS manual_cashbook_direction,
    p.metadata ->> 'manual_cashbook_hidden' AS manual_cashbook_hidden,
    p.metadata ->> 'requires_notes' AS requires_notes,
    CASE
      WHEN p.code IS NULL THEN 'missing_category'
      WHEN p.active IS DISTINCT FROM true THEN 'inactive_category'
      WHEN p.is_group IS TRUE THEN 'category_is_group'
      WHEN p.is_postable IS DISTINCT FROM true THEN 'category_not_postable'
      WHEN p.metadata ->> 'manual_cashbook_direction' IS DISTINCT FROM m.expected_direction THEN 'wrong_manual_direction'
      WHEN COALESCE((p.metadata ->> 'requires_notes')::boolean, false) IS DISTINCT FROM true THEN 'missing_requires_notes'
      WHEN COALESCE((p.metadata ->> 'manual_cashbook_hidden')::boolean, false) IS TRUE THEN 'wrongly_hidden'
      ELSE 'ok'
    END AS status
  FROM manual_expected m
  LEFT JOIN public.cashbook_account_plan p ON p.code = m.code
),
sale_flow_categories AS (
  SELECT
    p.code,
    p.display_code,
    p.name,
    p.kind,
    p.nature,
    p.active,
    p.is_group,
    p.is_postable,
    p.metadata ->> 'manual_cashbook_direction' AS manual_cashbook_direction,
    p.metadata ->> 'manual_cashbook_hidden' AS manual_cashbook_hidden,
    p.metadata ->> 'manual_cashbook_hidden_reason' AS manual_cashbook_hidden_reason,
    CASE
      WHEN COALESCE((p.metadata ->> 'manual_cashbook_hidden')::boolean, false) IS DISTINCT FROM true THEN 'not_hidden'
      WHEN p.metadata ? 'manual_cashbook_direction' THEN 'hidden_but_has_direction'
      ELSE 'ok'
    END AS status
  FROM public.cashbook_account_plan p
  WHERE p.code IN (
    'sale_cash',
    'sale_pix',
    'sale_debit',
    'sale_credit',
    'refund',
    'sale_refund',
    'sales_refund',
    'sales_returns',
    'sales_cancellation',
    'sale_cancellation',
    'sale_cancelled',
    'sales_cancellations'
  )
  OR p.display_code IN ('1.1.3', '1.1.4', '2.7.3')
  OR lower(p.name) LIKE '%devolu%venda%'
  OR lower(p.name) LIKE '%cancelamento%venda%'
  OR lower(p.name) LIKE '%cancelamentos%sobre%venda%'
),
account_plan_gaps AS (
  SELECT
    s.name AS store_name,
    s.slug AS store_slug,
    COUNT(e.id)::integer AS issue_count,
    jsonb_agg(
      jsonb_build_object(
        'entry_code', e.entry_code,
        'entry_date', e.entry_date,
        'type', e.type,
        'direction', e.direction,
        'payment_method', lower(COALESCE(e.payment_method_code, e.payment_method, '')),
        'amount', e.amount,
        'description', e.description
      )
      ORDER BY e.entry_date DESC, e.created_at DESC
    ) FILTER (WHERE e.id IS NOT NULL) AS samples
  FROM public.stores s
  LEFT JOIN public.cashbook_entries e
    ON e.store_id = s.id
   AND e.account_plan_code IS NULL
   AND e.status NOT IN ('cancelled', 'canceled', 'voided')
   AND e.affects_balance IS DISTINCT FROM false
  GROUP BY s.name, s.slug
),
required_notes_violations AS (
  SELECT
    s.name AS store_name,
    s.slug AS store_slug,
    COUNT(e.id)::integer AS issue_count,
    jsonb_agg(
      jsonb_build_object(
        'entry_code', e.entry_code,
        'entry_date', e.entry_date,
        'account_plan_code', e.account_plan_code,
        'account_plan_name', p.name,
        'description', e.description,
        'notes', e.notes
      )
      ORDER BY e.entry_date DESC, e.created_at DESC
    ) FILTER (WHERE e.id IS NOT NULL) AS samples
  FROM public.stores s
  LEFT JOIN public.cashbook_entries e
    ON e.store_id = s.id
   AND e.status NOT IN ('cancelled', 'canceled', 'voided')
  LEFT JOIN public.cashbook_account_plan p
    ON p.code = e.account_plan_code
   AND COALESCE((p.metadata ->> 'requires_notes')::boolean, false) IS TRUE
  WHERE e.id IS NULL
     OR (
       p.code IS NOT NULL
       AND (
         COALESCE(trim(e.description), '') = ''
         OR COALESCE(trim(e.notes), '') = ''
       )
     )
  GROUP BY s.name, s.slug
),
financial_account_gaps AS (
  SELECT
    s.name AS store_name,
    s.slug AS store_slug,
    COUNT(e.id)::integer AS issue_count,
    jsonb_agg(
      jsonb_build_object(
        'entry_code', e.entry_code,
        'entry_date', e.entry_date,
        'type', e.type,
        'direction', e.direction,
        'payment_method', lower(COALESCE(e.payment_method_code, e.payment_method, '')),
        'amount', e.amount,
        'missing_side', CASE
          WHEN e.direction = 'in' AND e.destination_financial_account_id IS NULL THEN 'destination_financial_account_id'
          WHEN e.direction = 'out' AND e.source_financial_account_id IS NULL THEN 'source_financial_account_id'
          ELSE 'unknown'
        END
      )
      ORDER BY e.entry_date DESC, e.created_at DESC
    ) FILTER (WHERE e.id IS NOT NULL) AS samples
  FROM public.stores s
  LEFT JOIN public.cashbook_entries e
    ON e.store_id = s.id
   AND e.status NOT IN ('cancelled', 'canceled', 'voided')
   AND e.affects_balance IS DISTINCT FROM false
   AND lower(COALESCE(e.payment_method_code, e.payment_method, '')) <> 'pending'
   AND (
     (e.direction = 'in' AND e.destination_financial_account_id IS NULL)
     OR (e.direction = 'out' AND e.source_financial_account_id IS NULL)
   )
  GROUP BY s.name, s.slug
),
cash_drawer_flag_gaps AS (
  SELECT
    s.name AS store_name,
    s.slug AS store_slug,
    COUNT(e.id)::integer AS issue_count,
    jsonb_agg(
      jsonb_build_object(
        'entry_code', e.entry_code,
        'entry_date', e.entry_date,
        'type', e.type,
        'direction', e.direction,
        'payment_method', lower(COALESCE(e.payment_method_code, e.payment_method, '')),
        'affects_cash_drawer', e.affects_cash_drawer,
        'amount', e.amount
      )
      ORDER BY e.entry_date DESC, e.created_at DESC
    ) FILTER (WHERE e.id IS NOT NULL) AS samples
  FROM public.stores s
  LEFT JOIN public.cashbook_entries e
    ON e.store_id = s.id
   AND e.status NOT IN ('cancelled', 'canceled', 'voided')
   AND e.affects_balance IS DISTINCT FROM false
   AND (
     (lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('cash', 'dinheiro') AND e.affects_cash_drawer IS DISTINCT FROM true)
     OR (lower(COALESCE(e.payment_method_code, e.payment_method, '')) IN ('pix', 'card', 'debit_card', 'credit_card') AND e.affects_cash_drawer IS DISTINCT FROM false)
   )
  GROUP BY s.name, s.slug
),
default_account_health AS (
  SELECT
    s.name AS store_name,
    s.slug AS store_slug,
    required.account_type,
    COUNT(a.id) FILTER (WHERE a.active = true)::integer AS active_count,
    COUNT(a.id) FILTER (WHERE a.active = true AND a.is_default = true)::integer AS active_default_count,
    jsonb_agg(
      jsonb_build_object(
        'code', a.code,
        'name', a.name,
        'active', a.active,
        'is_default', a.is_default
      )
      ORDER BY a.sort_order, a.name
    ) FILTER (WHERE a.id IS NOT NULL) AS accounts
  FROM public.stores s
  CROSS JOIN (VALUES
    ('cash_drawer'),
    ('pix_wallet'),
    ('card_receivable')
  ) AS required(account_type)
  LEFT JOIN public.store_financial_accounts a
    ON a.store_id = s.id
   AND a.account_type = required.account_type
  GROUP BY s.name, s.slug, required.account_type
),
entry_reference_gaps AS (
  SELECT
    s.name AS store_name,
    s.slug AS store_slug,
    COUNT(e.id)::integer AS issue_count,
    jsonb_agg(
      jsonb_build_object(
        'entry_code', e.entry_code,
        'entry_date', e.entry_date,
        'account_plan_code', e.account_plan_code,
        'source_financial_account_id', e.source_financial_account_id,
        'destination_financial_account_id', e.destination_financial_account_id,
        'issue', CASE
          WHEN e.account_plan_code IS NOT NULL AND p.code IS NULL THEN 'missing_account_plan_reference'
          WHEN e.source_financial_account_id IS NOT NULL AND src.id IS NULL THEN 'missing_source_financial_account_reference'
          WHEN e.destination_financial_account_id IS NOT NULL AND dst.id IS NULL THEN 'missing_destination_financial_account_reference'
          ELSE 'unknown'
        END
      )
      ORDER BY e.entry_date DESC, e.created_at DESC
    ) FILTER (WHERE e.id IS NOT NULL) AS samples
  FROM public.stores s
  LEFT JOIN public.cashbook_entries e
    ON e.store_id = s.id
   AND e.status NOT IN ('cancelled', 'canceled', 'voided')
  LEFT JOIN public.cashbook_account_plan p ON p.code = e.account_plan_code
  LEFT JOIN public.store_financial_accounts src ON src.id = e.source_financial_account_id
  LEFT JOIN public.store_financial_accounts dst ON dst.id = e.destination_financial_account_id
  WHERE e.id IS NULL
     OR (
       (e.account_plan_code IS NOT NULL AND p.code IS NULL)
       OR (e.source_financial_account_id IS NOT NULL AND src.id IS NULL)
       OR (e.destination_financial_account_id IS NOT NULL AND dst.id IS NULL)
     )
  GROUP BY s.name, s.slug
),
result_rows AS (
  SELECT
    'manual_categories_expected' AS section,
    CASE WHEN COUNT(*) FILTER (WHERE status <> 'ok') = 0 THEN 'ok' ELSE 'error' END AS severity,
    NULL::text AS store_name,
    NULL::text AS store_slug,
    COUNT(*) FILTER (WHERE status <> 'ok')::integer AS issue_count,
    jsonb_agg(to_jsonb(manual_expected_status) ORDER BY code) AS details
  FROM manual_expected_status

  UNION ALL

  SELECT
    'sale_flow_categories_hidden' AS section,
    CASE WHEN COUNT(*) FILTER (WHERE status <> 'ok') = 0 THEN 'ok' ELSE 'error' END AS severity,
    NULL::text AS store_name,
    NULL::text AS store_slug,
    COUNT(*) FILTER (WHERE status <> 'ok')::integer AS issue_count,
    jsonb_agg(to_jsonb(sale_flow_categories) ORDER BY display_code NULLS LAST, code) AS details
  FROM sale_flow_categories

  UNION ALL

  SELECT
    'cashbook_missing_account_plan' AS section,
    CASE WHEN issue_count = 0 THEN 'ok' ELSE 'warning' END AS severity,
    store_name,
    store_slug,
    issue_count,
    COALESCE(samples, '[]'::jsonb) AS details
  FROM account_plan_gaps

  UNION ALL

  SELECT
    'cashbook_required_notes_violations' AS section,
    CASE WHEN issue_count = 0 THEN 'ok' ELSE 'error' END AS severity,
    store_name,
    store_slug,
    issue_count,
    COALESCE(samples, '[]'::jsonb) AS details
  FROM required_notes_violations

  UNION ALL

  SELECT
    'cashbook_missing_financial_account' AS section,
    CASE WHEN issue_count = 0 THEN 'ok' ELSE 'error' END AS severity,
    store_name,
    store_slug,
    issue_count,
    COALESCE(samples, '[]'::jsonb) AS details
  FROM financial_account_gaps

  UNION ALL

  SELECT
    'cashbook_cash_drawer_flag_gaps' AS section,
    CASE WHEN issue_count = 0 THEN 'ok' ELSE 'error' END AS severity,
    store_name,
    store_slug,
    issue_count,
    COALESCE(samples, '[]'::jsonb) AS details
  FROM cash_drawer_flag_gaps

  UNION ALL

  SELECT
    'financial_default_accounts' AS section,
    CASE
      WHEN active_count = 0 THEN 'error'
      WHEN active_default_count <> 1 THEN 'warning'
      ELSE 'ok'
    END AS severity,
    store_name,
    store_slug,
    CASE
      WHEN active_count = 0 THEN 1
      WHEN active_default_count <> 1 THEN 1
      ELSE 0
    END AS issue_count,
    jsonb_build_object(
      'account_type', account_type,
      'active_count', active_count,
      'active_default_count', active_default_count,
      'accounts', COALESCE(accounts, '[]'::jsonb)
    ) AS details
  FROM default_account_health

  UNION ALL

  SELECT
    'cashbook_reference_gaps' AS section,
    CASE WHEN issue_count = 0 THEN 'ok' ELSE 'error' END AS severity,
    store_name,
    store_slug,
    issue_count,
    COALESCE(samples, '[]'::jsonb) AS details
  FROM entry_reference_gaps
)
SELECT
  section,
  severity,
  store_name,
  store_slug,
  issue_count,
  details
FROM result_rows
ORDER BY
  CASE severity
    WHEN 'error' THEN 1
    WHEN 'warning' THEN 2
    ELSE 3
  END,
  section,
  store_name NULLS FIRST,
  store_slug NULLS FIRST;
