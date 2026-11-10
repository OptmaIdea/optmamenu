-- Restrict customer vouchers to fully supported fulfillment modes.
-- Raising from BEFORE INSERT aborts the whole redemption statement,
-- rolling back any balance debit or loyalty transaction in the RPC.
CREATE OR REPLACE FUNCTION public.enforce_loyalty_voucher_supported_fulfillment()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.request_key IS NOT NULL AND (
      NEW.points_transaction_id IS NULL
      OR NEW.points_cost < 1
      OR NEW.cash_due <> 0
      OR coalesce(NEW.reward_snapshot->>'type','') NOT IN ('product','other')
      OR nullif(NEW.reward_snapshot->>'product_id','') IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'loyalty_fulfillment_integration_pending' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_loyalty_voucher_supported_fulfillment ON public.fidelity_vouchers;
CREATE TRIGGER trg_loyalty_voucher_supported_fulfillment
 BEFORE INSERT ON public.fidelity_vouchers
 FOR EACH ROW EXECUTE FUNCTION public.enforce_loyalty_voucher_supported_fulfillment();

ALTER TABLE public.fidelity_vouchers
 ADD COLUMN IF NOT EXISTS used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.get_admin_loyalty_vouchers_safe(
 p_store_id uuid, p_code text DEFAULT NULL, p_limit integer DEFAULT 60
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 v_rows jsonb;
 v_code text := nullif(upper(trim(coalesce(p_code,''))),'');
BEGIN
 IF auth.uid() IS NULL OR p_store_id IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission_v2(p_store_id,'loyalty.view')
      OR public.user_has_store_permission_v2(p_store_id,'loyalty.manage')
 ) THEN
   RETURN jsonb_build_object('ok',false,'error','access_denied');
 END IF;
 IF v_code IS NOT NULL AND (length(v_code)<6 OR length(v_code)>80) THEN
   RETURN jsonb_build_object('ok',false,'error','invalid_code');
 END IF;

 SELECT coalesce(jsonb_agg(to_jsonb(vrow) ORDER BY vrow.created_at DESC),'[]'::jsonb) INTO v_rows
 FROM (
   SELECT v.id,v.customer_id,v.code,v.status,v.expires_at,v.used_at,v.used_by,
          v.created_at,v.reward_id,v.points_cost,v.cash_due,v.reward_snapshot,
          coalesce(nullif(c.nickname,''),c.full_name,'Cliente') AS customer_name,
          c.phone AS customer_phone,
          coalesce(nullif(v.reward_snapshot->>'title',''),r.title,'Prêmio') AS reward_title,
          (v.status='active' AND v.expires_at>now()) AS redeemable,
          (v.reward_snapshot->>'type' IN ('product','other')
            AND nullif(v.reward_snapshot->>'product_id','') IS NULL
            AND v.cash_due=0 AND v.points_transaction_id IS NOT NULL) AS independent_fulfillment
   FROM public.fidelity_vouchers v
   JOIN public.customers c ON c.id=v.customer_id AND c.store_id=v.store_id
   LEFT JOIN public.fidelity_rewards r ON r.id=v.reward_id
   WHERE v.store_id=p_store_id
     AND (v_code IS NULL OR upper(v.code)=v_code)
   ORDER BY v.created_at DESC
   LIMIT least(greatest(coalesce(p_limit,60),1),200)
 ) vrow;

 RETURN jsonb_build_object('ok',true,'vouchers',v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_use_loyalty_voucher_safe(
 p_store_id uuid, p_voucher_id uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=public,pg_temp AS $$
DECLARE
 v_voucher public.fidelity_vouchers%ROWTYPE;
 v_reward_type text;
BEGIN
 IF auth.uid() IS NULL OR p_store_id IS NULL OR p_voucher_id IS NULL OR NOT (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission_v2(p_store_id,'loyalty.manage')
 ) THEN
   RETURN jsonb_build_object('ok',false,'error','access_denied');
 END IF;
 SELECT * INTO v_voucher FROM public.fidelity_vouchers v
   WHERE v.id=p_voucher_id AND v.store_id=p_store_id FOR UPDATE;
 IF NOT FOUND THEN
   RETURN jsonb_build_object('ok',false,'error','voucher_not_found');
 END IF;
 IF v_voucher.status='used' THEN
   RETURN jsonb_build_object('ok',false,'error','voucher_already_used','used_at',v_voucher.used_at);
 END IF;
 IF v_voucher.status<>'active' OR v_voucher.expires_at<=clock_timestamp() THEN
   RETURN jsonb_build_object('ok',false,'error','voucher_expired');
 END IF;
 v_reward_type:=v_voucher.reward_snapshot->>'type';
 IF v_voucher.points_transaction_id IS NULL
    OR v_reward_type NOT IN ('product','other')
    OR nullif(v_voucher.reward_snapshot->>'product_id','') IS NOT NULL
    OR v_voucher.cash_due<>0 THEN
   RETURN jsonb_build_object('ok',false,'error','fulfillment_integration_pending');
 END IF;
 UPDATE public.fidelity_vouchers SET status='used',used_at=now(),used_by=auth.uid()
 WHERE id=p_voucher_id AND store_id=p_store_id;
 RETURN jsonb_build_object('ok',true,'voucher_id',p_voucher_id,'code',v_voucher.code,'status','used','used_at',now());
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_loyalty_vouchers_safe(uuid,text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_use_loyalty_voucher_safe(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_loyalty_vouchers_safe(uuid,text,integer) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_use_loyalty_voucher_safe(uuid,uuid) TO authenticated,service_role;