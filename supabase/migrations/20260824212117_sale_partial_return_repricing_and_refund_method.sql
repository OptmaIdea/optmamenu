-- Reprice partial returns against the quantities retained after the return and allow
-- the operator to choose the actual refund payment method independently from the
-- original sale payment method.

-- 1) Keep an immutable pricing-rules snapshot in new central pricing quotes/orders.
DO $$
BEGIN
  IF to_regprocedure('public.calculate_store_cart_pricing_internal_v2(uuid,jsonb)') IS NULL THEN
    ALTER FUNCTION public.calculate_store_cart_pricing(uuid, jsonb)
      RENAME TO calculate_store_cart_pricing_internal_v2;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.calculate_store_cart_pricing(
  p_store_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
  v_items jsonb;
BEGIN
  v_result := public.calculate_store_cart_pricing_internal_v2(p_store_id, p_items);

  IF COALESCE((v_result->>'ok')::boolean, false) = false THEN
    RETURN v_result;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      item || jsonb_build_object(
        'pricing_rules_snapshot',
          CASE item->>'pricing_source'
            WHEN 'pricing_group_combined_volume' THEN COALESCE((
              SELECT pg.price_rules
              FROM public.pricing_groups pg
              WHERE pg.id = NULLIF(item->>'pricing_group_id', '')::uuid
                AND pg.store_id = p_store_id
              LIMIT 1
            ), '[]'::jsonb)
            WHEN 'category_combined_volume' THEN COALESCE((
              SELECT c.price_rules
              FROM public.categories c
              WHERE c.id = NULLIF(item->>'category_id', '')::uuid
                AND c.store_id = p_store_id
              LIMIT 1
            ), '[]'::jsonb)
            WHEN 'category_product_volume' THEN COALESCE((
              SELECT c.price_rules
              FROM public.categories c
              WHERE c.id = NULLIF(item->>'category_id', '')::uuid
                AND c.store_id = p_store_id
              LIMIT 1
            ), '[]'::jsonb)
            WHEN 'category_standard' THEN COALESCE((
              SELECT c.price_rules
              FROM public.categories c
              WHERE c.id = NULLIF(item->>'category_id', '')::uuid
                AND c.store_id = p_store_id
              LIMIT 1
            ), '[]'::jsonb)
            WHEN 'product_volume' THEN COALESCE((
              SELECT p.price_rules
              FROM public.products p
              WHERE p.id = NULLIF(item->>'product_id', '')::uuid
                AND p.store_id = p_store_id
              LIMIT 1
            ), '[]'::jsonb)
            WHEN 'product_standard' THEN COALESCE((
              SELECT p.price_rules
              FROM public.products p
              WHERE p.id = NULLIF(item->>'product_id', '')::uuid
                AND p.store_id = p_store_id
              LIMIT 1
            ), '[]'::jsonb)
            ELSE '[]'::jsonb
          END,
        'pricing_snapshot_version', 3
      )
      ORDER BY item->>'product_name'
    ),
    '[]'::jsonb
  )
  INTO v_items
  FROM jsonb_array_elements(COALESCE(v_result->'items', '[]'::jsonb)) item;

  v_result := jsonb_set(v_result, '{items}', v_items, true)
    || jsonb_build_object('engine_version', 3);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_store_cart_pricing(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_store_cart_pricing(uuid, jsonb) TO service_role;

-- 2) Quote a partial return using the quantity that remains in the original sale.
-- Volume discounts are recalculated; proportional manual discounts remain attached
-- to the units that stay with the customer.
CREATE OR REPLACE FUNCTION public.quote_completed_sale_partial_return_safe(
  p_store_id uuid,
  p_order_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_order record;
  v_requested_count integer := 0;
  v_distinct_count integer := 0;
  v_matched_count integer := 0;
  v_invalid_count integer := 0;
  v_previous_refunded numeric := 0;
  v_retained_total numeric := 0;
  v_selected_original_value numeric := 0;
  v_cumulative_entitlement numeric := 0;
  v_refund_amount numeric := 0;
  v_repricing_adjustment numeric := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF p_store_id IS NULL OR p_order_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_parameters');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'items_required');
  END IF;

  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR (
        (
          public.user_has_store_permission_v2(p_store_id, 'orders.cancel')
          OR public.user_has_store_permission_v2(p_store_id, 'orders.manage')
        )
        AND public.user_has_store_permission_v2(p_store_id, 'stock.adjust')
        AND (
          public.user_has_store_permission_v2(p_store_id, 'cashbook.cancel')
          OR public.user_has_store_permission_v2(p_store_id, 'financial.manage')
        )
      )
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
    END IF;
  END IF;

  SELECT
    o.id,
    o.store_id,
    o.status::text AS status,
    o.subtotal,
    o.total,
    o.completed_at,
    o.created_at,
    COALESCE(o.commercial_metadata, '{}'::jsonb) AS commercial_metadata
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.store_id = p_store_id;

  IF v_order.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_not_found');
  END IF;

  IF v_order.status <> 'completed' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sale_not_completed');
  END IF;

  SELECT count(*), count(DISTINCT x.order_item_id)
  INTO v_requested_count, v_distinct_count
  FROM jsonb_to_recordset(p_items) AS x(order_item_id uuid, quantity integer);

  IF v_requested_count <> v_distinct_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'duplicate_order_item');
  END IF;

  WITH requested AS (
    SELECT x.order_item_id, x.quantity
    FROM jsonb_to_recordset(p_items) AS x(order_item_id uuid, quantity integer)
  )
  SELECT count(*)
  INTO v_matched_count
  FROM requested r
  JOIN public.order_items oi
    ON oi.id = r.order_item_id
   AND oi.order_id = p_order_id
   AND oi.store_id = p_store_id;

  IF v_matched_count <> v_requested_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'order_item_not_found');
  END IF;

  WITH requested AS (
    SELECT x.order_item_id, x.quantity
    FROM jsonb_to_recordset(p_items) AS x(order_item_id uuid, quantity integer)
  ),
  prior AS (
    SELECT sai.order_item_id, COALESCE(sum(sai.quantity), 0)::integer AS returned_quantity
    FROM public.sale_adjustment_items sai
    JOIN public.sale_adjustments sa ON sa.id = sai.adjustment_id
    WHERE sa.store_id = p_store_id
      AND sa.order_id = p_order_id
      AND sa.status = 'completed'
    GROUP BY sai.order_item_id
  )
  SELECT count(*)
  INTO v_invalid_count
  FROM requested r
  JOIN public.order_items oi ON oi.id = r.order_item_id
  LEFT JOIN prior pr ON pr.order_item_id = oi.id
  WHERE r.quantity IS NULL
     OR r.quantity <= 0
     OR r.quantity > greatest(oi.quantity - COALESCE(pr.returned_quantity, 0), 0);

  IF v_invalid_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'quantity_exceeds_remaining');
  END IF;

  SELECT COALESCE(sum(sa.refund_amount), 0)
  INTO v_previous_refunded
  FROM public.sale_adjustments sa
  WHERE sa.store_id = p_store_id
    AND sa.order_id = p_order_id
    AND sa.status = 'completed';

  WITH requested AS (
    SELECT x.order_item_id, x.quantity
    FROM jsonb_to_recordset(p_items) AS x(order_item_id uuid, quantity integer)
  ),
  prior AS (
    SELECT sai.order_item_id, COALESCE(sum(sai.quantity), 0)::integer AS returned_quantity
    FROM public.sale_adjustment_items sai
    JOIN public.sale_adjustments sa ON sa.id = sai.adjustment_id
    WHERE sa.store_id = p_store_id
      AND sa.order_id = p_order_id
      AND sa.status = 'completed'
    GROUP BY sai.order_item_id
  ),
  base AS (
    SELECT
      oi.id AS order_item_id,
      oi.product_id,
      oi.quantity::integer AS original_quantity,
      COALESCE(pr.returned_quantity, 0)::integer AS prior_returned,
      COALESCE(r.quantity, 0)::integer AS requested_return,
      greatest(oi.quantity - COALESCE(pr.returned_quantity, 0) - COALESCE(r.quantity, 0), 0)::integer AS remaining_after,
      oi.unit_price::numeric AS original_auto_unit_price,
      CASE WHEN oi.quantity > 0 THEN COALESCE(oi.discount, 0)::numeric / oi.quantity ELSE 0 END AS manual_discount_per_unit,
      COALESCE(
        NULLIF(ps.item->>'base_price', '')::numeric,
        NULLIF(oi.commercial_metadata->>'base_price', '')::numeric,
        NULLIF(oi.commercial_metadata->>'original_unit_price', '')::numeric,
        NULLIF(oi.product_snapshot->>'base_price', '')::numeric,
        NULLIF(oi.product_snapshot->>'price', '')::numeric,
        oi.unit_price::numeric
      ) AS base_price,
      COALESCE(
        NULLIF(ps.item->>'pricing_source', ''),
        NULLIF(oi.commercial_metadata->>'pricing_source', ''),
        NULLIF(oi.product_snapshot->>'pricing_source', ''),
        'product_base_price'
      ) AS pricing_source,
      COALESCE(
        NULLIF(ps.item->>'category_id', '')::uuid,
        NULLIF(oi.product_snapshot->>'category_id', '')::uuid
      ) AS category_id,
      COALESCE(
        NULLIF(ps.item->>'pricing_group_id', '')::uuid,
        NULLIF(oi.commercial_metadata->>'pricing_group_id', '')::uuid,
        NULLIF(oi.product_snapshot->>'pricing_group_id', '')::uuid
      ) AS pricing_group_id,
      CASE
        WHEN jsonb_typeof(ps.item->'pricing_rules_snapshot') = 'array'
          AND jsonb_array_length(ps.item->'pricing_rules_snapshot') > 0
          THEN ps.item->'pricing_rules_snapshot'
        WHEN COALESCE(ps.item->>'pricing_source', oi.commercial_metadata->>'pricing_source', '') = 'pricing_group_combined_volume'
          THEN COALESCE((
            SELECT pg.price_rules
            FROM public.pricing_groups pg
            WHERE pg.id = COALESCE(
              NULLIF(ps.item->>'pricing_group_id', '')::uuid,
              NULLIF(oi.commercial_metadata->>'pricing_group_id', '')::uuid,
              NULLIF(oi.product_snapshot->>'pricing_group_id', '')::uuid
            )
              AND pg.store_id = p_store_id
              AND (v_order.completed_at IS NULL OR pg.updated_at <= v_order.completed_at)
            LIMIT 1
          ), '[]'::jsonb)
        WHEN COALESCE(ps.item->>'pricing_source', oi.commercial_metadata->>'pricing_source', '') IN ('category_combined_volume', 'category_product_volume', 'category_standard')
          THEN COALESCE((
            SELECT c.price_rules
            FROM public.categories c
            WHERE c.id = COALESCE(
              NULLIF(ps.item->>'category_id', '')::uuid,
              NULLIF(oi.product_snapshot->>'category_id', '')::uuid
            )
              AND c.store_id = p_store_id
            LIMIT 1
          ), '[]'::jsonb)
        WHEN COALESCE(ps.item->>'pricing_source', oi.commercial_metadata->>'pricing_source', '') IN ('product_volume', 'product_standard')
          THEN COALESCE((
            SELECT p.price_rules
            FROM public.products p
            WHERE p.id = oi.product_id
              AND p.store_id = p_store_id
            LIMIT 1
          ), '[]'::jsonb)
        ELSE '[]'::jsonb
      END AS pricing_rules,
      COALESCE(ps.item->'applied_tier', oi.commercial_metadata->'applied_tier', oi.commercial_metadata->'price_rule') AS applied_tier
    FROM public.order_items oi
    LEFT JOIN requested r ON r.order_item_id = oi.id
    LEFT JOIN prior pr ON pr.order_item_id = oi.id
    LEFT JOIN LATERAL (
      SELECT value AS item
      FROM jsonb_array_elements(COALESCE(v_order.commercial_metadata->'pricing_snapshot'->'items', '[]'::jsonb))
      WHERE value->>'product_id' = oi.product_id::text
      LIMIT 1
    ) ps ON true
    WHERE oi.order_id = p_order_id
      AND oi.store_id = p_store_id
  ),
  scoped AS (
    SELECT
      b.*,
      CASE
        WHEN b.pricing_source = 'pricing_group_combined_volume'
          THEN sum(b.remaining_after) OVER (PARTITION BY b.pricing_group_id)::integer
        WHEN b.pricing_source = 'category_combined_volume'
          THEN sum(b.remaining_after) OVER (PARTITION BY b.category_id)::integer
        ELSE b.remaining_after
      END AS scope_quantity
    FROM base b
  ),
  repriced AS (
    SELECT
      s.*,
      CASE
        WHEN jsonb_typeof(s.pricing_rules) = 'array' AND jsonb_array_length(s.pricing_rules) > 0 THEN
          COALESCE((
            SELECT (rule->>'price')::numeric
            FROM jsonb_array_elements(s.pricing_rules) rule
            WHERE COALESCE((rule->>'min')::integer, 0) <= s.scope_quantity
            ORDER BY COALESCE((rule->>'min')::integer, 0) DESC
            LIMIT 1
          ), s.base_price)
        WHEN s.pricing_source IN ('pricing_group_combined_volume', 'category_combined_volume', 'category_product_volume', 'product_volume')
          AND s.applied_tier IS NOT NULL
          AND s.scope_quantity < COALESCE((s.applied_tier->>'min')::integer, 0)
          THEN s.base_price
        ELSE s.original_auto_unit_price
      END AS repriced_unit_price
    FROM scoped s
  )
  SELECT
    COALESCE(sum(greatest(r.remaining_after * r.repriced_unit_price - r.remaining_after * r.manual_discount_per_unit, 0)), 0),
    COALESCE(sum(r.requested_return * greatest(r.original_auto_unit_price - r.manual_discount_per_unit, 0)), 0),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'order_item_id', r.order_item_id,
        'product_id', r.product_id,
        'original_quantity', r.original_quantity,
        'prior_returned', r.prior_returned,
        'requested_return', r.requested_return,
        'remaining_after', r.remaining_after,
        'pricing_source', r.pricing_source,
        'scope_quantity_after', r.scope_quantity,
        'base_price', round(r.base_price, 2),
        'original_unit_price', round(r.original_auto_unit_price, 2),
        'repriced_unit_price', round(r.repriced_unit_price, 2),
        'pricing_rules_snapshot_used', (jsonb_typeof(r.pricing_rules) = 'array' AND jsonb_array_length(r.pricing_rules) > 0)
      ) ORDER BY r.order_item_id
    ), '[]'::jsonb)
  INTO v_retained_total, v_selected_original_value, v_rows
  FROM repriced r;

  v_retained_total := round(v_retained_total, 2);
  v_selected_original_value := round(v_selected_original_value, 2);
  v_cumulative_entitlement := round(greatest(COALESCE(v_order.subtotal, 0) - v_retained_total, 0), 2);
  v_refund_amount := round(greatest(v_cumulative_entitlement - v_previous_refunded, 0), 2);
  v_repricing_adjustment := round(v_selected_original_value - v_refund_amount, 2);

  RETURN jsonb_build_object(
    'ok', true,
    'refund_amount', v_refund_amount,
    'selected_original_value', v_selected_original_value,
    'pricing_recalculation_adjustment', v_repricing_adjustment,
    'retained_merchandise_total', v_retained_total,
    'cumulative_refund_entitlement', v_cumulative_entitlement,
    'previous_refunded', v_previous_refunded,
    'remaining_refundable_after', greatest(COALESCE(v_order.total, 0) - v_previous_refunded - v_refund_amount, 0),
    'items', v_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.quote_completed_sale_partial_return_safe(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_completed_sale_partial_return_safe(uuid, uuid, jsonb) TO authenticated, service_role;

-- 3) V2 adjustment orchestrator. It reuses the already-audited stock/adjustment
-- workflow, then corrects the financial amount atomically using the return quote.
CREATE OR REPLACE FUNCTION public.adjust_completed_sale_v2_safe(
  p_store_id uuid,
  p_order_id uuid,
  p_adjustment_type text,
  p_reason_code text,
  p_reason_notes text,
  p_items jsonb DEFAULT NULL,
  p_refund_account_id uuid DEFAULT NULL,
  p_refund_payment_method_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_sale_entry record;
  v_payment record;
  v_account_active boolean;
  v_account_has_routes boolean := false;
  v_account_accepts_method boolean := false;
  v_quote jsonb := null;
  v_target_refund numeric := null;
  v_raw_result jsonb;
  v_adjustment_id uuid;
  v_refund_entry_id uuid;
  v_raw_refund numeric := 0;
  v_raw_item_total numeric := 0;
  v_total_refunded numeric := 0;
  v_order_total numeric := 0;
  v_payment_status text;
BEGIN
  SELECT
    e.id,
    e.payment_method_code,
    e.payment_method,
    e.destination_financial_account_id,
    e.source_financial_account_id
  INTO v_sale_entry
  FROM public.cashbook_entries e
  WHERE e.store_id = p_store_id
    AND e.order_id = p_order_id
    AND e.type = 'sale'
    AND e.direction = 'in'
    AND e.status = 'confirmed'
    AND e.affects_balance = true
  ORDER BY e.occurred_at DESC, e.created_at DESC
  LIMIT 1;

  IF v_sale_entry.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sale_financial_entry_not_found');
  END IF;

  IF p_refund_account_id IS NULL THEN
    p_refund_account_id := COALESCE(v_sale_entry.destination_financial_account_id, v_sale_entry.source_financial_account_id);
  END IF;

  IF p_refund_account_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'refund_account_required');
  END IF;

  SELECT a.active
  INTO v_account_active
  FROM public.store_financial_accounts a
  WHERE a.id = p_refund_account_id
    AND a.store_id = p_store_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_refund_account');
  END IF;

  IF v_account_active IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'refund_account_inactive');
  END IF;

  p_refund_payment_method_code := COALESCE(
    NULLIF(trim(p_refund_payment_method_code), ''),
    NULLIF(trim(v_sale_entry.payment_method_code), '')
  );

  IF p_refund_payment_method_code IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'refund_payment_method_required');
  END IF;

  SELECT pm.code, pm.name, COALESCE(pm.base_code, pm.code) AS base_code, pm.affects_cashbook
  INTO v_payment
  FROM public.store_payment_methods pm
  WHERE pm.store_id = p_store_id
    AND pm.code = p_refund_payment_method_code
    AND pm.active = true
  LIMIT 1;

  IF v_payment.code IS NULL OR v_payment.affects_cashbook IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_refund_payment_method');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.store_financial_account_payment_methods apm
    WHERE apm.store_id = p_store_id
      AND apm.account_id = p_refund_account_id
      AND apm.active = true
  )
  INTO v_account_has_routes;

  IF v_account_has_routes THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.store_financial_account_payment_methods apm
      WHERE apm.store_id = p_store_id
        AND apm.account_id = p_refund_account_id
        AND apm.active = true
        AND apm.payment_method_code IN (v_payment.code, v_payment.base_code)
    )
    INTO v_account_accepts_method;

    IF NOT v_account_accepts_method THEN
      RETURN jsonb_build_object('ok', false, 'error', 'account_does_not_accept_refund_method');
    END IF;
  END IF;

  IF p_adjustment_type = 'partial_return' THEN
    v_quote := public.quote_completed_sale_partial_return_safe(p_store_id, p_order_id, p_items);
    IF COALESCE((v_quote->>'ok')::boolean, false) = false THEN
      RETURN v_quote;
    END IF;

    v_target_refund := COALESCE((v_quote->>'refund_amount')::numeric, 0);
    IF v_target_refund <= 0.005 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'prior_refund_exceeds_repriced_entitlement',
        'quote', v_quote
      );
    END IF;
  END IF;

  v_raw_result := public.adjust_completed_sale_safe(
    p_store_id,
    p_order_id,
    p_adjustment_type,
    p_reason_code,
    p_reason_notes,
    p_items,
    p_refund_account_id
  );

  IF COALESCE((v_raw_result->>'ok')::boolean, false) = false THEN
    RETURN v_raw_result;
  END IF;

  v_adjustment_id := NULLIF(v_raw_result->>'adjustment_id', '')::uuid;
  v_refund_entry_id := NULLIF(v_raw_result->>'refund_cashbook_entry_id', '')::uuid;
  v_raw_refund := COALESCE((v_raw_result->>'refund_amount')::numeric, 0);

  IF p_adjustment_type = 'partial_return' AND v_target_refund IS NOT NULL THEN
    SELECT COALESCE(sum(sai.refund_amount), 0)
    INTO v_raw_item_total
    FROM public.sale_adjustment_items sai
    WHERE sai.adjustment_id = v_adjustment_id;

    WITH ranked AS (
      SELECT
        sai.id,
        sai.quantity,
        sai.refund_amount AS raw_refund,
        row_number() OVER (ORDER BY sai.id) AS rn,
        count(*) OVER () AS cnt,
        sum(sai.refund_amount) OVER () AS raw_total
      FROM public.sale_adjustment_items sai
      WHERE sai.adjustment_id = v_adjustment_id
    ),
    proportional AS (
      SELECT
        r.*,
        CASE
          WHEN r.raw_total <= 0 THEN 0::numeric
          ELSE round(v_target_refund * r.raw_refund / r.raw_total, 2)
        END AS proportional_refund
      FROM ranked r
    ),
    allocated AS (
      SELECT
        p.*,
        CASE
          WHEN p.rn = p.cnt THEN
            round(v_target_refund - COALESCE(sum(p.proportional_refund) OVER (ORDER BY p.rn ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0), 2)
          ELSE p.proportional_refund
        END AS final_refund
      FROM proportional p
    )
    UPDATE public.sale_adjustment_items sai
    SET
      refund_amount = greatest(a.final_refund, 0),
      unit_refund_amount = CASE WHEN a.quantity > 0 THEN greatest(a.final_refund, 0) / a.quantity ELSE 0 END,
      metadata = COALESCE(sai.metadata, '{}'::jsonb) || jsonb_build_object(
        'raw_refund_before_repricing', a.raw_refund,
        'repriced_refund_amount', greatest(a.final_refund, 0),
        'pricing_recalculated_after_partial_return', true
      )
    FROM allocated a
    WHERE sai.id = a.id;

    UPDATE public.sale_adjustments sa
    SET
      refund_amount = v_target_refund,
      metadata = COALESCE(sa.metadata, '{}'::jsonb) || jsonb_build_object(
        'raw_refund_before_repricing', v_raw_refund,
        'repriced_refund_amount', v_target_refund,
        'selected_original_value', (v_quote->>'selected_original_value')::numeric,
        'pricing_recalculation_adjustment', (v_quote->>'pricing_recalculation_adjustment')::numeric,
        'retained_merchandise_total', (v_quote->>'retained_merchandise_total')::numeric,
        'cumulative_refund_entitlement', (v_quote->>'cumulative_refund_entitlement')::numeric,
        'partial_return_quote', v_quote
      )
    WHERE sa.id = v_adjustment_id;

    UPDATE public.cashbook_entries e
    SET amount = v_target_refund
    WHERE e.id = v_refund_entry_id
      AND e.store_id = p_store_id
      AND e.order_id = p_order_id
      AND e.type = 'refund'
      AND e.direction = 'out';
  END IF;

  UPDATE public.cashbook_entries e
  SET
    payment_method_code = v_payment.code,
    payment_method = v_payment.name,
    metadata = COALESCE(e.metadata, '{}'::jsonb) || jsonb_build_object(
      'refund_payment_method_code', v_payment.code,
      'refund_payment_method_name', v_payment.name,
      'refund_payment_method_base_code', v_payment.base_code,
      'refund_method_selected_at', now()
    )
  WHERE e.id = v_refund_entry_id
    AND e.store_id = p_store_id
    AND e.order_id = p_order_id
    AND e.type = 'refund'
    AND e.direction = 'out';

  UPDATE public.sale_adjustments sa
  SET metadata = COALESCE(sa.metadata, '{}'::jsonb) || jsonb_build_object(
    'refund_payment_method_code', v_payment.code,
    'refund_payment_method_name', v_payment.name,
    'refund_account_id', p_refund_account_id
  )
  WHERE sa.id = v_adjustment_id;

  SELECT COALESCE(sum(sa.refund_amount), 0)
  INTO v_total_refunded
  FROM public.sale_adjustments sa
  WHERE sa.store_id = p_store_id
    AND sa.order_id = p_order_id
    AND sa.status = 'completed';

  SELECT o.total
  INTO v_order_total
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.store_id = p_store_id;

  v_payment_status := CASE
    WHEN v_total_refunded >= COALESCE(v_order_total, 0) - 0.005 THEN 'refunded'
    WHEN v_total_refunded > 0 THEN 'partially_refunded'
    ELSE 'paid'
  END;

  UPDATE public.orders o
  SET
    payment_status = v_payment_status,
    commercial_metadata = COALESCE(o.commercial_metadata, '{}'::jsonb) || jsonb_build_object(
      'refunded_total', v_total_refunded,
      'last_refund_payment_method_code', v_payment.code,
      'last_refund_payment_method_name', v_payment.name,
      'last_refund_account_id', p_refund_account_id,
      'last_sale_adjustment_id', v_adjustment_id,
      'last_sale_adjustment_at', now()
    )
  WHERE o.id = p_order_id
    AND o.store_id = p_store_id;

  RETURN v_raw_result || jsonb_build_object(
    'refund_amount', CASE WHEN p_adjustment_type = 'partial_return' THEN v_target_refund ELSE v_raw_refund END,
    'refund_payment_method_code', v_payment.code,
    'refund_payment_method_name', v_payment.name,
    'payment_status', v_payment_status,
    'remaining_refundable', greatest(COALESCE(v_order_total, 0) - v_total_refunded, 0),
    'pricing_quote', v_quote
  );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_completed_sale_v2_safe(uuid, uuid, text, text, text, jsonb, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_completed_sale_v2_safe(uuid, uuid, text, text, text, jsonb, uuid, text) TO authenticated, service_role;