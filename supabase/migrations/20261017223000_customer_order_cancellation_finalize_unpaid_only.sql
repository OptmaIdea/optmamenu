begin;
-- Definitive settlement of an UNPAID, not-dispatched request only.
-- Delegates inventory release and order cancellation to the existing order authority.
-- NEVER changes paid orders, completed orders, or dispatched orders.
create or replace function public.approve_admin_unpaid_order_cancellation_request_safe(
  p_request_id uuid, p_note text default null
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
declare
 v_target record; v_order record; v_done jsonb;
 v_note text := btrim(coalesce(p_note,''));
 v_now timestamptz;
begin
 if p_request_id is null then return jsonb_build_object('ok',false,'error','missing_request');end if;
 if char_length(v_note)>700 then return jsonb_build_object('ok',false,'error','invalid_note');end if;

 -- Read target non-locking, then lock order FIRST just like submission.
 select store_id,order_id into v_target
 from public.customer_order_cancellation_requests where id=p_request_id;
 if not found then return jsonb_build_object('ok',false,'error','request_not_found');end if;
 if auth.role() is distinct from 'authenticated'
    or auth.uid() is null
    or not (public.app_is_store_owner(v_target.store_id)
      or public.user_has_store_permission(v_target.store_id,'orders.cancel')) then
   return jsonb_build_object('ok',false,'error','access_denied');
 end if;
 select id,status::text status,payment_status::text payment_status,store_id into v_order
 from public.orders where id=v_target.order_id and store_id=v_target.store_id for update;
 if not found then return jsonb_build_object('ok',false,'error','order_not_found');end if;

 select id,status,reason,request_type into v_target
 from public.customer_order_cancellation_requests
 where id=p_request_id and order_id=v_order.id and store_id=v_order.store_id
 for update;
 if not found then return jsonb_build_object('ok',false,'error','request_not_found');end if;
 if v_target.status='approved' and v_order.status='cancelled' then
   return jsonb_build_object('ok',true,'status','approved','already_done',true);
 end if;
 if v_target.status not in ('received','under_review') then
   return jsonb_build_object('ok',false,'error','request_not_approvable');
 end if;
 if v_target.request_type<>'cancellation' or v_order.status not in ('reserved','confirmed','ready') then
   return jsonb_build_object('ok',false,'error','delivery_return_reversal_required');
 end if;
 if coalesce(v_order.payment_status,'pending') not in ('pending','failed') then
   return jsonb_build_object('ok',false,'error','refund_workflow_required');
 end if;
 if exists(select 1 from public.online_payment_intents i
   where i.order_id=v_order.id and i.store_id=v_order.store_id
     and i.status in ('authorized','paid','refund_pending','partially_refunded','refunded')) then
   return jsonb_build_object('ok',false,'error','refund_workflow_required');
 end if;
 -- No fake refund or manual stock adjustments. The existing P0-guarded
 -- order authority validates and executes reservation cancellation.
 v_done:=public.admin_cancel_public_order_safe(
   v_order.id,
   left('Solicitação do cliente aprovada pela loja: '||v_target.reason,650)
 );
 if not coalesce((v_done->>'ok')::boolean,false) then
   -- Roll back any nested partial effects (if the legacy function changed anything).
   raise exception 'order_cancellation_not_committed: %',coalesce(v_done->>'error','unknown')
     using errcode='P0001';
 end if;
 v_now:=clock_timestamp();
 update public.customer_order_cancellation_requests set
   status='approved', decision_note=case when v_note='' then 'Cancelamento autorizado pela loja.' else v_note end,
   decision_at=v_now,decided_by=auth.uid(),updated_at=v_now
 where id=p_request_id;
 insert into public.customer_order_cancellation_events(
   request_id,store_id,status,event_note,actor_type,actor_id
 ) values(
   p_request_id,v_order.store_id,'approved',
   case when v_note='' then 'Pedido cancelado; reserva liberada pela operação existente.' else v_note end,
   'store_operator',auth.uid()
 );
 return jsonb_build_object('ok',true,'status','approved','order_status','cancelled',
   'already_done',false);
end;
$fn$;
revoke all on function public.approve_admin_unpaid_order_cancellation_request_safe(uuid,text)
 from public,anon,authenticated;
grant execute on function public.approve_admin_unpaid_order_cancellation_request_safe(uuid,text)
 to authenticated,service_role;
commit;