begin;

create table if not exists public.customer_order_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  order_id uuid not null references public.orders(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  request_type text not null check (request_type in ('cancellation','post_delivery_occurrence')),
  status text not null default 'received' check (status in ('received','under_review','awaiting_return','refund_processing','approved','rejected')),
  reason text not null check (char_length(reason) between 8 and 700),
  order_status_at_request text not null,
  payment_status_at_request text not null,
  requested_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  decision_note text,
  decision_at timestamptz,
  decided_by uuid
);

create unique index if not exists customer_order_cancellation_one_active_per_order
  on public.customer_order_cancellation_requests(order_id)
  where status in ('received','under_review','awaiting_return','refund_processing');
create index if not exists customer_order_cancellation_customer_feed
  on public.customer_order_cancellation_requests(store_id,customer_id,requested_at desc);
create index if not exists customer_order_cancellation_admin_inbox
  on public.customer_order_cancellation_requests(store_id,status,requested_at desc);

create table if not exists public.customer_order_cancellation_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.customer_order_cancellation_requests(id) on delete cascade,
  store_id uuid not null references public.stores(id),
  status text not null check (status in ('received','under_review','awaiting_return','refund_processing','approved','rejected')),
  event_note text,
  actor_type text not null check (actor_type in ('customer','store_operator','system')),
  actor_id uuid,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists customer_order_cancellation_event_timeline
  on public.customer_order_cancellation_events(request_id,created_at,id);

alter table public.customer_order_cancellation_requests enable row level security;
alter table public.customer_order_cancellation_events enable row level security;
revoke all on public.customer_order_cancellation_requests,public.customer_order_cancellation_events from public,anon,authenticated;
grant all on public.customer_order_cancellation_requests,public.customer_order_cancellation_events to service_role;

create or replace function public.request_customer_self_order_cancellation_safe(
  p_order_id uuid, p_reason text
) returns jsonb
language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
declare
 v_cid uuid := public.app_current_customer_id();
 v_sid uuid := public.app_current_store_id();
 v_order record;
 v_existing record;
 v_new_id uuid;
 v_reason text := btrim(coalesce(p_reason,''));
 v_type text;
begin
 if public.app_current_role() <> 'customer' or v_cid is null or v_sid is null then
   return jsonb_build_object('ok',false,'error','access_denied');
 end if;
 if p_order_id is null or char_length(v_reason) not between 8 and 700 then
   return jsonb_build_object('ok',false,'error','invalid_reason');
 end if;
 select id,status::text as status,payment_status::text as payment_status,
        store_id,customer_id
 into v_order from public.orders
 where id=p_order_id and store_id=v_sid and customer_id=v_cid
 for update;
 if not found then return jsonb_build_object('ok',false,'error','order_not_found'); end if;
 if v_order.status='cancelled' then
   return jsonb_build_object('ok',false,'error','already_cancelled');
 end if;
 v_type := case when v_order.status='completed'
          then 'post_delivery_occurrence' else 'cancellation' end;

 select id,status,request_type into v_existing
 from public.customer_order_cancellation_requests
 where order_id=p_order_id
 and status in ('received','under_review','awaiting_return','refund_processing')
 order by requested_at desc limit 1 for update;
 if found then
   return jsonb_build_object('ok',true,'request_id',v_existing.id,'status',v_existing.status,
       'request_type',v_existing.request_type,'already_exists',true);
 end if;

 insert into public.customer_order_cancellation_requests(
   store_id,order_id,customer_id,request_type,reason,
   order_status_at_request,payment_status_at_request
 ) values(v_sid,p_order_id,v_cid,v_type,v_reason,v_order.status,
          coalesce(v_order.payment_status,'pending'))
 returning id into v_new_id;

 insert into public.customer_order_cancellation_events(
   request_id,store_id,status,event_note,actor_type,actor_id
 ) values(v_new_id,v_sid,'received','Solicitação recebida para análise da loja.','customer',v_cid);

 return jsonb_build_object('ok',true,'request_id',v_new_id,'status','received',
    'request_type',v_type,'already_exists',false);
end;
$fn$;
revoke all on function public.request_customer_self_order_cancellation_safe(uuid,text) from public,anon;
grant execute on function public.request_customer_self_order_cancellation_safe(uuid,text) to authenticated,service_role;

create or replace function public.get_customer_self_order_cancellation_requests_safe(
  p_limit integer default 100
) returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
declare
 v_cid uuid := public.app_current_customer_id();
 v_sid uuid := public.app_current_store_id();
 v_result jsonb;
