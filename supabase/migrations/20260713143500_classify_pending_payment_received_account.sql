-- POS_9 — Classifica Recebimento pendente no plano de contas gerencial
-- Evita conta lancavel ativa solta no balancete.

UPDATE public.cashbook_account_plan
SET display_code = '1.2.1',
    parent_code = 'grp_revenue_other',
    name = 'Recebimentos pendentes',
    kind = 'income',
    nature = 'credit',
    is_group = false,
    is_postable = true,
    analysis_enabled = true,
    affects_financial_result = true,
    is_transfer = false,
    sort_order = 1210,
    path = '1/1.2/1.2.1',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'classified_in_hierarchy', true,
      'classification_reason', 'pending_payment_received_grouped_as_other_income',
      'updated_by_migration', '20260713143500_classify_pending_payment_received_account'
    ),
    updated_at = now()
WHERE code = 'pending_payment_received';
