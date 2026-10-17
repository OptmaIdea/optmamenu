-- Allow delivery return to collect payment and complete the order in one operation.
CREATE OR REPLACE FUNCTION public.admin_finalize_public_order_with_payment_internal_0d(p_order_id uuid, p_payment_method_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order record;
  v_method_code text;
  v_legacy_method public.payment_method;
  v_result jsonb;
  v_cashbook_result jsonb;
begin
  select id,store_id,order_code,status into v_order from public.orders where id=p_order_id;
  if v_order.id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
  if auth.uid() is null or not public.is_store_member(v_order.store_id) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
  if v_order.status::text not in ('confirmed','ready','out_for_delivery') then return jsonb_build_object('ok',false,'error','invalid_status','current_status',v_order.status::text); end if;

  v_method_code := lower(trim(coalesce(p_payment_method_code,'')));
  if v_method_code not in ('pix','cash','debit_card','credit_card') then
    return jsonb_build_object('ok',false,'error','invalid_payment_method');
  end if;

  v_legacy_method := case
    when v_method_code='pix' then 'pix'::public.payment_method
    when v_method_code='cash' then 'cash'::public.payment_method
    else 'card'::public.payment_method
  end;

  update public.orders
  set payment_method_code=v_method_code,
      payment_method=v_legacy_method,
      payment_status='paid',
      payment_metadata=coalesce(payment_metadata,'{}'::jsonb)||jsonb_build_object(
        'confirmed_at',now(),
        'confirmed_by',auth.uid(),
        'confirmed_in_finalization',true,
        'payment_method_code',v_method_code
      )
  where id=v_order.id;

  if v_order.status::text='out_for_delivery' then
    update public.orders
       set status='completed',
           completed_at=coalesce(completed_at,now()),
           metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('delivery_completed_at',now(),'payment_confirmed_on_delivery_return',true),
           updated_at=now()
     where id=v_order.id;
    select public.create_cashbook_entry_from_order(v_order.id) into v_cashbook_result;
    return jsonb_build_object('ok',true,'order_id',v_order.id,'order_code',v_order.order_code,'status','completed','payment_method_code',v_method_code,'payment_status','paid','cashbook',v_cashbook_result);
  end if;

  if v_order.status::text='ready' then
    update public.orders set status='confirmed' where id=v_order.id;
  end if;

  v_result := public.complete_confirmed_public_order(v_order.id);
  return v_result || jsonb_build_object('payment_method_code',v_method_code,'payment_status','paid');
end;
$function$

notify pgrst, 'reload schema';
