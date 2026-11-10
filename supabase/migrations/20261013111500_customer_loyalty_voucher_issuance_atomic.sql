-- Safe, store-scoped and idempotent customer loyalty voucher issuance.
-- Uses the existing loyalty_transactions ledger; no migration of balances or existing vouchers.
ALTER TABLE public.fidelity_vouchers
  ADD COLUMN IF NOT EXISTS request_key uuid,
  ADD COLUMN IF NOT EXISTS points_transaction_id uuid REFERENCES public.loyalty_transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS points_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cash_due numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fidelity_vouchers_store_code_unique
  ON public.fidelity_vouchers (store_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_fidelity_vouchers_idempotency_unique
  ON public.fidelity_vouchers (store_id, customer_id, request_key)
  WHERE request_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fidelity_vouchers_points_transaction_unique
  ON public.fidelity_vouchers (points_transaction_id)
  WHERE points_transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.customer_redeem_loyalty_reward_safe(
    p_reward_id uuid, p_request_key uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
    v_customer_id uuid := public.app_current_customer_id();
    v_store_id uuid := public.app_current_store_id();
    v_customer public.customers%ROWTYPE;
    v_reward public.fidelity_rewards%ROWTYPE;
    v_existing public.fidelity_vouchers%ROWTYPE;
    v_transaction_id uuid;
    v_voucher_id uuid;
    v_code text;
    v_points integer;
    v_issued_count integer;
    v_snapshot jsonb;
BEGIN
    IF public.app_current_role() <> 'customer'
       OR v_customer_id IS NULL OR v_store_id IS NULL
       OR p_reward_id IS NULL OR p_request_key IS NULL THEN
        RETURN jsonb_build_object('ok',false,'error','access_denied');
    END IF;

    -- Serialize every redemption for this customer, even if two requests target different rewards.
    SELECT * INTO v_customer FROM public.customers
      WHERE id=v_customer_id AND store_id=v_store_id
      FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok',false,'error','customer_not_found');
    END IF;

    -- A retried request returns the original voucher, without a second debit.
    SELECT * INTO v_existing FROM public.fidelity_vouchers
     WHERE store_id=v_store_id AND customer_id=v_customer_id AND request_key=p_request_key;
    IF FOUND THEN
        IF v_existing.reward_id IS DISTINCT FROM p_reward_id THEN
            RETURN jsonb_build_object('ok',false,'error','idempotency_key_conflict');
        END IF;
        RETURN jsonb_build_object(
            'ok',true,'replayed',true,'voucher_id',v_existing.id,
            'code',v_existing.code,'expires_at',v_existing.expires_at,
            'points_cost',v_existing.points_cost,'cash_due',v_existing.cash_due,
            'new_balance',coalesce(v_customer.loyalty_points,0)
        );
    END IF;

    IF v_customer.status <> 'active'
       OR coalesce(v_customer.loyalty_opt_in,false) = false
       OR coalesce((v_customer.customer_metadata->>'operational_customer')::boolean,false) = true THEN
        RETURN jsonb_build_object('ok',false,'error','customer_not_eligible');
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.fidelity_membership_blocks b
         WHERE b.store_id=v_store_id AND b.unblocked_at IS NULL
           AND (b.customer_id=v_customer_id OR (
             length(regexp_replace(coalesce(v_customer.cpf,''),'\\D','','g'))=11
             AND b.cpf_hash=public.fidelity_cpf_hash(v_store_id,v_customer.cpf)
           ))
    ) THEN
        RETURN jsonb_build_object('ok',false,'error','membership_blocked');
    END IF;

    SELECT r.* INTO v_reward
      FROM public.fidelity_rewards r
      JOIN public.fidelity_programs fp ON fp.id=r.program_id
     WHERE r.id=p_reward_id AND fp.store_id=v_store_id AND fp.is_active=true
      FOR UPDATE OF r;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok',false,'error','reward_unavailable');
    END IF;
    IF coalesce(v_reward.is_active,false)=false
       OR (v_reward.offer_valid_until IS NOT NULL AND v_reward.offer_valid_until<=now())
       OR (v_reward.stock_quantity IS NOT NULL AND v_reward.stock_quantity<=0) THEN
        RETURN jsonb_build_object('ok',false,'error','reward_unavailable');
    END IF;
    IF v_reward.points_cost IS NULL OR v_reward.points_cost<0
       OR coalesce(v_reward.additional_cash_cost,0)<0
       OR coalesce(v_reward.voucher_validity_days,15)<1 THEN
        RETURN jsonb_build_object('ok',false,'error','invalid_reward_configuration');
    END IF;

    IF v_reward.max_redemptions_per_customer IS NOT NULL THEN
        SELECT count(*) INTO v_issued_count FROM public.fidelity_vouchers fv
         WHERE fv.customer_id=v_customer_id AND fv.store_id=v_store_id
           AND fv.reward_id=v_reward.id;
        IF v_issued_count>=v_reward.max_redemptions_per_customer THEN
            RETURN jsonb_build_object('ok',false,'error','redemption_limit_reached');
        END IF;
    END IF;

    v_points := coalesce(v_customer.loyalty_points,0);
    IF v_points<v_reward.points_cost THEN
        RETURN jsonb_build_object('ok',false,'error','insufficient_points','balance',v_points);
    END IF;

    v_snapshot := jsonb_build_object(
        'title',v_reward.title,'description',v_reward.description,
        'type',v_reward.type,'points_cost',v_reward.points_cost,
        'additional_cash_cost',coalesce(v_reward.additional_cash_cost,0),
        'image_url',v_reward.image_url,
        'product_id',v_reward.product_id,'product_quantity',v_reward.product_quantity,
        'discount_percentage',v_reward.discount_percentage,
        'discount_amount',v_reward.discount_amount,
        'max_discount_value',v_reward.max_discount_value,
        'min_order_value',v_reward.min_order_value,
        'voucher_validity_days',coalesce(v_reward.voucher_validity_days,15)
    );

    UPDATE public.customers SET
        loyalty_points=v_points-v_reward.points_cost,
        last_point_activity_at=now(),updated_at=now()
      WHERE id=v_customer_id AND store_id=v_store_id;

    INSERT INTO public.loyalty_transactions
        (customer_id,program_id,type,points,description,reward_id,created_at)
    VALUES
        (v_customer_id,v_reward.program_id,'redemption',-v_reward.points_cost,
         'Troca por prêmio: '||v_reward.title,v_reward.id,now())
    RETURNING id INTO v_transaction_id;

    -- UUIDv4 provides cryptographic randomness; 24 hexadecimal characters make guessing impractical.
    v_code := 'FID-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,24));
    INSERT INTO public.fidelity_vouchers
        (store_id,customer_id,reward_id,code,status,expires_at,created_at,
         request_key,points_transaction_id,points_cost,cash_due,reward_snapshot)
    VALUES
        (v_store_id,v_customer_id,v_reward.id,v_code,'active',
         now()+make_interval(days=>coalesce(v_reward.voucher_validity_days,15)),now(),
         p_request_key,v_transaction_id,v_reward.points_cost,
         coalesce(v_reward.additional_cash_cost,0),v_snapshot)
    RETURNING id INTO v_voucher_id;

    IF v_reward.stock_quantity IS NOT NULL THEN
        UPDATE public.fidelity_rewards
           SET stock_quantity=stock_quantity-1
         WHERE id=v_reward.id;
    END IF;

    RETURN jsonb_build_object(
        'ok',true,'replayed',false,'voucher_id',v_voucher_id,
        'code',v_code,'expires_at',now()+make_interval(days=>coalesce(v_reward.voucher_validity_days,15)),
        'points_cost',v_reward.points_cost,'cash_due',coalesce(v_reward.additional_cash_cost,0),
        'new_balance',v_points-v_reward.points_cost
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.customer_redeem_loyalty_reward_safe(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_redeem_loyalty_reward_safe(uuid,uuid) TO authenticated, service_role;