begin
 if public.app_current_role() <> 'customer' or v_cid is null or v_sid is null then
   return jsonb_build_object('ok',false,'error','access_denied');
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'order_id',r.order_id,'request_type',r.request_type,
    'status',r.status,'reason',r.reason,
    'requested_at',r.requested_at,'updated_at',r.updated_at,
    'decision_at',r.decision_at,'decision_note',r.decision_note,
    'events',coalesce((select jsonb_agg(
      jsonb_build_object('id',e.id,'status',e.status,'note',e.event_note,'at',e.created_at)
      order by e.created_at,e.id)
      from public.customer_order_cancellation_events e
      where e.request_id=r.id and e.store_id=v_sid),'[]'::jsonb)
 ) order by r.requested_at desc),'[]'::jsonb) into v_result
 from (select * from public.customer_order_cancellation_requests
       where store_id=v_sid and customer_id=v_cid
       order by requested_at desc limit least(greatest(coalesce(p_limit,100),1),200)) r;
 return jsonb_build_object('ok',true,'requests',v_result);
end;
$fn$;
revoke all on function public.get_customer_self_order_cancellation_requests_safe(integer) from public,anon;
grant execute on function public.get_customer_self_order_cancellation_requests_safe(integer) to authenticated,service_role;

create or replace function public.get_admin_order_cancellation_requests_safe(
 p_store_id uuid,p_limit integer default 100
) returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
declare v_result jsonb;
begin
 if p_store_id is null or auth.uid() is null or
   not (public.app_is_store_owner(p_store_id)
        or (public.user_has_store_permission(p_store_id,'orders.view')
            and public.user_has_store_permission(p_store_id,'orders.cancel'))) then
   return jsonb_build_object('ok',false,'error','access_denied');
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'order_id',r.order_id,'order_code',o.order_code,
   'order_status',o.status,'payment_status',o.payment_status,
   'request_type',r.request_type,'status',r.status,'reason',r.reason,
   'requested_at',r.requested_at,'decision_note',r.decision_note,
   'decision_at',r.decision_at
 ) order by r.requested_at desc),'[]'::jsonb) into v_result
 from (select * from public.customer_order_cancellation_requests
       where store_id=p_store_id order by requested_at desc
       limit least(greatest(coalesce(p_limit,100),1),200)) r
 join public.orders o on o.id=r.order_id and o.store_id=p_store_id;
 return jsonb_build_object('ok',true,'requests',v_result);
end;
$fn$;
revoke all on function public.get_admin_order_cancellation_requests_safe(uuid,integer) from public,anon;
grant execute on function public.get_admin_order_cancellation_requests_safe(uuid,integer) to authenticated,service_role;

create or replace function public.review_admin_order_cancellation_request_safe(
 p_request_id uuid,p_status text,p_note text default null
) returns jsonb language plpgsql security definer
set search_path to 'public','pg_temp'
as $fn$
declare v_request record; v_order record; v_note text:=btrim(coalesce(p_note,''));
begin
 if p_request_id is null or p_status not in ('under_review','awaiting_return','rejected') then
   return jsonb_build_object('ok',false,'error','invalid_transition');
 end if;
 if char_length(v_note)>700 or (p_status='rejected' and char_length(v_note)<8) then
   return jsonb_build_object('ok',false,'error','invalid_decision_note');
 end if;
 select * into v_request from public.customer_order_cancellation_requests
   where id=p_request_id for update;
 if not found then return jsonb_build_object('ok',false,'error','request_not_found'); end if;
 if auth.uid() is null or not (
   public.app_is_store_owner(v_request.store_id)
   or public.user_has_store_permission(v_request.store_id,'orders.cancel')
 ) then return jsonb_build_object('ok',false,'error','access_denied'); end if;
 if v_request.status not in ('received','under_review','awaiting_return') then
   return jsonb_build_object('ok',false,'error','request_no_longer_reviewable');
 end if;
 select id,status::text as status into v_order from public.orders
   where id=v_request.order_id and store_id=v_request.store_id for update;
 if not found then return jsonb_build_object('ok',false,'error','order_not_found');end if;
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
$fn$;
revoke all on function public.review_admin_order_cancellation_request_safe(uuid,text,text) from public,anon;
grant execute on function public.review_admin_order_cancellation_request_safe(uuid,text,text) to authenticated,service_role;

commit;