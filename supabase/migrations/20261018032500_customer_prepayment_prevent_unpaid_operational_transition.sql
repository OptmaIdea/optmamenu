begin;
-- Prevent any operator stage transition of advance-payment orders before verified payment.
CREATE OR REPLACE FUNCTION public.admin_accept_public_order_safe(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ DECLARE v_store_id uuid; v_role text:=coalesce(auth.role(),''); BEGIN SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id; IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF; IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (public.app_is_store_owner(v_store_id) OR public.user_has_store_permission(v_store_id,'orders.manage'))) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF; if exists (
    select 1 from public.orders o
    where o.id=p_order_id and o.store_id=v_store_id
      and o.commercial_metadata->>'payment_timing'='pay_now'
      and coalesce(o.payment_status,'pending')<>'paid'
 ) then return jsonb_build_object('ok',false,'error','payment_confirmation_required'); end if;
 return public.admin_accept_public_order_safe_internal_0d(p_order_id); END;$function$
;

CREATE OR REPLACE FUNCTION public.admin_dispatch_public_order_safe(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_store_id uuid;
  v_role text := coalesce(auth.role(), '');
begin
  select store_id into v_store_id from public.orders where id = p_order_id;
  if v_store_id is null then return jsonb_build_object('ok', false, 'error', 'order_not_found'); end if;
  if v_role in ('anon','authenticated') and (
    auth.uid() is null or not (
      public.app_is_store_owner(v_store_id) or public.user_has_store_permission(v_store_id, 'orders.manage')
    )
  ) then return jsonb_build_object('ok', false, 'error', 'access_denied'); end if;
  if exists (
    select 1 from public.orders o
    where o.id=p_order_id and o.store_id=v_store_id
      and o.commercial_metadata->>'payment_timing'='pay_now'
      and coalesce(o.payment_status,'pending')<>'paid'
 ) then return jsonb_build_object('ok',false,'error','payment_confirmation_required'); end if;
 return public.admin_dispatch_public_order_safe_internal_0d(p_order_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_mark_public_order_ready_safe(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$ DECLARE v_store_id uuid; v_role text:=coalesce(auth.role(),''); BEGIN SELECT o.store_id INTO v_store_id FROM public.orders o WHERE o.id=p_order_id; IF v_store_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','order_not_found'); END IF; IF v_role IN ('anon','authenticated') AND (auth.uid() IS NULL OR NOT (public.app_is_store_owner(v_store_id) OR public.user_has_store_permission(v_store_id,'orders.manage'))) THEN RETURN jsonb_build_object('ok',false,'error','access_denied'); END IF; if exists (
    select 1 from public.orders o
    where o.id=p_order_id and o.store_id=v_store_id
      and o.commercial_metadata->>'payment_timing'='pay_now'
      and coalesce(o.payment_status,'pending')<>'paid'
 ) then return jsonb_build_object('ok',false,'error','payment_confirmation_required'); end if;
 return public.admin_mark_public_order_ready_safe_internal_0d(p_order_id); END;$function$
;
commit;