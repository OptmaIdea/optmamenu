-- Fidelidade Gelinhares: interrompe bonus fixo indevido em todo pedido.
-- A cartela de selos e sua configuracao permanecem intactas.
DO $$
DECLARE v_count integer;
BEGIN
  UPDATE public.loyalty_point_rules r
     SET active = false, updated_at = now(),
         metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
           'disabled_reason','fixed_bonus_without_eligibility_conditions',
           'disabled_at',now(),
           'remediation','use_stamps_campaign_engine_instead_of_order_bonus')
   WHERE r.store_id = (SELECT id FROM public.stores WHERE slug = 'gelinharessjn')
     AND r.code = 'vale5'
     AND r.active = true
     AND r.trigger_event = 'order_completed'
     AND r.points_mode = 'fixed'
     AND r.points_value = 5
     AND coalesce(r.conditions, '{}'::jsonb) = '{}'::jsonb;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'Unexpected more than one VALE5 row changed';
  END IF;
END $$;
