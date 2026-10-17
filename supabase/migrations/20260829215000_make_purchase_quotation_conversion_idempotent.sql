CREATE OR REPLACE FUNCTION public.convert_purchase_quotation_to_draft(p_quotation_id uuid, p_notes text DEFAULT NULL::text)
RETURNS TABLE(purchase_document_id uuid, quotation_id uuid, quotation_code text, supplier_id uuid, supplier_name text, status text, items_count integer, total_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quotation record;
  v_document_id uuid;
  v_item record;
  v_items_count integer := 0;
  v_total_amount numeric := 0;
  v_existing_status text;
BEGIN
  SELECT
    q.id,
    q.store_id,
    q.supplier_id,
    q.quotation_code,
    q.status,
    q.converted_purchase_document_id,
    q.sent_channel,
    q.responsible_name,
    s.name AS supplier_name
  INTO v_quotation
  FROM public.purchase_quotations q
  JOIN public.suppliers s
    ON s.id = q.supplier_id
   AND s.store_id = q.store_id
  WHERE q.id = p_quotation_id
  FOR UPDATE;

  IF v_quotation.id IS NULL THEN
    RAISE EXCEPTION 'Cotação não encontrada.';
  END IF;

  IF NOT public.user_can_purchase_action(v_quotation.store_id, 'create') THEN
    RAISE EXCEPTION 'Sem permissão para converter cotação em compra nesta loja.';
  END IF;

  IF v_quotation.converted_purchase_document_id IS NOT NULL THEN
    SELECT
      count(pdi.id)::integer,
      coalesce(pd.total_amount, coalesce(sum(pdi.quantity * pdi.unit_cost), 0)),
      pd.status
    INTO v_items_count, v_total_amount, v_existing_status
    FROM public.purchase_documents pd
    LEFT JOIN public.purchase_document_items pdi
      ON pdi.purchase_document_id = pd.id
     AND pdi.store_id = pd.store_id
    WHERE pd.id = v_quotation.converted_purchase_document_id
      AND pd.store_id = v_quotation.store_id
    GROUP BY pd.id, pd.status, pd.total_amount;

    IF v_existing_status IS NULL THEN
      RAISE EXCEPTION 'Esta cotação já está convertida, mas o rascunho vinculado não foi encontrado.';
    END IF;

    RETURN QUERY
    SELECT
      v_quotation.converted_purchase_document_id,
      v_quotation.id,
      v_quotation.quotation_code,
      v_quotation.supplier_id,
      v_quotation.supplier_name,
      v_existing_status,
      coalesce(v_items_count, 0),
      coalesce(v_total_amount, 0);
    RETURN;
  END IF;

  IF v_quotation.status = 'converted' THEN
    RAISE EXCEPTION 'Esta cotação já está convertida, mas o rascunho vinculado não foi encontrado.';
  END IF;

  IF v_quotation.status <> 'approved' THEN
    RAISE EXCEPTION 'Somente cotações aprovadas podem ser convertidas em compra.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.purchase_quotation_items qi
    WHERE qi.quotation_id = p_quotation_id
      AND qi.store_id = v_quotation.store_id
      AND COALESCE(qi.approved_qty, qi.requested_qty) > 0
  ) THEN
    RAISE EXCEPTION 'Cotação sem itens aprovados para conversão.';
  END IF;

  INSERT INTO public.purchase_documents (
    store_id,
    supplier_id,
    invoice_number,
    issue_date,
    total_amount,
    notes,
    status
  )
  VALUES (
    v_quotation.store_id,
    v_quotation.supplier_id,
    NULL,
    CURRENT_DATE,
    0,
    COALESCE(
      NULLIF(p_notes, ''),
      'Rascunho criado a partir da cotação ' || v_quotation.quotation_code || '.'
    ),
    'draft'
  )
  RETURNING id INTO v_document_id;

  FOR v_item IN
    SELECT
      qi.product_id,
      COALESCE(qi.approved_qty, qi.requested_qty) AS quantity,
      COALESCE(qi.quoted_unit_cost, qi.reference_unit_cost, 0) AS unit_cost
    FROM public.purchase_quotation_items qi
    WHERE qi.quotation_id = p_quotation_id
      AND qi.store_id = v_quotation.store_id
      AND COALESCE(qi.approved_qty, qi.requested_qty) > 0
  LOOP
    INSERT INTO public.purchase_document_items (
      purchase_document_id,
      product_id,
      quantity,
      unit_cost,
      store_id
    )
    VALUES (
      v_document_id,
      v_item.product_id,
      v_item.quantity,
      v_item.unit_cost,
      v_quotation.store_id
    );

    v_items_count := v_items_count + 1;
    v_total_amount := v_total_amount + (v_item.quantity * v_item.unit_cost);
  END LOOP;

  UPDATE public.purchase_documents pd
  SET total_amount = v_total_amount
  WHERE pd.id = v_document_id;

  UPDATE public.purchase_quotations q
  SET
    status = 'converted',
    converted_purchase_document_id = v_document_id,
    updated_at = now()
  WHERE q.id = p_quotation_id;

  PERFORM public.create_operational_timeline_event(
    p_store_id := v_quotation.store_id,
    p_entity_type := 'purchase_quotation',
    p_entity_id := p_quotation_id,
    p_event_type := 'quotation_converted_to_purchase_document',
    p_title := 'Cotação convertida em compra',
    p_description := 'Cotação ' || v_quotation.quotation_code || ' convertida em rascunho de compra.',
    p_severity := 'success',
    p_status := 'done',
    p_responsible_name := v_quotation.responsible_name,
    p_channel := COALESCE(v_quotation.sent_channel, 'system'),
    p_source := 'convert_purchase_quotation_to_draft',
    p_source_id := p_quotation_id,
    p_old_data := jsonb_build_object(
      'status', v_quotation.status,
      'converted_purchase_document_id', v_quotation.converted_purchase_document_id
    ),
    p_new_data := jsonb_build_object(
      'status', 'converted',
      'purchase_document_id', v_document_id,
      'items_count', v_items_count,
      'total_amount', v_total_amount
    ),
    p_metadata := jsonb_build_object(
      'phase', '9.3C.6-B',
      'quotation_code', v_quotation.quotation_code,
      'supplier_name', v_quotation.supplier_name
    ),
    p_related_supplier_id := v_quotation.supplier_id,
    p_related_purchase_quotation_id := p_quotation_id,
    p_related_purchase_document_id := v_document_id
  );

  PERFORM public.create_operational_timeline_event(
    p_store_id := v_quotation.store_id,
    p_entity_type := 'purchase_document',
    p_entity_id := v_document_id,
    p_event_type := 'purchase_document_created_from_quotation',
    p_title := 'Rascunho de compra criado pela cotação',
    p_description := 'Rascunho de compra criado a partir da cotação ' || v_quotation.quotation_code || '.',
    p_severity := 'info',
    p_status := 'done',
    p_responsible_name := v_quotation.responsible_name,
    p_channel := COALESCE(v_quotation.sent_channel, 'system'),
    p_source := 'convert_purchase_quotation_to_draft',
    p_source_id := v_document_id,
    p_new_data := jsonb_build_object(
      'purchase_document_id', v_document_id,
      'quotation_id', p_quotation_id,
      'quotation_code', v_quotation.quotation_code,
      'items_count', v_items_count,
      'total_amount', v_total_amount,
      'status', 'draft',
      'supplier_name', v_quotation.supplier_name
    ),
    p_metadata := jsonb_build_object(
      'phase', '9.3C.6-B',
      'origin', 'purchase_quotation_conversion',
      'supplier_name', v_quotation.supplier_name,
      'quotation_code', v_quotation.quotation_code
    ),
    p_related_supplier_id := v_quotation.supplier_id,
    p_related_purchase_quotation_id := p_quotation_id,
    p_related_purchase_document_id := v_document_id
  );

  RETURN QUERY
  SELECT
    v_document_id,
    v_quotation.id,
    v_quotation.quotation_code,
    v_quotation.supplier_id,
    v_quotation.supplier_name,
    'draft'::text,
    v_items_count,
    v_total_amount;
END;
$function$;

NOTIFY pgrst, 'reload schema';
