-- POS_9 — Financeiro — pagamento pendente não compõe saldo do caixa
--
-- Objetivo:
-- - manter venda/pedido concluído mesmo com pagamento pendente;
-- - impedir que pagamento pendente gere novo lançamento efetivo de caixa;
-- - corrigir lançamentos de vendas pendentes já gerados, removendo impacto no saldo.
--
-- Regra de negócio:
-- pending = pagamento pendente / a combinar.
-- Enquanto estiver pendente, não entra no saldo do Livro Diário de Caixa.
-- Quando o pagamento for confirmado por fluxo próprio, aí sim deve gerar/ativar lançamento financeiro.

DO $$
DECLARE
  v_oid oid;
  v_definition text;
  v_new_definition text;
BEGIN
  SELECT p.oid
  INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_admin_direct_sale_order_safe'
    AND pg_get_function_identity_arguments(p.oid) = 'p_store_id uuid, p_items jsonb, p_customer_id uuid, p_customer_name text, p_customer_phone text, p_payment_method_code text, p_notes text, p_location_id uuid, p_sales_channel text, p_fulfillment_type text, p_create_customer_if_missing boolean, p_marketing_consent boolean, p_loyalty_opt_in boolean, p_metadata jsonb'
  LIMIT 1;

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Função create_admin_direct_sale_order_safe não encontrada para ajuste financeiro.';
  END IF;

  v_definition := pg_get_functiondef(v_oid);

  IF position('v_cashbook_result := public.create_cashbook_entry_from_order(v_order_id);' in v_definition) = 0 THEN
    RAISE NOTICE 'Trecho de geração do livro caixa não encontrado. A função pode já estar ajustada.';
    RETURN;
  END IF;

  v_new_definition := replace(
    v_definition,
    'v_cashbook_result := public.create_cashbook_entry_from_order(v_order_id);',
    'IF v_payment_code <> ''pending'' AND COALESCE(v_payment_affects_cashbook, true) = true THEN
    v_cashbook_result := public.create_cashbook_entry_from_order(v_order_id);
  ELSE
    v_cashbook_result := jsonb_build_object(
      ''ok'', true,
      ''skipped'', true,
      ''reason'', CASE
        WHEN v_payment_code = ''pending'' THEN ''payment_pending''
        ELSE ''payment_method_does_not_affect_cashbook''
      END,
      ''payment_method_code'', v_payment_code,
      ''affects_cashbook'', COALESCE(v_payment_affects_cashbook, true)
    );
  END IF;'
  );

  EXECUTE v_new_definition;
END $$;

-- Corrige lançamentos já criados para pedidos/vendas com pagamento pendente.
-- Eles permanecem no histórico, mas deixam de compor saldo.
UPDATE public.cashbook_entries ce
SET
  affects_balance = false,
  status = CASE
    WHEN COALESCE(ce.status, 'active') IN ('cancelled', 'canceled', 'voided') THEN ce.status
    ELSE 'pending'
  END,
  metadata = COALESCE(ce.metadata, '{}'::jsonb) || jsonb_build_object(
    'pending_payment_excluded_from_balance', true,
    'corrected_by', '20260630153000_fix_pending_cashbook_balance',
    'corrected_at', now()
  ),
  updated_at = now()
FROM public.orders o
WHERE ce.order_id = o.id
  AND ce.store_id = o.store_id
  AND ce.type = 'sale'
  AND COALESCE(o.payment_method_code, o.payment_method::text, '') = 'pending'
  AND COALESCE(ce.affects_balance, true) = true;

REVOKE ALL ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_admin_direct_sale_order_safe(
  uuid,
  jsonb,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  text,
  text,
  boolean,
  boolean,
  boolean,
  jsonb
) TO service_role;
