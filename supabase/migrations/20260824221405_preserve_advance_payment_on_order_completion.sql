create or replace function public.admin_finalize_public_order_with_payment(p_order_id uuid, p_payment_method_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $$
declare
  v_store_id uuid;
  v_payment_status text;
  v_payment_method_code text;
  v_role text := coalesce(auth.role(),'');
  v_result jsonb;
begin
  select o.store_id,o.payment_status,o.payment_method_code
  into v_store_id,v_payment_status,v_payment_method_code
  from public.orders o
  where o.id=p_order_id;

  if v_store_id is null then return jsonb_build_object('ok',false,'error','order_not_found'); end if;

  if v_role in ('anon','authenticated') and (
    auth.uid() is null or not (
      public.app_is_store_owner(v_store_id)
      or public.user_has_store_permission(v_store_id,'orders.manage')
      or public.user_has_store_permission(v_store_id,'pdv.payment.change')
      or public.user_has_store_permission(v_store_id,'financial.manage')
    )
  ) then
    return jsonb_build_object('ok',false,'error','access_denied');
  end if;

  if coalesce(v_payment_status,'pending')='paid' then
    v_result := public.admin_complete_public_order_safe_internal_0d(p_order_id);
    return v_result || jsonb_build_object(
      'payment_method_code',v_payment_method_code,
      'payment_status','paid',
      'payment_preserved',true
    );
  end if;

  return public.admin_finalize_public_order_with_payment_internal_0d(p_order_id,p_payment_method_code);
end;
$$;

revoke all on function public.admin_finalize_public_order_with_payment(uuid,text) from public,anon;
grant execute on function public.admin_finalize_public_order_with_payment(uuid,text) to authenticated,service_role;
