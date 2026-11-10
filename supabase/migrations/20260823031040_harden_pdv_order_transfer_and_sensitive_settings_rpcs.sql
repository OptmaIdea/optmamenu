-- Homologação 0D.7 — fecha bypasses de permissão restantes em mutações P0.
--
-- Áreas cobertas:
-- - venda PDV;
-- - transições administrativas de pedido;
-- - transferência criada por sugestão e reversão de recebimento;
-- - redefinição de senha master;
-- - credencial/configuração do gateway de mensagens.

BEGIN;

-- ---------------------------------------------------------------------------
-- PDV: venda
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.create_pos_sale_safe(uuid,jsonb,uuid,text,text,text,text,uuid,text,text,boolean,boolean,boolean,jsonb)
  RENAME TO create_pos_sale_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.create_pos_sale_safe_internal_0d(uuid,jsonb,uuid,text,text,text,text,uuid,text,text,boolean,boolean,boolean,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_pos_sale_safe_internal_0d(uuid,jsonb,uuid,text,text,text,text,uuid,text,text,boolean,boolean,boolean,jsonb)
  TO service_role;

CREATE FUNCTION public.create_pos_sale_safe(
  p_store_id uuid,
  p_items jsonb,
  p_customer_id uuid DEFAULT NULL,
  p_customer_name text DEFAULT NULL,
  p_customer_phone text DEFAULT NULL,
  p_payment_method_code text DEFAULT 'pending',
  p_notes text DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_sales_channel text DEFAULT 'in_person',
  p_fulfillment_type text DEFAULT 'in_person',
  p_create_customer_if_missing boolean DEFAULT false,
  p_marketing_consent boolean DEFAULT false,
  p_loyalty_opt_in boolean DEFAULT false,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'pdv.sell')
  )) THEN
    RETURN jsonb_build_object('ok',false,'error','access_denied');
  END IF;

  RETURN public.create_pos_sale_safe_internal_0d(
    p_store_id,p_items,p_customer_id,p_customer_name,p_customer_phone,
    p_payment_method_code,p_notes,p_location_id,p_sales_channel,p_fulfillment_type,
    p_create_customer_if_missing,p_marketing_consent,p_loyalty_opt_in,p_metadata
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_pos_sale_safe(uuid,jsonb,uuid,text,text,text,text,uuid,text,text,boolean,boolean,boolean,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_pos_sale_safe(uuid,jsonb,uuid,text,text,text,text,uuid,text,text,boolean,boolean,boolean,jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Pedidos administrativos
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.admin_accept_public_order_safe(uuid)
  RENAME TO admin_accept_public_order_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.admin_accept_public_order_safe_internal_0d(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_accept_public_order_safe_internal_0d(uuid) TO service_role;

CREATE FUNCTION public.admin_accept_public_order_safe(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id;
  IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'orders.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.admin_accept_public_order_safe_internal_0d(p_order_id);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_accept_public_order_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_accept_public_order_safe(uuid) TO authenticated, service_role;

ALTER FUNCTION public.admin_mark_public_order_ready_safe(uuid)
  RENAME TO admin_mark_public_order_ready_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.admin_mark_public_order_ready_safe_internal_0d(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_public_order_ready_safe_internal_0d(uuid) TO service_role;

CREATE FUNCTION public.admin_mark_public_order_ready_safe(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id;
  IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'orders.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.admin_mark_public_order_ready_safe_internal_0d(p_order_id);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_mark_public_order_ready_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_public_order_ready_safe(uuid) TO authenticated, service_role;

ALTER FUNCTION public.admin_finalize_public_order_with_payment(uuid,text)
  RENAME TO admin_finalize_public_order_with_payment_internal_0d;
REVOKE EXECUTE ON FUNCTION public.admin_finalize_public_order_with_payment_internal_0d(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_public_order_with_payment_internal_0d(uuid,text) TO service_role;

CREATE FUNCTION public.admin_finalize_public_order_with_payment(p_order_id uuid,p_payment_method_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id;
  IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'orders.manage')
    OR public.user_has_store_permission(v_store_id,'pdv.payment.change')
    OR public.user_has_store_permission(v_store_id,'financial.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.admin_finalize_public_order_with_payment_internal_0d(p_order_id,p_payment_method_code);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_finalize_public_order_with_payment(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_finalize_public_order_with_payment(uuid,text) TO authenticated, service_role;

ALTER FUNCTION public.admin_set_public_order_payment_status_safe(uuid,text)
  RENAME TO admin_set_public_order_payment_status_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.admin_set_public_order_payment_status_safe_internal_0d(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_public_order_payment_status_safe_internal_0d(uuid,text) TO service_role;

CREATE FUNCTION public.admin_set_public_order_payment_status_safe(p_order_id uuid,p_payment_status text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id;
  IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'orders.manage')
    OR public.user_has_store_permission(v_store_id,'pdv.payment.change')
    OR public.user_has_store_permission(v_store_id,'financial.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.admin_set_public_order_payment_status_safe_internal_0d(p_order_id,p_payment_status);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.admin_set_public_order_payment_status_safe(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_public_order_payment_status_safe(uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Transferências
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.create_stock_transfer_draft_from_suggestion(uuid,uuid,uuid,numeric,text)
  RENAME TO create_stock_transfer_draft_from_suggestion_internal_0d;
REVOKE EXECUTE ON FUNCTION public.create_stock_transfer_draft_from_suggestion_internal_0d(uuid,uuid,uuid,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer_draft_from_suggestion_internal_0d(uuid,uuid,uuid,numeric,text) TO service_role;

CREATE FUNCTION public.create_stock_transfer_draft_from_suggestion(
  p_product_id uuid,p_source_location_id uuid,p_destination_location_id uuid,
  p_quantity numeric,p_notes text DEFAULT NULL
)
RETURNS TABLE(transfer_id uuid,transfer_code text,status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT p.store_id INTO v_store_id FROM public.products p WHERE p.id=p_product_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Produto não encontrado.' USING errcode='P0002'; END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'transfers.create')
    OR public.user_has_store_permission(v_store_id,'transfers.manage')
  )) THEN RAISE EXCEPTION 'Sem permissão para criar transferências.' USING errcode='42501'; END IF;
  RETURN QUERY SELECT * FROM public.create_stock_transfer_draft_from_suggestion_internal_0d(
    p_product_id,p_source_location_id,p_destination_location_id,p_quantity,p_notes
  );
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.create_stock_transfer_draft_from_suggestion(uuid,uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer_draft_from_suggestion(uuid,uuid,uuid,numeric,text) TO authenticated, service_role;

ALTER FUNCTION public.reverse_received_stock_transfer(uuid,text)
  RENAME TO reverse_received_stock_transfer_internal_0d;
REVOKE EXECUTE ON FUNCTION public.reverse_received_stock_transfer_internal_0d(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reverse_received_stock_transfer_internal_0d(uuid,text) TO service_role;

CREATE FUNCTION public.reverse_received_stock_transfer(p_transfer_id uuid,p_reason text)
RETURNS TABLE(transfer_id uuid,transfer_code text,status text,reversed_at timestamptz,total_reversed numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT st.store_id INTO v_store_id FROM public.stock_transfers st WHERE st.id=p_transfer_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Transferência não encontrada.' USING errcode='P0002'; END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'transfers.cancel')
    OR public.user_has_store_permission(v_store_id,'transfers.manage')
    OR public.user_has_store_permission(v_store_id,'stock.adjust')
  )) THEN RAISE EXCEPTION 'Sem permissão para reverter transferência recebida.' USING errcode='42501'; END IF;
  RETURN QUERY SELECT * FROM public.reverse_received_stock_transfer_internal_0d(p_transfer_id,p_reason);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.reverse_received_stock_transfer(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverse_received_stock_transfer(uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Segurança: senha master (owner-only para chamadas cliente)
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.reset_store_master_password(uuid,text)
  RENAME TO reset_store_master_password_internal_0d;
REVOKE EXECUTE ON FUNCTION public.reset_store_master_password_internal_0d(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_store_master_password_internal_0d(uuid,text) TO service_role;

CREATE FUNCTION public.reset_store_master_password(p_store_id uuid,p_new_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (
    auth.uid() IS NULL OR NOT public.app_is_store_owner(p_store_id)
  ) THEN
    RAISE EXCEPTION 'Somente o proprietário pode redefinir a senha master.' USING errcode='42501';
  END IF;
  PERFORM public.reset_store_master_password_internal_0d(p_store_id,p_new_password);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.reset_store_master_password(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_store_master_password(uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Mensagens: token/gateway é configuração sensível, owner-only para clientes.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.update_store_message_settings(uuid,text,jsonb)
  RENAME TO update_store_message_settings_internal_0d;
REVOKE EXECUTE ON FUNCTION public.update_store_message_settings_internal_0d(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_message_settings_internal_0d(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.update_store_message_settings(p_store_id uuid,p_sms_gateway_token text,p_config jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (
    auth.uid() IS NULL OR NOT public.app_is_store_owner(p_store_id)
  ) THEN
    RAISE EXCEPTION 'Somente o proprietário pode alterar credenciais de mensagens.' USING errcode='42501';
  END IF;
  PERFORM public.update_store_message_settings_internal_0d(p_store_id,p_sms_gateway_token,p_config);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_store_message_settings(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_store_message_settings(uuid,text,jsonb) TO authenticated, service_role;

ALTER FUNCTION public.update_store_message_settings_admin(uuid,text,jsonb)
  RENAME TO update_store_message_settings_admin_internal_0d;
REVOKE EXECUTE ON FUNCTION public.update_store_message_settings_admin_internal_0d(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_store_message_settings_admin_internal_0d(uuid,text,jsonb) TO service_role;

CREATE FUNCTION public.update_store_message_settings_admin(p_store_id uuid,p_sms_gateway_token text,p_config jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (
    auth.uid() IS NULL OR NOT public.app_is_store_owner(p_store_id)
  ) THEN
    RAISE EXCEPTION 'Somente o proprietário pode alterar credenciais de mensagens.' USING errcode='42501';
  END IF;
  PERFORM public.update_store_message_settings_admin_internal_0d(p_store_id,p_sms_gateway_token,p_config);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.update_store_message_settings_admin(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_store_message_settings_admin(uuid,text,jsonb) TO authenticated, service_role;

COMMIT;
