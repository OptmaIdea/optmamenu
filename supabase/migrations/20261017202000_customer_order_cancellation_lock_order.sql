begin;
CREATE OR REPLACE FUNCTION public.review_admin_order_cancellation_request_safe(p_request_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_request record; v_order record; v_note text:=btrim(coalesce(p_note,''));
begin
 if p_request_id is null or p_status not in ('under_review','awaiting_return','rejected') then
   return jsonb_build_object('ok',false,'error','invalid_transition');
 end if;
 if char_length(v_note)>700 or (p_status='rejected' and char_length(v_note)<8) then
   return jsonb_build_object('ok',false,'error','invalid_decision_note');
 end if;
 -- Always acquire the ORDER lock before the request lock, matching the
 -- customer request path and avoiding a cancellation/review deadlock.
 select store_id,order_id into v_request
   from public.customer_order_cancellation_requests where id=p_request_id;
 if not found then return jsonb_build_object('ok',false,'error','request_not_found'); end if;
 if auth.uid() is null or not (
   public.app_is_store_owner(v_request.store_id)
   or public.user_has_store_permission(v_request.store_id,'orders.cancel')
 ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 select id,status::text as status into v_order from public.orders
   where id=v_request.order_id and store_id=v_request.store_id for update;
 if not found then return jsonb_build_object('ok',false,'error','order_not_found');end if;
 select * into v_request from public.customer_order_cancellation_requests
   where id=p_request_id and order_id=v_order.id for update;
 if not found then return jsonb_build_object('ok',false,'error','request_not_found');end if;
 if v_request.status not in ('received','under_review','awaiting_return') then
   return jsonb_build_object('ok',false,'error','request_no_longer_reviewable');
 end if;
 if p_status='awaiting_return' and v_order.status <> 'out_for_delivery' then
   return jsonb_build_object('ok',false,'error','delivery_return_not_applicable');
 end if;
 if v_order.status='cancelled' and p_status <> 'under_review' then
   return jsonb_build_object('ok',false,'error','order_already_cancelled_requires_reconciliation');
 end if;
 if v_request.status=p_status and coalesce(v_request.decision_note,'')=v_note then
   return jsonb_build_object('ok',true,'status',p_status,'unchanged',true);
 end if;
 update public.customer_order_cancellation_requests
   set status=p_status,decision_note=case when p_status='under_review' then null else v_note end,
       decision_at=case when p_status='rejected' then clock_timestamp() else null end,
       decided_by=auth.uid(),updated_at=clock_timestamp()
   where id=p_request_id;
 insert into public.customer_order_cancellation_events(
   request_id,store_id,status,event_note,actor_type,actor_id
 ) values (p_request_id,v_request.store_id,p_status,
           case when v_note<>'' then v_note else 'Análise iniciada pela loja.' end,
           'store_operator',auth.uid());
 return jsonb_build_object('ok',true,'status',p_status,'unchanged',false);
end;
$function$
;
commit;