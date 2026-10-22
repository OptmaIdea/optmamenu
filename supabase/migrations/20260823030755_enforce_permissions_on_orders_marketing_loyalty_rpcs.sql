-- Homologação 0D.6 — autorização explícita em RPCs críticas de pedidos,
-- campanhas e fidelidade que antes aceitavam qualquer membro da loja.

BEGIN;

-- Helpers internos são renomeados e deixam de ser invocáveis diretamente
-- por clientes. Wrappers preservam as assinaturas consumidas pelo frontend.

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.admin_cancel_public_order_safe(uuid, text)
  RENAME TO admin_cancel_public_order_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_public_order_safe_internal_0d(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_public_order_safe_internal_0d(uuid, text) TO service_role;

CREATE FUNCTION public.admin_cancel_public_order_safe(
  p_order_id uuid,
  p_reason text DEFAULT 'Cancelado pelo painel administrativo'::text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id;
  IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'orders.cancel')
    OR public.user_has_store_permission(v_store_id,'orders.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.admin_cancel_public_order_safe_internal_0d(p_order_id,p_reason);
END;$function$;
REVOKE EXECUTE ON FUNCTION public.admin_cancel_public_order_safe(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_public_order_safe(uuid,text) TO authenticated, service_role;

ALTER FUNCTION public.admin_complete_public_order_safe(uuid)
  RENAME TO admin_complete_public_order_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.admin_complete_public_order_safe_internal_0d(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_public_order_safe_internal_0d(uuid) TO service_role;

CREATE FUNCTION public.admin_complete_public_order_safe(p_order_id uuid)
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
  RETURN public.admin_complete_public_order_safe_internal_0d(p_order_id);
END;$function$;
REVOKE EXECUTE ON FUNCTION public.admin_complete_public_order_safe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_complete_public_order_safe(uuid) TO authenticated, service_role;

ALTER FUNCTION public.confirm_order_payment(uuid)
  RENAME TO confirm_order_payment_internal_0d;
REVOKE EXECUTE ON FUNCTION public.confirm_order_payment_internal_0d(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment_internal_0d(uuid) TO service_role;

CREATE FUNCTION public.confirm_order_payment(p_order_id uuid)
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
    OR public.user_has_store_permission(v_store_id,'financial.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.confirm_order_payment_internal_0d(p_order_id);
END;$function$;
REVOKE EXECUTE ON FUNCTION public.confirm_order_payment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirm_order_payment(uuid) TO authenticated, service_role;

ALTER FUNCTION public.extend_reservation(uuid, integer)
  RENAME TO extend_reservation_internal_0d;
REVOKE EXECUTE ON FUNCTION public.extend_reservation_internal_0d(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.extend_reservation_internal_0d(uuid, integer) TO service_role;

CREATE FUNCTION public.extend_reservation(p_order_id uuid,p_minutes integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_store_id uuid; v_role text := coalesce(auth.role(),'');
BEGIN
  SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id;
  IF v_store_id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado.' USING errcode='P0002'; END IF;
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(v_store_id)
    OR public.user_has_store_permission(v_store_id,'orders.manage')
  )) THEN RAISE EXCEPTION 'Sem permissão para estender reservas.' USING errcode='42501'; END IF;
  PERFORM public.extend_reservation_internal_0d(p_order_id,p_minutes);
END;$function$;
REVOKE EXECUTE ON FUNCTION public.extend_reservation(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.extend_reservation(uuid,integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Marketing / campanhas
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.build_campaign_recipients_preview_safe(uuid,uuid,text,uuid,uuid,text,text,integer)
  RENAME TO build_campaign_recipients_preview_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.build_campaign_recipients_preview_safe_internal_0d(uuid,uuid,text,uuid,uuid,text,text,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_campaign_recipients_preview_safe_internal_0d(uuid,uuid,text,uuid,uuid,text,text,integer) TO service_role;

CREATE FUNCTION public.build_campaign_recipients_preview_safe(
  p_store_id uuid,
  p_campaign_id uuid DEFAULT NULL,
  p_target_type text DEFAULT 'all',
  p_target_segment_id uuid DEFAULT NULL,
  p_target_customer_id uuid DEFAULT NULL,
  p_target_tag text DEFAULT NULL,
  p_channel text DEFAULT 'whatsapp',
  p_limit integer DEFAULT 100
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'marketing.view')
    OR public.user_has_store_permission(p_store_id,'marketing.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.build_campaign_recipients_preview_safe_internal_0d(
    p_store_id,p_campaign_id,p_target_type,p_target_segment_id,p_target_customer_id,
    p_target_tag,p_channel,p_limit
  );
END;$function$;
REVOKE EXECUTE ON FUNCTION public.build_campaign_recipients_preview_safe(uuid,uuid,text,uuid,uuid,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.build_campaign_recipients_preview_safe(uuid,uuid,text,uuid,uuid,text,text,integer) TO authenticated, service_role;

ALTER FUNCTION public.prepare_campaign_recipients_safe(uuid,uuid,integer)
  RENAME TO prepare_campaign_recipients_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.prepare_campaign_recipients_safe_internal_0d(uuid,uuid,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_campaign_recipients_safe_internal_0d(uuid,uuid,integer) TO service_role;

CREATE FUNCTION public.prepare_campaign_recipients_safe(p_store_id uuid,p_campaign_id uuid,p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'marketing.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.prepare_campaign_recipients_safe_internal_0d(p_store_id,p_campaign_id,p_limit);
END;$function$;
REVOKE EXECUTE ON FUNCTION public.prepare_campaign_recipients_safe(uuid,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prepare_campaign_recipients_safe(uuid,uuid,integer) TO authenticated, service_role;

ALTER FUNCTION public.mark_campaign_recipient_manual_sent_safe(uuid,uuid)
  RENAME TO mark_campaign_recipient_manual_sent_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.mark_campaign_recipient_manual_sent_safe_internal_0d(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_campaign_recipient_manual_sent_safe_internal_0d(uuid,uuid) TO service_role;

CREATE FUNCTION public.mark_campaign_recipient_manual_sent_safe(p_store_id uuid,p_recipient_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'marketing.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.mark_campaign_recipient_manual_sent_safe_internal_0d(p_store_id,p_recipient_id);
END;$function$;
REVOKE EXECUTE ON FUNCTION public.mark_campaign_recipient_manual_sent_safe(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_campaign_recipient_manual_sent_safe(uuid,uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Segmentos / benefícios / regras de fidelidade / promoções
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.upsert_customer_segment_safe(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb)
  RENAME TO upsert_customer_segment_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.upsert_customer_segment_safe_internal_0d(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer_segment_safe_internal_0d(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.upsert_customer_segment_safe(
  p_store_id uuid,p_segment_id uuid DEFAULT NULL,p_code text DEFAULT NULL,p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,p_segment_type text DEFAULT 'manual',p_active boolean DEFAULT true,
  p_rules jsonb DEFAULT '{}'::jsonb,p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'marketing.manage')
    OR public.user_has_store_permission(p_store_id,'customers.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.upsert_customer_segment_safe_internal_0d(
    p_store_id,p_segment_id,p_code,p_name,p_description,p_segment_type,p_active,p_rules,p_metadata
  );
END;$function$;
REVOKE EXECUTE ON FUNCTION public.upsert_customer_segment_safe(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_customer_segment_safe(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb) TO authenticated, service_role;

ALTER FUNCTION public.upsert_customer_benefit_rule_safe(uuid,uuid,text,text,text,text,text,uuid,uuid,text,numeric,numeric,integer,boolean,numeric,integer,integer,boolean,timestamptz,timestamptz,jsonb,jsonb)
  RENAME TO upsert_customer_benefit_rule_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.upsert_customer_benefit_rule_safe_internal_0d(uuid,uuid,text,text,text,text,text,uuid,uuid,text,numeric,numeric,integer,boolean,numeric,integer,integer,boolean,timestamptz,timestamptz,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer_benefit_rule_safe_internal_0d(uuid,uuid,text,text,text,text,text,uuid,uuid,text,numeric,numeric,integer,boolean,numeric,integer,integer,boolean,timestamptz,timestamptz,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.upsert_customer_benefit_rule_safe(
  p_store_id uuid,p_rule_id uuid DEFAULT NULL,p_code text DEFAULT NULL,p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,p_benefit_type text DEFAULT 'discount_percent',p_target_type text DEFAULT 'all',
  p_target_tier_id uuid DEFAULT NULL,p_target_customer_id uuid DEFAULT NULL,p_target_tag text DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL,p_discount_amount numeric DEFAULT NULL,p_bonus_points integer DEFAULT NULL,
  p_free_delivery boolean DEFAULT false,p_minimum_order_value numeric DEFAULT 0,p_max_uses_total integer DEFAULT NULL,
  p_max_uses_per_customer integer DEFAULT NULL,p_active boolean DEFAULT true,p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,p_conditions jsonb DEFAULT '{}'::jsonb,p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'loyalty.manage')
    OR public.user_has_store_permission(p_store_id,'marketing.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.upsert_customer_benefit_rule_safe_internal_0d(
    p_store_id,p_rule_id,p_code,p_name,p_description,p_benefit_type,p_target_type,
    p_target_tier_id,p_target_customer_id,p_target_tag,p_discount_percent,p_discount_amount,
    p_bonus_points,p_free_delivery,p_minimum_order_value,p_max_uses_total,p_max_uses_per_customer,
    p_active,p_starts_at,p_ends_at,p_conditions,p_metadata
  );
END;$function$;
REVOKE EXECUTE ON FUNCTION public.upsert_customer_benefit_rule_safe(uuid,uuid,text,text,text,text,text,uuid,uuid,text,numeric,numeric,integer,boolean,numeric,integer,integer,boolean,timestamptz,timestamptz,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_customer_benefit_rule_safe(uuid,uuid,text,text,text,text,text,uuid,uuid,text,numeric,numeric,integer,boolean,numeric,integer,integer,boolean,timestamptz,timestamptz,jsonb,jsonb) TO authenticated, service_role;

ALTER FUNCTION public.upsert_loyalty_point_rule_safe(uuid,uuid,text,text,text,text,text,text,numeric,integer,boolean,boolean,timestamptz,timestamptz,jsonb,jsonb)
  RENAME TO upsert_loyalty_point_rule_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.upsert_loyalty_point_rule_safe_internal_0d(uuid,uuid,text,text,text,text,text,text,numeric,integer,boolean,boolean,timestamptz,timestamptz,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_loyalty_point_rule_safe_internal_0d(uuid,uuid,text,text,text,text,text,text,numeric,integer,boolean,boolean,timestamptz,timestamptz,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.upsert_loyalty_point_rule_safe(
  p_store_id uuid,p_rule_id uuid DEFAULT NULL,p_code text DEFAULT NULL,p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,p_trigger_event text DEFAULT 'order_completed',p_rule_type text DEFAULT 'per_currency',
  p_points_mode text DEFAULT 'per_currency',p_points_value numeric DEFAULT 1,p_priority integer DEFAULT 100,
  p_stackable boolean DEFAULT true,p_active boolean DEFAULT true,p_starts_at timestamptz DEFAULT NULL,
  p_ends_at timestamptz DEFAULT NULL,p_conditions jsonb DEFAULT '{}'::jsonb,p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'loyalty.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.upsert_loyalty_point_rule_safe_internal_0d(
    p_store_id,p_rule_id,p_code,p_name,p_description,p_trigger_event,p_rule_type,p_points_mode,
    p_points_value,p_priority,p_stackable,p_active,p_starts_at,p_ends_at,p_conditions,p_metadata
  );
END;$function$;
REVOKE EXECUTE ON FUNCTION public.upsert_loyalty_point_rule_safe(uuid,uuid,text,text,text,text,text,text,numeric,integer,boolean,boolean,timestamptz,timestamptz,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_loyalty_point_rule_safe(uuid,uuid,text,text,text,text,text,text,numeric,integer,boolean,boolean,timestamptz,timestamptz,jsonb,jsonb) TO authenticated, service_role;

ALTER FUNCTION public.upsert_promotion_campaign_safe(uuid,uuid,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,uuid,timestamptz,timestamptz,timestamptz,boolean,jsonb,jsonb)
  RENAME TO upsert_promotion_campaign_safe_internal_0d;
REVOKE EXECUTE ON FUNCTION public.upsert_promotion_campaign_safe_internal_0d(uuid,uuid,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,uuid,timestamptz,timestamptz,timestamptz,boolean,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_promotion_campaign_safe_internal_0d(uuid,uuid,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,uuid,timestamptz,timestamptz,timestamptz,boolean,jsonb,jsonb) TO service_role;

CREATE FUNCTION public.upsert_promotion_campaign_safe(
  p_store_id uuid,p_campaign_id uuid DEFAULT NULL,p_code text DEFAULT NULL,p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,p_campaign_type text DEFAULT 'communication',p_status text DEFAULT 'draft',
  p_target_type text DEFAULT 'all',p_target_segment_id uuid DEFAULT NULL,p_target_customer_id uuid DEFAULT NULL,
  p_target_tag text DEFAULT NULL,p_channel text DEFAULT 'whatsapp',p_title text DEFAULT NULL,
  p_message_template text DEFAULT NULL,p_call_to_action text DEFAULT NULL,p_landing_url text DEFAULT NULL,
  p_benefit_rule_id uuid DEFAULT NULL,p_starts_at timestamptz DEFAULT NULL,p_ends_at timestamptz DEFAULT NULL,
  p_scheduled_at timestamptz DEFAULT NULL,p_active boolean DEFAULT true,p_conditions jsonb DEFAULT '{}'::jsonb,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp'
AS $function$
DECLARE v_role text := coalesce(auth.role(),'');
BEGIN
  IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (
    public.app_is_store_owner(p_store_id)
    OR public.user_has_store_permission(p_store_id,'marketing.manage')
  )) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF;
  RETURN public.upsert_promotion_campaign_safe_internal_0d(
    p_store_id,p_campaign_id,p_code,p_name,p_description,p_campaign_type,p_status,p_target_type,
    p_target_segment_id,p_target_customer_id,p_target_tag,p_channel,p_title,p_message_template,
    p_call_to_action,p_landing_url,p_benefit_rule_id,p_starts_at,p_ends_at,p_scheduled_at,p_active,
    p_conditions,p_metadata
  );
END;$function$;
REVOKE EXECUTE ON FUNCTION public.upsert_promotion_campaign_safe(uuid,uuid,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,uuid,timestamptz,timestamptz,timestamptz,boolean,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_promotion_campaign_safe(uuid,uuid,text,text,text,text,text,text,uuid,uuid,text,text,text,text,text,text,uuid,timestamptz,timestamptz,timestamptz,boolean,jsonb,jsonb) TO authenticated, service_role;

COMMIT;
