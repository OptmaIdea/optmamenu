-- Homologação 0D.5 — separa implementação interna de RPCs críticas e
-- coloca autorização explícita por permissão na fronteira pública autenticada.
--
-- O padrão é deliberado:
--   original -> renomeada para *_internal_0d (service_role only)
--   wrapper com o nome original -> valida owner/permissão -> delega
--
-- Isso evita duplicar corpos operacionais extensos e preserva a assinatura
-- consumida pelo frontend.

BEGIN;

-- ---------------------------------------------------------------------------
-- Estoque: ajuste físico
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.adjust_stock_to_physical_count(uuid, uuid, numeric, text, text)
  RENAME TO adjust_stock_to_physical_count_internal_0d;
REVOKE EXECUTE ON FUNCTION public.adjust_stock_to_physical_count_internal_0d(uuid, uuid, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock_to_physical_count_internal_0d(uuid, uuid, numeric, text, text)
  TO service_role;

CREATE FUNCTION public.adjust_stock_to_physical_count(
  p_product_id uuid,
  p_location_id uuid,
  p_counted_quantity numeric,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(
  movement_id uuid,
  product_id uuid,
  location_id uuid,
  previous_quantity numeric,
  counted_quantity numeric,
  adjustment_quantity numeric,
  movement_type public.stock_movement_type,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT p.store_id INTO v_store_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.' USING errcode = 'P0002';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id, 'stock.adjust')
    OR public.user_has_store_permission(v_store_id, 'stock.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar estoque.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.adjust_stock_to_physical_count_internal_0d(
    p_product_id, p_location_id, p_counted_quantity, p_reason, p_notes
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.adjust_stock_to_physical_count(uuid, uuid, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adjust_stock_to_physical_count(uuid, uuid, numeric, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Estoque: ajuste manual
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.create_manual_stock_adjustment(uuid, uuid, text, numeric, text, text)
  RENAME TO create_manual_stock_adjustment_internal_0d;
REVOKE EXECUTE ON FUNCTION public.create_manual_stock_adjustment_internal_0d(uuid, uuid, text, numeric, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_manual_stock_adjustment_internal_0d(uuid, uuid, text, numeric, text, text)
  TO service_role;

CREATE FUNCTION public.create_manual_stock_adjustment(
  p_product_id uuid,
  p_location_id uuid,
  p_adjustment_kind text,
  p_quantity numeric,
  p_reason text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(
  movement_id uuid,
  product_id uuid,
  location_id uuid,
  movement_type public.stock_movement_type,
  quantity numeric,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT p.store_id INTO v_store_id
  FROM public.products p
  WHERE p.id = p_product_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.' USING errcode = 'P0002';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id, 'stock.adjust')
    OR public.user_has_store_permission(v_store_id, 'stock.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ajustar estoque.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.create_manual_stock_adjustment_internal_0d(
    p_product_id, p_location_id, p_adjustment_kind, p_quantity, p_reason, p_notes
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_manual_stock_adjustment(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_manual_stock_adjustment(uuid, uuid, text, numeric, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Transferência: cancelar rascunho
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.cancel_stock_transfer(uuid, text)
  RENAME TO cancel_stock_transfer_internal_0d;
REVOKE EXECUTE ON FUNCTION public.cancel_stock_transfer_internal_0d(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_stock_transfer_internal_0d(uuid, text)
  TO service_role;

CREATE FUNCTION public.cancel_stock_transfer(
  p_transfer_id uuid,
  p_cancel_reason text
)
RETURNS TABLE(transfer_id uuid, transfer_code text, status text, cancelled_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT st.store_id INTO v_store_id
  FROM public.stock_transfers st
  WHERE st.id = p_transfer_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada.' USING errcode = 'P0002';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id, 'transfers.cancel')
    OR public.user_has_store_permission(v_store_id, 'transfers.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para cancelar transferências.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.cancel_stock_transfer_internal_0d(p_transfer_id, p_cancel_reason);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.cancel_stock_transfer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_stock_transfer(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Transferência: criar rascunho em lote
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.create_stock_transfer_draft_batch(uuid, uuid, jsonb, text)
  RENAME TO create_stock_transfer_draft_batch_internal_0d;
REVOKE EXECUTE ON FUNCTION public.create_stock_transfer_draft_batch_internal_0d(uuid, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer_draft_batch_internal_0d(uuid, uuid, jsonb, text)
  TO service_role;

CREATE FUNCTION public.create_stock_transfer_draft_batch(
  p_source_location_id uuid,
  p_destination_location_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(transfer_id uuid, transfer_code text, status text, items_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid;
  v_destination_store_id uuid;
BEGIN
  SELECT sl.store_id INTO v_store_id
  FROM public.stock_locations sl
  WHERE sl.id = p_source_location_id;

  SELECT sl.store_id INTO v_destination_store_id
  FROM public.stock_locations sl
  WHERE sl.id = p_destination_location_id;

  IF v_store_id IS NULL OR v_destination_store_id IS NULL OR v_store_id <> v_destination_store_id THEN
    RAISE EXCEPTION 'Origem ou destino inválido.' USING errcode = '22023';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id, 'transfers.create')
    OR public.user_has_store_permission(v_store_id, 'transfers.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para criar transferências.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.create_stock_transfer_draft_batch_internal_0d(
    p_source_location_id, p_destination_location_id, p_items, p_notes
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_stock_transfer_draft_batch(uuid, uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer_draft_batch(uuid, uuid, jsonb, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Transferência: envio
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.ship_stock_transfer(uuid, text, boolean)
  RENAME TO ship_stock_transfer_internal_0d;
REVOKE EXECUTE ON FUNCTION public.ship_stock_transfer_internal_0d(uuid, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ship_stock_transfer_internal_0d(uuid, text, boolean)
  TO service_role;

CREATE FUNCTION public.ship_stock_transfer(
  p_transfer_id uuid,
  p_notes text DEFAULT NULL,
  p_use_transit boolean DEFAULT false
)
RETURNS TABLE(transfer_id uuid, transfer_code text, status text, shipped_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT st.store_id INTO v_store_id
  FROM public.stock_transfers st
  WHERE st.id = p_transfer_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada.' USING errcode = 'P0002';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id, 'transfers.confirm')
    OR public.user_has_store_permission(v_store_id, 'transfers.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para enviar transferências.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.ship_stock_transfer_internal_0d(p_transfer_id, p_notes, p_use_transit);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.ship_stock_transfer(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ship_stock_transfer(uuid, text, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Transferência: recebimento com divergência
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.receive_stock_transfer(uuid, jsonb, text)
  RENAME TO receive_stock_transfer_internal_0d;
REVOKE EXECUTE ON FUNCTION public.receive_stock_transfer_internal_0d(uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer_internal_0d(uuid, jsonb, text)
  TO service_role;

CREATE FUNCTION public.receive_stock_transfer(
  p_transfer_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(
  transfer_id uuid,
  transfer_code text,
  status text,
  received_at timestamptz,
  total_shipped numeric,
  total_received numeric,
  total_divergence numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_store_id uuid;
BEGIN
  SELECT st.store_id INTO v_store_id
  FROM public.stock_transfers st
  WHERE st.id = p_transfer_id;

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Transferência não encontrada.' USING errcode = 'P0002';
  END IF;

  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id, 'transfers.confirm')
    OR public.user_has_store_permission(v_store_id, 'transfers.manage')
  ) THEN
    RAISE EXCEPTION 'Sem permissão para receber transferências.' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM public.receive_stock_transfer_internal_0d(p_transfer_id, p_items, p_notes);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.receive_stock_transfer(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer(uuid, jsonb, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Financeiro: lançamento manual confirmado
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.create_cashbook_entry(uuid, text, text, numeric, text, text, text, timestamptz, jsonb)
  RENAME TO create_cashbook_entry_internal_0d;
REVOKE EXECUTE ON FUNCTION public.create_cashbook_entry_internal_0d(uuid, text, text, numeric, text, text, text, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_cashbook_entry_internal_0d(uuid, text, text, numeric, text, text, text, timestamptz, jsonb)
  TO service_role;

CREATE FUNCTION public.create_cashbook_entry(
  p_store_id uuid,
  p_type text,
  p_direction text,
  p_amount numeric,
  p_description text,
  p_payment_method_code text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT now(),
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'cashbook.create')
    OR public.user_has_store_permission(p_store_id, 'financial.manage')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
  END IF;

  RETURN public.create_cashbook_entry_internal_0d(
    p_store_id, p_type, p_direction, p_amount, p_description,
    p_payment_method_code, p_notes, p_occurred_at, p_metadata
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_cashbook_entry(uuid, text, text, numeric, text, text, text, timestamptz, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_cashbook_entry(uuid, text, text, numeric, text, text, text, timestamptz, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Regras de estoque
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.update_product_stock_rules(uuid, uuid, numeric, numeric, jsonb)
  RENAME TO update_product_stock_rules_internal_0d;
REVOKE EXECUTE ON FUNCTION public.update_product_stock_rules_internal_0d(uuid, uuid, numeric, numeric, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_product_stock_rules_internal_0d(uuid, uuid, numeric, numeric, jsonb)
  TO service_role;

CREATE FUNCTION public.update_product_stock_rules(
  p_store_id uuid,
  p_product_id uuid,
  p_min_stock numeric,
  p_max_stock numeric,
  p_rules jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'stock.manage')
    OR public.user_has_store_permission(p_store_id, 'settings.stock.manage')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
  END IF;

  RETURN public.update_product_stock_rules_internal_0d(
    p_store_id, p_product_id, p_min_stock, p_max_stock, p_rules
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_product_stock_rules(uuid, uuid, numeric, numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_product_stock_rules(uuid, uuid, numeric, numeric, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Configurações comerciais
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.update_store_commercial_settings(uuid, boolean, boolean, text, numeric, integer, uuid, text, text, text, text)
  RENAME TO update_store_commercial_settings_internal_0d;
REVOKE EXECUTE ON FUNCTION public.update_store_commercial_settings_internal_0d(uuid, boolean, boolean, text, numeric, integer, uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_commercial_settings_internal_0d(uuid, boolean, boolean, text, numeric, integer, uuid, text, text, text, text)
  TO service_role;

CREATE FUNCTION public.update_store_commercial_settings(
  p_store_id uuid,
  p_public_store_enabled boolean,
  p_public_catalog_enabled boolean,
  p_slug text,
  p_minimum_order_value numeric,
  p_reservation_time_minutes integer,
  p_public_sales_location_id uuid,
  p_whatsapp_business text DEFAULT NULL,
  p_main_email text DEFAULT NULL,
  p_website text DEFAULT NULL,
  p_social_media text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id, 'settings.commercial.manage')
    OR public.user_has_store_permission(p_store_id, 'settings.manage')
    OR public.user_has_store_permission(p_store_id, 'commercial.manage')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'access_denied');
  END IF;

  RETURN public.update_store_commercial_settings_internal_0d(
    p_store_id, p_public_store_enabled, p_public_catalog_enabled, p_slug,
    p_minimum_order_value, p_reservation_time_minutes, p_public_sales_location_id,
    p_whatsapp_business, p_main_email, p_website, p_social_media
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_store_commercial_settings(uuid, boolean, boolean, text, numeric, integer, uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_store_commercial_settings(uuid, boolean, boolean, text, numeric, integer, uuid, text, text, text, text) TO authenticated, service_role;

COMMIT;
