-- P11: give holder of order token the PIX destination already configured as public.
-- Do not expose account credentials, bank integration secrets or arbitrary metadata.
-- Keep existing public order-token validation and state transitions unmodified.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_public_order_payment_proof_state(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_order record;
  v_method record;
  v_proofs jsonb := '[]'::jsonb;
  v_eligible boolean := false;
begin
  select o.id,o.store_id,o.order_code,o.status::text as status,o.payment_status,o.payment_method_code,o.total
  into v_order from public.orders o where o.public_order_token=trim(coalesce(p_token,'')) limit 1;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;

  select pm.code,pm.name,coalesce(pm.base_code,pm.code) as base_code,pm.requires_proof,pm.metadata
  into v_method from public.store_payment_methods pm
  where pm.store_id=v_order.store_id and pm.code=v_order.payment_method_code limit 1;

  v_eligible := v_order.status in ('reserved','confirmed','ready')
    and coalesce(v_order.payment_status,'pending') <> 'paid'
    and coalesce(v_method.base_code,'')='pix'
    and coalesce(v_method.requires_proof,false)=true;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'status',p.status,'original_file_name',p.original_file_name,'declared_amount',p.declared_amount,
    'declared_paid_at',p.declared_paid_at,'submitted_at',p.submitted_at,'decided_at',p.decided_at,
    'decision_notes',case when p.status='rejected' then p.decision_notes else null end
  ) order by p.created_at desc),'[]'::jsonb)
  into v_proofs from public.order_payment_proofs p where p.order_id=v_order.id and p.status <> 'upload_pending';

  return jsonb_build_object(
    'ok',true,'eligible',v_eligible,'order_code',v_order.order_code,'order_status',v_order.status,
    'payment_status',v_order.payment_status,'payment_method_code',v_method.code,'payment_method_name',v_method.name,
    'requires_proof',coalesce(v_method.requires_proof,false),'order_total',v_order.total,'proofs',v_proofs,
    'pix_key',case when v_eligible and v_method.code='pix_manual_qr'
      then nullif(v_method.metadata->'checkout'->>'pix_key','') else null end,
    'pix_recipient',case when v_eligible and v_method.code='pix_manual_qr'
      then nullif(v_method.metadata->'checkout'->>'pix_recipient','') else null end
  );
end;
$function$
;
COMMIT;
