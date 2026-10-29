-- SECURITY / CONCURRENCY CONTRACT FOR CUSTOMER CANCELLATION REQUESTS
-- Run against homologation with two active, different customers in one store.
-- The enclosing transaction is always rolled back. Never use client JWTs.
begin;
do $test$
declare a record;b record; owner_id uuid; oid uuid; request_id uuid;
  response jsonb; before_status text; after_status text;
  before_payment text; after_payment text;
begin
  if has_table_privilege('authenticated','public.customer_order_cancellation_requests','SELECT')
     or has_table_privilege('authenticated','public.customer_order_cancellation_requests','INSERT')
     or has_table_privilege('authenticated','public.customer_order_cancellation_events','SELECT') then
     raise exception 'Unsafe direct table privilege';
  end if;
  select sd.customer_id,sd.store_id,sd.auth_user_id,sd.session_id,st.user_id owner_id
    into a
  from public.customer_auth_session_devices sd
  join public.customer_auth_identities i using(customer_id,store_id,auth_user_id)
  join public.customer_auth_trusted_devices d on d.id=sd.trusted_device_id
  join public.stores st on st.id=sd.store_id
  where sd.revoked_at is null and i.revoked_at is null and d.revoked_at is null
  and st.user_id is not null
  and exists(select 1 from public.orders o where o.store_id=sd.store_id and o.customer_id=sd.customer_id and o.status::text <> 'cancelled')
  limit 1;
  select sd.customer_id,sd.store_id,sd.auth_user_id,sd.session_id
    into b
  from public.customer_auth_session_devices sd
  join public.customer_auth_identities i using(customer_id,store_id,auth_user_id)
  join public.customer_auth_trusted_devices d on d.id=sd.trusted_device_id
  where sd.revoked_at is null and i.revoked_at is null and d.revoked_at is null
    and sd.store_id=a.store_id and sd.customer_id<>a.customer_id
  limit 1;
  if a.customer_id is null or b.customer_id is null then
    raise exception 'INCONCLUSIVE: prepare two active sessions in same store';
  end if;
  select id,status::text,payment_status::text
    into oid,before_status,before_payment
  from public.orders where customer_id=a.customer_id and store_id=a.store_id
    and status::text <> 'cancelled' order by created_at desc limit 1;

  perform set_config('request.jwt.claims',jsonb_build_object(
      'sub',a.auth_user_id::text,'role','authenticated','session_id',a.session_id::text,
      'iat',extract(epoch from clock_timestamp())::bigint)::text,true);
  execute 'set local role authenticated';
  response:=public.request_customer_self_order_cancellation_safe(oid,'Solicitação simulada para provar isolamento sem cancelar');
  if not coalesce((response->>'ok')::boolean,false) then raise exception 'Owner create denied';end if;
  request_id:=(response->>'request_id')::uuid;
  response:=public.request_customer_self_order_cancellation_safe(oid,'Idempotência de pedido já solicitado');
  if not coalesce((response->>'already_exists')::boolean,false) then raise exception 'Duplicate active request';end if;
  response:=public.get_admin_order_cancellation_requests_safe(a.store_id,50);
  if response->>'error'<>'access_denied' then raise exception 'Customer could read administrative queue';end if;

  perform set_config('request.jwt.claims',jsonb_build_object(
     'sub',b.auth_user_id::text,'role','authenticated','session_id',b.session_id::text,
     'iat',extract(epoch from clock_timestamp())::bigint)::text,true);
  response:=public.request_customer_self_order_cancellation_safe(oid,'Outra conta tentando solicitar cancelamento alheio');
  if response->>'error'<>'order_not_found' then raise exception 'Cross-account mutation';end if;
  response:=public.get_customer_self_order_cancellation_requests_safe(100);
  if exists(select 1 from jsonb_array_elements(response->'requests') x where x->>'id'=request_id::text) then
    raise exception 'Cross-account timeline exposure';
  end if;

  perform set_config('request.jwt.claims',jsonb_build_object(
    'sub',a.owner_id::text,'role','authenticated','iat',extract(epoch from clock_timestamp())::bigint)::text,true);
  response:=public.review_admin_order_cancellation_request_safe(request_id,'under_review','Equipe iniciou avaliação da solicitação');
  if not coalesce((response->>'ok')::boolean,false) then raise exception 'Owner cannot review';end if;
  response:=public.review_admin_order_cancellation_request_safe(request_id,'refund_processing','Nenhum estorno foi executado');
  if response->>'error'<>'invalid_transition' then raise exception 'Fake refund progress possible';end if;
  response:=public.review_admin_order_cancellation_request_safe(request_id,'rejected','Teste de recusa com justificativa suficiente');
  if not coalesce((response->>'ok')::boolean,false) then raise exception 'Owner could not reject';end if;

  perform set_config('request.jwt.claims',jsonb_build_object(
      'sub',a.auth_user_id::text,'role','authenticated','session_id',a.session_id::text,
      'iat',extract(epoch from clock_timestamp())::bigint)::text,true);
  response:=public.get_customer_self_order_cancellation_requests_safe(100);
  if not exists(select 1 from jsonb_array_elements(response->'requests') x
    where x->>'id'=request_id::text and x->>'status'='rejected'
      and jsonb_array_length(x->'events')=3) then
    raise exception 'Customer cannot see review timeline';
  end if;
  execute 'reset role';
  select status::text,payment_status::text into after_status,after_payment
    from public.orders where id=oid;
  if after_status is distinct from before_status
     or after_payment is distinct from before_payment then
    raise exception 'Request workflow mutated commercial order/payment';
  end if;
end $test$;
select 'PASS: audited requests and review, no cross-account visibility, no financial/status mutation' as test_result;
rollback;
