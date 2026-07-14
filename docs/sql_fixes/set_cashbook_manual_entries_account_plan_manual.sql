-- POS_9 — Modelo seguro para classificar manualmente lançamentos do Livro Diário
-- Objetivo: permitir revisão manual de account_plan_code por entry_code.
--
-- Este arquivo NÃO deve decidir categorias automaticamente.
-- Preencha a tabela temporária tmp_cashbook_manual_account_plan_decisions com os códigos escolhidos.
-- Rode primeiro a PRÉVIA. Só depois mantenha o UPDATE habilitado.
--
-- Exemplo de uso:
--   ('CXA-20260505-163801-F263', 'expense_supplies', 'Mercado Central — compra operacional')
--
-- Importante:
-- - Use somente contas postáveis e ativas do plano de contas.
-- - Não reutilize uma categoria antiga com sentido diferente.
-- - Lançamentos de teste podem ser classificados em uma categoria própria de ajuste/teste
--   ou permanecer sem classificação se forem removidos/cancelados em fluxo próprio.

CREATE TEMP TABLE tmp_cashbook_manual_account_plan_decisions (
  entry_code text PRIMARY KEY,
  account_plan_code text NOT NULL,
  review_reason text NOT NULL
);

-- Preencha abaixo somente depois de decidir a categoria correta.
-- INSERT INTO tmp_cashbook_manual_account_plan_decisions (entry_code, account_plan_code, review_reason)
-- VALUES
--   ('CXA-20260706-220017-66F0', 'expense_other', 'Teste classificação de lançamento'),
--   ('CXA-20260706-215949-38CF', 'income_other', 'Teste classificação de lançamento PIX'),
--   ('CXA-20260706-222329-3920', 'expense_other', 'Teste'),
--   ('CXA-20260706-215932-0BD7', 'income_other', 'Teste classificação de lançamento'),
--   ('CXA-20260505-163801-F263', 'expense_supplies', 'Mercado Central'),
--   ('CXA-20260502-150614-CFC8', 'expense_other', 'Saída manual de teste'),
--   ('CXA-20260502-150523-20D9', 'income_other', 'Entrada manual de teste');

-- PRÉVIA: mostra se os lançamentos e contas existem, estão ativos e são postáveis.
SELECT
  'preview' AS section,
  d.entry_code,
  e.store_id,
  s.name AS store_name,
  s.slug AS store_slug,
  e.entry_date,
  e.type,
  e.direction,
  COALESCE(e.payment_method_code, e.payment_method) AS payment_method,
  e.amount,
  e.description,
  d.account_plan_code,
  p.name AS account_plan_name,
  p.active AS account_plan_active,
  COALESCE(p.is_postable, true) AS account_plan_postable,
  d.review_reason,
  CASE
    WHEN e.id IS NULL THEN 'entry_not_found'
    WHEN e.account_plan_code IS NOT NULL THEN 'entry_already_classified'
    WHEN p.code IS NULL THEN 'account_plan_not_found'
    WHEN p.active IS DISTINCT FROM true THEN 'account_plan_inactive'
    WHEN COALESCE(p.is_postable, true) IS DISTINCT FROM true THEN 'account_plan_not_postable'
    ELSE 'ready_to_apply'
  END AS validation_status
FROM tmp_cashbook_manual_account_plan_decisions d
LEFT JOIN public.cashbook_entries e ON e.entry_code = d.entry_code
LEFT JOIN public.stores s ON s.id = e.store_id
LEFT JOIN public.cashbook_account_plan p ON p.code = d.account_plan_code
ORDER BY e.entry_date DESC NULLS LAST, d.entry_code;

-- APLICAÇÃO: deixe comentado até conferir a prévia.
-- UPDATE public.cashbook_entries e
-- SET
--   account_plan_code = d.account_plan_code,
--   metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
--     'manual_account_plan_review_applied_at', now(),
--     'manual_account_plan_review_source', 'set_cashbook_manual_entries_account_plan_manual',
--     'manual_account_plan_review_reason', d.review_reason,
--     'manual_account_plan_code', d.account_plan_code
--   ),
--   updated_at = now()
-- FROM tmp_cashbook_manual_account_plan_decisions d
-- JOIN public.cashbook_account_plan p ON p.code = d.account_plan_code
-- WHERE e.entry_code = d.entry_code
--   AND e.account_plan_code IS NULL
--   AND p.active = true
--   AND COALESCE(p.is_postable, true) = true;

-- PÓS-CHECAGEM: rode depois de aplicar o UPDATE.
SELECT
  'post_check' AS section,
  d.entry_code,
  e.entry_date,
  e.type,
  e.direction,
  e.description,
  e.account_plan_code,
  p.name AS account_plan_name
FROM tmp_cashbook_manual_account_plan_decisions d
JOIN public.cashbook_entries e ON e.entry_code = d.entry_code
LEFT JOIN public.cashbook_account_plan p ON p.code = e.account_plan_code
ORDER BY e.entry_date DESC, d.entry_code;
