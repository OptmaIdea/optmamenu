-- P11: atomic checkout advance-payment configuration scoped to one store.
-- A financial destination is an internal OptmaMenu account, not necessarily a PSP.
-- This RPC does not initiate charges, contact banks or mark any payment paid.
BEGIN;

CREATE OR REPLACE FUNCTION public.configure_store_checkout_prepayment_safe(
  p_store_id uuid,
  p_method_code text,
  p_enabled boolean,
  p_destination_account_id uuid DEFAULT NULL,
  p_pix_key text DEFAULT NULL,
  p_pix_recipient text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $fn$
DECLARE
  v_method public.store_payment_methods%ROWTYPE;
  v_confirmation text;
  v_provider text;
  v_feature text;
  v_allowed boolean;
  v_route text;
  v_pix_key text;
  v_pix_recipient text;
BEGIN
  v_allowed :=
    auth.uid() IS NOT NULL
    AND (
      public.app_is_store_owner(p_store_id)
      OR public.user_has_store_permission_v2(p_store_id, 'payments.online.manage')
      OR public.user_has_store_permission_v2(p_store_id, 'payment_methods.manage')
    );
  IF NOT coalesce(v_allowed,false) THEN
    RETURN jsonb_build_object('ok',false,'error','access_denied');
  END IF;
  IF p_method_code IS NULL OR p_method_code NOT IN
    ('pix_manual_qr','pix','credit_card','debit_card') THEN
    RETURN jsonb_build_object('ok',false,'error','unsupported_method');
  END IF;
  IF p_enabled IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','enabled_required');
  END IF;

  SELECT * INTO v_method
  FROM public.store_payment_methods
  WHERE store_id=p_store_id AND code=p_method_code
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','payment_method_not_found');
  END IF;

  IF p_enabled THEN
    IF p_destination_account_id IS NULL OR NOT EXISTS(
      SELECT 1 FROM public.store_financial_accounts a
      WHERE a.id=p_destination_account_id AND a.store_id=p_store_id AND a.active=true
    ) THEN
      RETURN jsonb_build_object('ok',false,'error','invalid_destination_account');
    END IF;
    IF p_method_code='pix_manual_qr' THEN
      v_pix_key := coalesce(nullif(btrim(p_pix_key),''),
        nullif(btrim(v_method.metadata->'checkout'->>'pix_key'),''));
      v_pix_recipient := coalesce(nullif(btrim(p_pix_recipient),''),
        nullif(btrim(v_method.metadata->'checkout'->>'pix_recipient'),''));
      IF v_pix_key IS NULL OR length(v_pix_key)>140 OR
         v_pix_recipient IS NULL OR length(v_pix_recipient)>120 THEN
        RETURN jsonb_build_object('ok',false,'error','manual_pix_instructions_required');
      END IF;
      IF v_method.requires_proof IS DISTINCT FROM true
         OR coalesce(v_method.metadata->'checkout'->>'confirmation_mode','') <> 'manual_proof' THEN
        RETURN jsonb_build_object('ok',false,'error','manual_proof_not_configured');
      END IF;
    ELSE
      v_confirmation := coalesce(v_method.metadata->'checkout'->>'confirmation_mode','');
      v_provider := nullif(v_method.metadata->'checkout'->>'provider_code','');
      v_feature := case
        when p_method_code='pix' then 'pix'
        when p_method_code='credit_card' then 'credit_card'
        else 'debit_card'
      end;
      -- Only an actually configured API integration may offer automatic confirmation.
      -- The current OptmaPay integration is a SIMULATOR. No real-bank PSP is invented.
      IF v_confirmation<>'api'
         OR v_provider IS NULL
         OR NOT EXISTS(
           SELECT 1 FROM public.store_online_payment_providers p
           WHERE p.store_id=p_store_id AND p.provider_code=v_provider
             AND p.enabled=true AND p.credential_status='ready'
             AND coalesce((p.capabilities->>v_feature)::boolean,false)=true
         ) THEN
        RETURN jsonb_build_object('ok',false,'error','provider_capability_unavailable');
      END IF;
    END IF;
  END IF;

  UPDATE public.store_payment_methods
  SET active=CASE WHEN p_enabled THEN true ELSE active END,
      public_enabled=CASE WHEN p_enabled THEN true ELSE public_enabled END,
      metadata=CASE WHEN p_method_code='pix_manual_qr' AND p_enabled
        THEN jsonb_set(
            jsonb_set(
              jsonb_set(coalesce(metadata,'{}'::jsonb),
                '{checkout,pay_now}',to_jsonb(p_enabled),true),
              '{checkout,pix_key}',to_jsonb(v_pix_key),true),
            '{checkout,pix_recipient}',to_jsonb(v_pix_recipient),true)
        ELSE jsonb_set(coalesce(metadata,'{}'::jsonb),
          '{checkout,pay_now}',to_jsonb(p_enabled),true)
      END
  WHERE id=v_method.id;

  -- Atomic configuration for pickup and delivery; no changes to existing orders.
  FOREACH v_route IN ARRAY ARRAY['pickup','delivery'] LOOP
    IF p_enabled THEN
      INSERT INTO public.store_order_payment_account_routes (
        store_id,scope,fulfillment_type,payment_timing,payment_method_code,
        destination_financial_account_id,active,allow_override_on_receipt,sort_order,metadata
      )
      VALUES (
        p_store_id,'public_store',v_route,'advance',p_method_code,
        p_destination_account_id,true,false,100,
        jsonb_build_object('configured_by','checkout_prepayment_ui','configured_at',now())
      )
      ON CONFLICT(store_id,scope,fulfillment_type,payment_timing,payment_method_code)
      DO UPDATE SET destination_financial_account_id=EXCLUDED.destination_financial_account_id,
        active=true,updated_at=now(),
        metadata=coalesce(public.store_order_payment_account_routes.metadata,'{}'::jsonb)
          || EXCLUDED.metadata;
    ELSE
      UPDATE public.store_order_payment_account_routes
      SET active=false,updated_at=now()
      WHERE store_id=p_store_id AND scope='public_store'
        AND fulfillment_type=v_route AND payment_timing='advance'
        AND payment_method_code=p_method_code;
    END IF;
  END LOOP;
  RETURN jsonb_build_object(
    'ok',true,'method_code',p_method_code,'enabled',p_enabled,
    'destination_financial_account_id',CASE WHEN p_enabled THEN p_destination_account_id ELSE NULL END,
    'routes_updated',2
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.configure_store_checkout_prepayment_safe(uuid,text,boolean,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.configure_store_checkout_prepayment_safe(uuid,text,boolean,uuid)
  TO authenticated,service_role;
COMMIT;
