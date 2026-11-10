-- Vida do Produto: consulta read-only de ressalvas de compras e divergências físicas.
-- Esta rotina não cria uma segunda autoridade de tratamento de divergências.
CREATE OR REPLACE FUNCTION public.get_product_operational_occurrences_safe(p_store_id uuid, p_product_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_can_stock boolean;
  v_can_purchase boolean;
  v_purchases jsonb := '[]'::jsonb;
  v_physical jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_store_id IS NULL OR p_product_id IS NULL THEN
    RAISE EXCEPTION 'Sessão ou parâmetros inválidos.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = p_product_id AND p.store_id = p_store_id
  ) THEN
    RAISE EXCEPTION 'Produto não pertence à loja informada.';
  END IF;

  v_can_stock := (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'stock.view')
  );
  v_can_purchase := (
    v_can_stock
    OR public.user_has_store_permission(p_store_id, 'purchases.view')
    OR public.user_has_store_permission(p_store_id, 'purchases.confirm')
  );

  IF NOT v_can_purchase THEN
    RAISE EXCEPTION 'Sem permissão para consultar as ocorrências.';
  END IF;

  IF v_can_purchase THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'issue_id', i.id,
      'issue_code', i.issue_code,
      'purchase_document_id', i.purchase_document_id,
      'document_code', d.document_code,
      'invoice_number', d.invoice_number,
      'supplier_name', s.name,
      'issue_type', i.issue_type,
      'issue_status', i.status,
      'disposition', i.disposition,
      'quantity', i.quantity,
      'replacement_pending_quantity', i.replacement_pending_quantity,
      'physical_closed_quantity', i.physical_closed_quantity,
      'estimated_amount', i.estimated_amount,
      'notes', i.notes,
      'resolution_notes', i.resolution_notes,
      'resolution_reference', i.resolution_reference,
      'opened_at', i.opened_at,
      'resolved_at', i.resolved_at,
      'cancelled_at', i.cancelled_at,
      'cancellation_reason', i.cancellation_reason
    ) ORDER BY i.opened_at DESC), '[]'::jsonb)
    INTO v_purchases
    FROM public.purchase_receipt_issues i
    JOIN public.purchase_documents d
      ON d.id = i.purchase_document_id AND d.store_id = p_store_id
    LEFT JOIN public.suppliers s ON s.id = i.supplier_id AND s.store_id = p_store_id
    WHERE i.store_id = p_store_id AND i.product_id = p_product_id;
  END IF;

  IF v_can_stock THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', occ.id,
      'order_code', ord.order_code,
      'location_name', loc.name,
      'occurrence_type', occ.occurrence_type,
      'status', occ.status,
      'items', (
        SELECT COALESCE(jsonb_agg(part), '[]'::jsonb)
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(occ.items) = 'array'
            THEN occ.items ELSE '[]'::jsonb END
        ) part
        WHERE part->>'product_id' = p_product_id::text
      ),
      'opening_notes', occ.opening_notes,
      'resolution_type', occ.resolution_type,
      'resolution_notes', occ.resolution_notes,
      'created_at', occ.created_at,
      'resolved_at', occ.resolved_at
    ) ORDER BY occ.created_at DESC), '[]'::jsonb)
    INTO v_physical
    FROM public.stock_discrepancy_occurrences occ
    LEFT JOIN public.orders ord
      ON ord.id = occ.order_id AND ord.store_id = p_store_id
    LEFT JOIN public.stock_locations loc
      ON loc.id = occ.location_id AND loc.store_id = p_store_id
    WHERE occ.store_id = p_store_id
      AND jsonb_typeof(occ.items) = 'array'
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(occ.items) part
        WHERE part->>'product_id' = p_product_id::text
      );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'purchase_issues', v_purchases,
    'physical_occurrences', v_physical
  );
END;
$function$

REVOKE ALL ON FUNCTION public.get_product_operational_occurrences_safe(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_operational_occurrences_safe(uuid,uuid) TO authenticated;
COMMENT ON FUNCTION public.get_product_operational_occurrences_safe(uuid,uuid) IS 'Consulta somente leitura de ressalvas de compras e ocorrências físicas do produto na loja autorizada; sem segunda autoridade de tratamento.';
