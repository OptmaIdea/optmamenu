-- Homologação 0D.4 — hardening de auxiliares internos e RPCs autenticadas.
--
-- 1) auxiliares de estoque/log ficam somente para chamadas internas/service_role;
-- 2) mensagens administrativas passam a exigir owner/messages.manage/marketing.manage;
-- 3) redeem_reward passa a validar tenant + permissão antes de alterar pontos/estoque.

-- Helpers internos: chamadas vindas de outras SECURITY DEFINER continuam funcionando
-- sob o owner da função; clientes authenticated deixam de poder invocá-las diretamente.
REVOKE EXECUTE ON FUNCTION public.insert_security_log(uuid, uuid, text, text, jsonb, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_security_log(uuid, uuid, text, text, jsonb, text)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_order_stock(uuid, uuid, public.order_item_reserve_input[], uuid, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_order_stock(uuid, uuid, public.order_item_reserve_input[], uuid, jsonb)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_stock(uuid, uuid, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, uuid, integer)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_stock(uuid, uuid, numeric, uuid, uuid, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, uuid, numeric, uuid, uuid, jsonb)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.return_stock_after_confirm(uuid, uuid, uuid, numeric, uuid, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_stock_after_confirm(uuid, uuid, uuid, numeric, uuid, jsonb)
TO service_role;

REVOKE EXECUTE ON FUNCTION public.return_stock_after_confirm(uuid, uuid, numeric, uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.return_stock_after_confirm(uuid, uuid, numeric, uuid, uuid)
TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_old_messages(p_store_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := coalesce(auth.role(), '');
  deleted_count integer;
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'Loja não informada.' USING errcode = '22023';
  END IF;

  IF v_role IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission(p_store_id, 'messages.manage')
      OR public.user_has_store_permission(p_store_id, 'marketing.manage')
    ) THEN
      RAISE EXCEPTION 'Sem permissão para limpar mensagens desta loja.' USING errcode = '42501';
    END IF;
  END IF;

  DELETE FROM public.store_messages
  WHERE store_id = p_store_id
    AND (expires_at < now() OR expires_at IS NULL);

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cleanup_old_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_old_messages(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.send_admin_message(
  p_store_id uuid,
  p_title text,
  p_message text,
  p_recipient_ids uuid[] DEFAULT NULL::uuid[],
  p_expires_in_days integer DEFAULT 30
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := coalesce(auth.role(), '');
  v_message_id uuid;
  v_expires_days integer := least(greatest(coalesce(p_expires_in_days, 30), 1), 365);
BEGIN
  IF p_store_id IS NULL THEN
    RAISE EXCEPTION 'Loja não informada.' USING errcode = '22023';
  END IF;

  IF nullif(btrim(coalesce(p_title, '')), '') IS NULL
     OR nullif(btrim(coalesce(p_message, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Título e mensagem são obrigatórios.' USING errcode = '22023';
  END IF;

  IF v_role IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission(p_store_id, 'messages.manage')
      OR public.user_has_store_permission(p_store_id, 'marketing.manage')
    ) THEN
      RAISE EXCEPTION 'Sem permissão para enviar mensagens nesta loja.' USING errcode = '42501';
    END IF;
  END IF;

  INSERT INTO public.store_messages (store_id, title, message, expires_at)
  VALUES (
    p_store_id,
    btrim(p_title),
    btrim(p_message),
    now() + make_interval(days => v_expires_days)
  )
  RETURNING id INTO v_message_id;

  IF p_recipient_ids IS NULL THEN
    INSERT INTO public.customer_notifications (customer_id, store_id, title, message, message_id)
    SELECT c.id, p_store_id, btrim(p_title), btrim(p_message), v_message_id
    FROM public.customers c
    WHERE c.store_id = p_store_id
      AND c.status = 'active';
  ELSE
    INSERT INTO public.customer_notifications (customer_id, store_id, title, message, message_id)
    SELECT c.id, p_store_id, btrim(p_title), btrim(p_message), v_message_id
    FROM unnest(p_recipient_ids) AS rid
    JOIN public.customers c ON c.id = rid
    WHERE c.store_id = p_store_id
      AND c.status = 'active';
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_admin_message(uuid, text, text, uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_admin_message(uuid, text, text, uuid[], integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.redeem_reward(p_customer_id uuid, p_reward_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role text := coalesce(auth.role(), '');
  v_reward public.fidelity_rewards%rowtype;
  v_customer public.customers%rowtype;
  v_voucher_code text;
  v_voucher_id uuid;
  v_program_store_id uuid;
  v_existing_redemptions integer;
BEGIN
  IF p_customer_id IS NULL OR p_reward_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cliente e recompensa são obrigatórios.');
  END IF;

  SELECT * INTO v_reward
  FROM public.fidelity_rewards
  WHERE id = p_reward_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Recompensa não encontrada.');
  END IF;

  SELECT fp.store_id INTO v_program_store_id
  FROM public.fidelity_programs fp
  WHERE fp.id = v_reward.program_id;

  IF v_program_store_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Programa de fidelidade inválido.');
  END IF;

  IF v_role IN ('anon', 'authenticated') THEN
    IF auth.uid() IS NULL OR NOT (
      public.app_is_store_owner(v_program_store_id)
      OR public.user_has_store_permission(v_program_store_id, 'loyalty.manage')
    ) THEN
      RETURN jsonb_build_object('success', false, 'message', 'Sem permissão para resgatar recompensas.');
    END IF;
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.store_id = v_program_store_id
    AND c.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cliente não encontrado nesta loja.');
  END IF;

  IF coalesce(v_customer.loyalty_opt_in, false) = false THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cliente não participa do programa de fidelidade.');
  END IF;

  IF coalesce(v_reward.is_active, false) = false THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta recompensa não está mais ativa.');
  END IF;

  IF v_reward.stock_quantity IS NOT NULL AND v_reward.stock_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Estoque esgotado para esta recompensa.');
  END IF;

  IF v_reward.offer_valid_until IS NOT NULL AND v_reward.offer_valid_until < now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Esta oferta expirou.');
  END IF;

  IF v_reward.max_redemptions_per_customer IS NOT NULL THEN
    SELECT count(*) INTO v_existing_redemptions
    FROM public.fidelity_vouchers fv
    WHERE fv.customer_id = p_customer_id
      AND fv.reward_id = p_reward_id
      AND fv.store_id = v_program_store_id;

    IF v_existing_redemptions >= v_reward.max_redemptions_per_customer THEN
      RETURN jsonb_build_object('success', false, 'message', 'Você atingiu o limite de resgates para este prêmio.');
    END IF;
  END IF;

  IF coalesce(v_customer.loyalty_points, 0) < v_reward.points_cost THEN
    RETURN jsonb_build_object('success', false, 'message', 'Pontos insuficientes.');
  END IF;

  UPDATE public.customers
  SET loyalty_points = loyalty_points - v_reward.points_cost,
      last_point_activity_at = now(),
      updated_at = now()
  WHERE id = p_customer_id
    AND store_id = v_program_store_id;

  v_voucher_code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

  INSERT INTO public.fidelity_vouchers (
    store_id, customer_id, reward_id, code, status, expires_at, created_at
  ) VALUES (
    v_program_store_id,
    p_customer_id,
    v_reward.id,
    v_voucher_code,
    'active',
    now() + make_interval(days => coalesce(v_reward.voucher_validity_days, 15)),
    now()
  ) RETURNING id INTO v_voucher_id;

  IF v_reward.stock_quantity IS NOT NULL THEN
    UPDATE public.fidelity_rewards
    SET stock_quantity = stock_quantity - 1
    WHERE id = p_reward_id
      AND stock_quantity > 0;
  END IF;

  INSERT INTO public.fidelity_transactions (
    program_id, customer_id, type, points, description
  ) VALUES (
    v_reward.program_id,
    p_customer_id,
    'redeem',
    -v_reward.points_cost,
    'Resgate: ' || v_reward.title
  );

  RETURN jsonb_build_object(
    'success', true,
    'voucher_code', v_voucher_code,
    'voucher_id', v_voucher_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) TO authenticated, service_role;
